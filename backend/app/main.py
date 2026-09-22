import csv
import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.schemas import AnalysisCreate, AnalysisJob, AnalysisResult, JobStage, JobStatus
from app.services.analysis import run_analysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("biolit-lens")
settings = get_settings()
app = FastAPI(title="BioLit Lens API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_methods=["*"], allow_headers=["*"])

jobs: dict[str, AnalysisJob] = {}
results: dict[str, AnalysisResult] = {}


def now() -> datetime:
    return datetime.now(timezone.utc)


async def execute_job(job_id: str) -> None:
    job = jobs[job_id]
    job.status = JobStatus.running
    job.stage = JobStage.search
    job.progress = 8

    def on_progress(stage: str, progress: int, processed: int, total: int) -> None:
        job.stage = JobStage(stage)
        job.progress = min(progress, 95)
        job.processed_records = processed
        job.total_hits = total

    try:
        result = await run_analysis(job.query, job.max_records, on_progress, settings)
        results[job_id] = result
        job.status = JobStatus.completed
        job.stage = JobStage.done
        job.progress = 100
        job.processed_records = result.analyzed_count
        job.total_hits = result.total_hits
        job.completed_at = now()
    except Exception as exc:
        logger.exception("analysis failed", extra={"job_id": job_id, "stage": job.stage})
        job.status = JobStatus.failed
        job.error_code = getattr(exc, "code", "ANALYSIS_FAILED")
        job.error_message = str(exc) if isinstance(exc, ValueError) else "分析暂时失败，请稍后重试"
        job.completed_at = now()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "biolit-lens-api"}


@app.post("/api/v1/analyses", response_model=AnalysisJob, status_code=202)
async def create_analysis(payload: AnalysisCreate, background_tasks: BackgroundTasks) -> AnalysisJob:
    job_id = str(uuid.uuid4())
    job = AnalysisJob(id=job_id, query=payload.query, max_records=payload.max_records, status=JobStatus.queued, stage=JobStage.validate, created_at=now())
    jobs[job_id] = job
    background_tasks.add_task(execute_job, job_id)
    return job


@app.get("/api/v1/analyses/{analysis_id}", response_model=AnalysisJob)
async def get_analysis(analysis_id: str) -> AnalysisJob:
    if analysis_id not in jobs:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "分析不存在"})
    return jobs[analysis_id]


@app.get("/api/v1/analyses/{analysis_id}/result", response_model=AnalysisResult)
async def get_result(analysis_id: str) -> AnalysisResult:
    if analysis_id not in results:
        job = jobs.get(analysis_id)
        if job and job.status == JobStatus.failed:
            raise HTTPException(status_code=502, detail={"code": job.error_code, "message": job.error_message})
        raise HTTPException(status_code=409, detail={"code": "NOT_READY", "message": "分析尚未完成"})
    return results[analysis_id]


@app.post("/api/v1/analyses/{analysis_id}/report", response_model=AnalysisResult)
async def regenerate_report(analysis_id: str) -> AnalysisResult:
    return await get_result(analysis_id)


@app.get("/api/v1/analyses/{analysis_id}/papers")
async def get_papers(analysis_id: str, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), sort: str = Query("influence", pattern="^(influence|citation|date)$")) -> dict[str, object]:
    result = await get_result(analysis_id)
    papers = result.top_papers
    if sort == "citation":
        papers = sorted(papers, key=lambda p: p.citation.citation_count if p.citation and p.citation.citation_count is not None else -1, reverse=True)
    elif sort == "date":
        papers = sorted(papers, key=lambda p: p.published_date or "", reverse=True)
    start = (page - 1) * page_size
    return {"items": papers[start : start + page_size], "page": page, "pageSize": page_size, "total": len(papers)}


@app.get("/api/v1/analyses/{analysis_id}/export")
async def export_result(analysis_id: str, format: str = Query(..., pattern="^(csv|json|md)$")) -> Response:
    result = await get_result(analysis_id)
    if format == "json":
        return Response(result.model_dump_json(indent=2), media_type="application/json", headers={"Content-Disposition": "attachment; filename=biolit-lens-result.json"})
    if format == "md":
        lines = [f"# {result.report.title}", "", result.report.scope, "", *[f"- {finding.text}（PMID: {', '.join(finding.pmids)}）" for finding in result.report.key_findings], "", "## 局限性", *[f"- {item}" for item in result.report.limitations]]
        return Response("\n".join(lines), media_type="text/markdown", headers={"Content-Disposition": "attachment; filename=biolit-lens-report.md"})
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["pmid", "title", "year", "journal", "citation_count", "influence_score", "oa_status", "doi", "pubmed_url"])
    for paper in result.top_papers:
        writer.writerow([paper.pmid, paper.title, paper.year or "", paper.journal or "", paper.citation.citation_count if paper.citation else "", paper.citation.influence_score if paper.citation else "", paper.open_access.label if paper.open_access else "状态未知", paper.doi or "", paper.pubmed_url])
    return Response(output.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=biolit-lens-top-papers.csv"})

