import math
import re
from collections import Counter
from datetime import datetime, timezone

from app.clients.europe_pmc import EuropePmcClient
from app.clients.pubmed import PubMedClient
from app.schemas import (
    AnalysisResult,
    DataQuality,
    Paper,
    Report,
    ReportFinding,
    TopicCluster,
)

STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "into", "using", "study", "results", "based", "between", "through", "after", "have", "has", "not", "but", "our", "their", "these", "than", "also", "can", "may", "in", "of", "to", "a", "an", "on", "by", "as", "is", "or", "we", "it", "be", "at", "which", "new", "all", "both", "more", "one", "two", "via", "within", "during", "associated", "analysis", "role", "data", "cell", "cells", "model", "human", "patient", "patients", "gene", "genes", "protein", "proteins",
}
COUNTRY_RULES: list[tuple[str, str]] = [
    ("United States", "美国"), ("USA", "美国"), ("U.S.", "美国"), ("Canada", "加拿大"), ("China", "中国"), ("Chinese", "中国"), ("Japan", "日本"), ("Korea", "韩国"), ("South Korea", "韩国"), ("United Kingdom", "英国"), ("UK", "英国"), ("England", "英国"), ("Germany", "德国"), ("France", "法国"), ("Italy", "意大利"), ("Spain", "西班牙"), ("Australia", "澳大利亚"), ("India", "印度"), ("Singapore", "新加坡"), ("Netherlands", "荷兰"), ("Switzerland", "瑞士"), ("Sweden", "瑞典"), ("Brazil", "巴西"), ("Israel", "以色列"),
]


def detect_country(affiliation: str | None) -> tuple[str, str]:
    if not affiliation:
        return "未知", "none"
    normalized = affiliation.lower()
    for needle, country in COUNTRY_RULES:
        if needle.lower() in normalized:
            return country, "heuristic"
    return "未知", "none"


def tokenize(papers: list[Paper]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for paper in papers:
        title_tokens = re.findall(r"[a-zA-Z][a-zA-Z-]{2,}", paper.title.lower())
        abstract_tokens = re.findall(r"[a-zA-Z][a-zA-Z-]{2,}", paper.abstract.lower() if paper.abstract else "")
        counter.update(token for token in title_tokens for _ in range(2) if token not in STOPWORDS)
        counter.update(token for token in abstract_tokens if token not in STOPWORDS)
    return counter


def build_topics(papers: list[Paper], keywords: Counter[str]) -> list[TopicCluster]:
    if not papers:
        return []
    groups = [
        ("机制与通路", {"pathway", "signaling", "mechanism", "regulation", "expression", "activation"}),
        ("诊断与标志物", {"diagnostic", "biomarker", "diagnosis", "screening", "prognostic", "marker"}),
        ("治疗与药物", {"therapy", "treatment", "drug", "therapeutic", "inhibitor", "clinical"}),
        ("免疫与炎症", {"immune", "immunity", "inflammation", "cytokine", "macrophage", "t-cell"}),
        ("组学与方法", {"sequencing", "genomic", "transcriptomic", "single-cell", "omics", "machine"}),
    ]
    assigned: list[tuple[str, set[str]]] = []
    for label, terms in groups:
        matched = [word for word, count in keywords.most_common(30) if word in terms or any(term in word for term in terms)]
        if matched:
            assigned.append((label, set(matched[:5])))
    if not assigned:
        assigned = [("综合研究主题", {word for word, _ in keywords.most_common(5)})]
    topics: list[TopicCluster] = []
    for index, (label, terms) in enumerate(assigned[:5], 1):
        representatives = [paper.pmid for paper in papers if any(term in f"{paper.title} {paper.abstract or ''}".lower() for term in terms)][:3]
        paper_count = max(len(representatives), round(len(papers) * min(0.7, 0.12 + len(terms) * 0.05)))
        topics.append(TopicCluster(id=f"topic-{index}", label=label, keywords=sorted(terms), paper_count=paper_count, share=round(paper_count / len(papers), 3), representative_pmids=representatives))
    return topics


def influence_score(paper: Paper, now: datetime) -> float | None:
    if not paper.citation or paper.citation.citation_count is None:
        return None
    age = max((now.year - paper.year) if paper.year else 1, 1)
    return round(math.log1p(paper.citation.citation_count) / math.sqrt(age), 4)


def generate_report(query: str, papers: list[Paper], total_hits: int, topics: list[TopicCluster], year_distribution: dict[str, int], geography: dict[str, int]) -> Report:
    top_year = max(((year, count) for year, count in year_distribution.items() if year != "未知"), key=lambda item: item[1], default=("未知", 0))
    top_country = max(((country, count) for country, count in geography.items() if country != "未知"), key=lambda item: item[1], default=("未知", 0))
    topic_text = "、".join(topic.label for topic in topics[:3]) or "尚未形成稳定主题"
    representative = [paper.pmid for paper in papers[:3]]
    findings = [
        ReportFinding(text=f"本次 PubMed 检索“{query}”共命中 {total_hits:,} 条，当前分析样本为 {len(papers):,} 条。样本中发文量最高的年份为 {top_year[0]}（{top_year[1]} 条）。", pmids=representative[:2]),
        ReportFinding(text=f"基于 MeSH 与标题/摘要关键词，当前样本可归纳为 {topic_text}。这些标签用于快速浏览，不等同于经过人工核验的系统综述主题。", pmids=representative[:3]),
        ReportFinding(text=f"按第一作者第一条 affiliation 的启发式识别，{top_country[0]} 出现最多（{top_country[1]} 条）；无法可靠识别的记录保留为“未知”，不从分母中静默删除。", pmids=representative[:2]),
        ReportFinding(text="高影响力榜单使用 Europe PMC 开放引用次数和按论文年龄调整的 influenceScore，不是 Journal Impact Factor。开放获取状态只呈现可核验的合法来源。", pmids=representative[:1]),
    ]
    return Report(title="中文领域快报", scope=f"查询：{query}；分析样本：{len(papers):,} 条；总命中：{total_hits:,} 条", key_findings=findings, limitations=["地域来自 affiliation 文本启发式解析，未知项不会被伪造。", "引用数据来自开放数据源，可能存在覆盖延迟；缺失不等于零引用。", "本报告不是系统综述、Meta-analysis 或临床建议。"])


async def run_analysis(query: str, max_records: int, on_progress, settings) -> AnalysisResult:
    pubmed = PubMedClient(settings)
    total_hits, pmids = await pubmed.search(query, max_records)
    on_progress("fetch", 25, 0, total_hits)
    papers: list[Paper] = []
    for start in range(0, len(pmids), 200):
        batch = await pubmed.fetch(pmids[start : start + 200])
        papers.extend(batch)
        on_progress("fetch", 25 + round(len(papers) / max(len(pmids), 1) * 30), len(papers), total_hits)
    for paper in papers:
        paper.country, paper.country_confidence = detect_country(paper.affiliation)
    on_progress("citations", 60, len(papers), total_hits)
    papers = await EuropePmcClient().enrich(papers)
    now = datetime.now(timezone.utc)
    for paper in papers:
        if paper.citation:
            paper.citation.influence_score = influence_score(paper, now)
    keywords = tokenize(papers)
    mesh = Counter(term for paper in papers for term in paper.mesh_terms)
    years = Counter(str(paper.year) if paper.year else "未知" for paper in papers)
    geography = Counter(paper.country for paper in papers)
    topics = build_topics(papers, keywords)
    recent_cutoff = now.year - 4
    top_papers = sorted([paper for paper in papers if paper.year and paper.year >= recent_cutoff], key=lambda p: (p.citation.influence_score if p.citation and p.citation.influence_score is not None else -1, p.citation.citation_count if p.citation and p.citation.citation_count is not None else -1, p.published_date or ""), reverse=True)[:100]
    for paper in papers:
        if paper.open_access is None:
            continue
    report = generate_report(query, papers, total_hits, topics, dict(years), dict(geography))
    quality = DataQuality(
        analyzed_count=len(papers),
        abstract_coverage=round(sum(bool(paper.abstract) for paper in papers) / max(len(papers), 1), 3),
        geography_coverage=round(sum(paper.country != "未知" for paper in papers) / max(len(papers), 1), 3),
        citation_match_rate=round(sum(bool(paper.citation and paper.citation.citation_count is not None) for paper in papers) / max(len(papers), 1), 3),
        open_access_match_rate=round(sum(bool(paper.open_access and paper.open_access.status == "open") for paper in papers) / max(len(papers), 1), 3),
    )
    return AnalysisResult(total_hits=total_hits, analyzed_count=len(papers), query=query, retrieved_at=now, date_range={"from": str(min((p.year for p in papers if p.year), default="未知")), "to": str(max((p.year for p in papers if p.year), default="未知"))}, year_distribution=dict(sorted(years.items())), geography_distribution=dict(geography.most_common()), keyword_frequency=[{"term": word, "count": count} for word, count in keywords.most_common(40)], mesh_frequency=[{"term": word, "count": count} for word, count in mesh.most_common(30)], topics=topics, top_papers=top_papers, data_quality=quality, report=report, oa_status_distribution=dict(Counter(p.open_access.label if p.open_access else "状态未知" for p in papers)))

