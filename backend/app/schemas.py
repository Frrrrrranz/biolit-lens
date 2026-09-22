from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobStatus(StrEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobStage(StrEnum):
    validate = "validate"
    search = "search"
    fetch = "fetch"
    citations = "citations"
    analyze = "analyze"
    report = "report"
    done = "done"


class AnalysisCreate(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    max_records: int = Field(default=2000, ge=100, le=5000, alias="maxRecords")
    use_ai_summary: bool = Field(default=False, alias="useAiSummary")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be empty")
        return value


class CitationMetric(BaseModel):
    pmid: str
    citation_count: int | None = None
    source: str = "Europe PMC"
    checked_at: datetime
    influence_score: float | None = None


class OpenAccessLocation(BaseModel):
    pmid: str
    doi: str | None = None
    status: str
    label: str
    license: str | None = None
    version: str | None = None
    host_type: str | None = None
    landing_url: str | None = None
    pdf_url: str | None = None
    source: str | None = None
    checked_at: datetime


class Paper(BaseModel):
    pmid: str
    doi: str | None = None
    title: str
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    affiliation: str | None = None
    country: str = "未知"
    country_confidence: str = "none"
    journal: str | None = None
    published_date: str | None = None
    year: int | None = None
    mesh_terms: list[str] = Field(default_factory=list)
    publication_types: list[str] = Field(default_factory=list)
    pubmed_url: str
    citation: CitationMetric | None = None
    open_access: OpenAccessLocation | None = None


class TopicCluster(BaseModel):
    id: str
    label: str
    keywords: list[str]
    paper_count: int
    share: float
    representative_pmids: list[str]


class ReportFinding(BaseModel):
    text: str
    pmids: list[str]


class Report(BaseModel):
    title: str
    scope: str
    key_findings: list[ReportFinding]
    limitations: list[str]
    generated_by: str = "规则模板"


class DataQuality(BaseModel):
    analyzed_count: int
    abstract_coverage: float
    geography_coverage: float
    citation_match_rate: float
    open_access_match_rate: float


class AnalysisResult(BaseModel):
    total_hits: int
    analyzed_count: int
    query: str
    retrieved_at: datetime
    date_range: dict[str, str | None]
    year_distribution: dict[str, int]
    geography_distribution: dict[str, int]
    keyword_frequency: list[dict[str, int | str]]
    mesh_frequency: list[dict[str, int | str]]
    topics: list[TopicCluster]
    top_papers: list[Paper]
    data_quality: DataQuality
    report: Report
    oa_status_distribution: dict[str, int]


class AnalysisJob(BaseModel):
    id: str
    query: str
    max_records: int
    status: JobStatus
    stage: JobStage
    progress: int = 0
    processed_records: int = 0
    total_hits: int | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

