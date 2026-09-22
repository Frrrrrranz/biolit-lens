import { useEffect, useMemo, useState } from "react";
import { createAnalysis, exportUrl, getAnalysis, getResult } from "./lib/api";
import type { AnalysisJob, AnalysisResult, Paper } from "./types";

const EXAMPLE_QUERY = "(CRISPR OR genome editing) AND cancer";
const stages: Array<{ key: AnalysisJob["stage"]; label: string }> = [
  { key: "search", label: "检索 PubMed" },
  { key: "fetch", label: "解析摘要" },
  { key: "citations", label: "补全开放引用" },
  { key: "analyze", label: "统计与主题" },
  { key: "report", label: "生成中文简报" },
];

function formatNumber(value: number): string { return new Intl.NumberFormat("zh-CN").format(value); }
function percent(value: number): string { return `${Math.round(value * 100)}%`; }

function App() {
  const [query, setQuery] = useState(EXAMPLE_QUERY);
  const [maxRecords, setMaxRecords] = useState(2000);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setTimeout(async () => {
      try {
        const nextJob = await getAnalysis(job.id);
        setJob(nextJob);
        if (nextJob.status === "completed") setResult(await getResult(nextJob.id));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "无法读取分析状态");
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [job]);

  const sortedYears = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.year_distribution).filter(([year]) => year !== "未知").sort(([a], [b]) => Number(a) - Number(b));
  }, [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setError(null); setResult(null); setSelectedPaper(null);
    try { setJob(await createAnalysis(query.trim(), maxRecords)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "无法创建分析"); }
  }

  function handleDownload(format: "csv" | "json" | "md") {
    if (!job) return;
    window.open(exportUrl(job.id, format), "_blank", "noopener,noreferrer");
  }

  const isWorking = job?.status === "queued" || job?.status === "running";
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BioLit Lens 首页"><span className="brand-mark">BL</span><span>BioLit <i>Lens</i></span></a>
        <div className="topbar-meta"><span className="status-dot" /> <span>PubMed research intelligence</span><a href="https://github.com" target="_blank" rel="noreferrer">GitHub ↗</a></div>
      </header>
      <section className="hero" id="top">
        <div className="eyebrow">/ 01 · FIND THE SIGNAL</div>
        <h1>把一条 PubMed 查询，<br /><em>变成一份可核验的洞察。</em></h1>
        <p className="hero-copy">输入关键词或完整 PubMed 检索式。BioLit Lens 从摘要元数据中提炼趋势、主题、地域和开放引用，并把每个结论连回 PMID。</p>
        <form className="query-card" onSubmit={handleSubmit}>
          <label htmlFor="query">PUBMED QUERY</label>
          <div className="query-row"><input id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：CRISPR AND cancer" disabled={isWorking} /><button type="submit" disabled={isWorking || !query.trim()}>{isWorking ? "分析中…" : "开始分析"}<span>→</span></button></div>
          <div className="query-footer"><button type="button" className="example-button" onClick={() => setQuery(EXAMPLE_QUERY)} disabled={isWorking}>使用示例查询</button><label className="record-control">分析上限 <select value={maxRecords} onChange={(event) => setMaxRecords(Number(event.target.value))} disabled={isWorking}><option value={500}>500 条</option><option value={1000}>1,000 条</option><option value={2000}>2,000 条</option><option value={5000}>5,000 条</option></select></label><span>支持 Boolean / 字段语法</span></div>
        </form>
      </section>
      {error && <div className="alert error"><strong>分析未完成</strong><span>{error}</span><button onClick={() => setError(null)} aria-label="关闭错误">×</button></div>}
      {job && !result && <section className="progress-panel" aria-live="polite"><div className="section-kicker">/ LIVE PIPELINE</div><div className="progress-header"><div><h2>{job.status === "failed" ? "这次分析遇到问题" : "正在把文献变成信号"}</h2><p>{job.status === "failed" ? job.error_message : `已处理 ${formatNumber(job.processed_records)} 条${job.total_hits ? ` / 总命中 ${formatNumber(job.total_hits)} 条` : ""}`}</p></div><span className="progress-value">{job.status === "failed" ? "!" : `${job.progress}%`}</span></div><div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div><div className="stage-list">{stages.map((stage) => <div className={`stage ${job.stage === stage.key ? "active" : stages.findIndex((item) => item.key === job.stage) > stages.findIndex((item) => item.key === stage.key) ? "done" : ""}`} key={stage.key}><span className="stage-icon">{stages.findIndex((item) => item.key === job.stage) > stages.findIndex((item) => item.key === stage.key) ? "✓" : "0" + (stages.findIndex((item) => item.key === stage.key) + 1)}</span>{stage.label}</div>)}</div></section>}
      {result && <Dashboard result={result} onSelectPaper={setSelectedPaper} onDownload={handleDownload} years={sortedYears} />}
      {selectedPaper && <PaperDrawer paper={selectedPaper} onClose={() => setSelectedPaper(null)} />}
      <footer className="footer"><span>BioLit Lens · v0.1</span><span>非 NCBI 官方产品 · 非医疗建议</span><span>数据源：PubMed · Europe PMC · Unpaywall</span></footer>
    </main>
  );
}

interface DashboardProps { result: AnalysisResult; onSelectPaper: (paper: Paper) => void; onDownload: (format: "csv" | "json" | "md") => void; years: Array<[string, number]>; }
function Dashboard({ result, onSelectPaper, onDownload, years }: DashboardProps) {
  const maxYearCount = Math.max(...years.map(([, value]) => value), 1); const geography = Object.entries(result.geography_distribution).slice(0, 8); const maxGeoCount = Math.max(...geography.map(([, value]) => value), 1);
  return <section className="dashboard">
    <div className="dashboard-heading"><div><div className="section-kicker">/ ANALYSIS REPORT</div><h2>你的文献地图，已经就位。</h2><p className="muted">检索式：<code>{result.query}</code> · 更新时间 {new Date(result.retrieved_at).toLocaleString("zh-CN")}</p></div><div className="download-menu"><span>导出结果</span><button onClick={() => onDownload("md")}>Markdown</button><button onClick={() => onDownload("csv")}>Top 100 CSV</button><button onClick={() => onDownload("json")}>完整 JSON</button></div></div>
    <div className="metric-grid"><Metric label="总命中数" value={formatNumber(result.total_hits)} note="PubMed ESearch count" accent="mint" /><Metric label="实际分析" value={formatNumber(result.analyzed_count)} note="摘要元数据样本" /><Metric label="时间跨度" value={`${result.date_range.from ?? "—"} — ${result.date_range.to ?? "—"}`} note="可解析出版年份" /><Metric label="摘要覆盖率" value={percent(result.data_quality.abstract_coverage)} note="解析到摘要的样本" /></div>
    <div className="quality-strip"><div><span>地域识别</span><b>{percent(result.data_quality.geography_coverage)}</b></div><div><span>开放引用匹配</span><b>{percent(result.data_quality.citation_match_rate)}</b></div><div><span>合法 OA 识别</span><b>{percent(result.data_quality.open_access_match_rate)}</b></div><div className="quality-note">缺失数据会被标记，不会静默当作 0。</div></div>
    <div className="two-column"><section className="panel trend-panel"><PanelTitle eyebrow="PUBLICATION TREND" title="发文节奏" detail="每年可解析出版记录" /><div className="bar-chart" aria-label="年度发文量柱状图">{years.slice(-15).map(([year, count]) => <div className="bar-column" key={year}><span className="bar-value">{count}</span><div className="bar" style={{ height: `${Math.max(8, count / maxYearCount * 100)}%` }} /><span className="bar-label">{year.slice(-2)}</span></div>)}</div></section><section className="panel geography-panel"><PanelTitle eyebrow="FIRST AUTHOR AFFILIATION" title="地域分布" detail="第一作者第一条机构 affiliation" /><div className="horizontal-bars">{geography.map(([country, count]) => <div className="h-bar-row" key={country}><div className="h-bar-label"><span>{country}</span><b>{count}</b></div><div className="h-bar-track"><span style={{ width: `${count / maxGeoCount * 100}%` }} /></div></div>)}</div></section></div>
    <div className="two-column topics-row"><section className="panel topics-panel"><PanelTitle eyebrow="RESEARCH DIRECTIONS" title="研究方向" detail="规则归纳 · 需人工核验" /><div className="topic-grid">{result.topics.map((topic, index) => <article className="topic-card" key={topic.id}><span className="topic-index">0{index + 1}</span><h3>{topic.label}</h3><p>{topic.keywords.join(" · ")}</p><div className="topic-footer"><b>{topic.paper_count}</b> 条样本 <span>{percent(topic.share)}</span></div></article>)}</div></section><section className="panel word-panel"><PanelTitle eyebrow="TITLE + ABSTRACT" title="高频信号" detail="标题权重 ×2 · 摘要权重 ×1" /><div className="word-cloud">{result.keyword_frequency.slice(0, 18).map((item, index) => <span key={item.term} className={`word-size-${index % 5}`}>{item.term}</span>)}</div><div className="mesh-line"><span>MeSH</span>{result.mesh_frequency.slice(0, 4).map((item) => <b key={item.term}>{item.term}</b>)}</div></section></div>
    <section className="panel report-panel"><div className="report-header"><div><PanelTitle eyebrow="CHINESE BRIEF" title={result.report.title} detail={result.report.generated_by} /></div><span className="report-stamp">PMID<br /><b>TRACEABLE</b></span></div><p className="report-scope">{result.report.scope}</p><div className="finding-list">{result.report.key_findings.map((finding, index) => <div className="finding" key={finding.text}><span>0{index + 1}</span><p>{finding.text}</p><div className="pmid-chips">{finding.pmids.map((pmid) => <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer" key={pmid}>PMID {pmid} ↗</a>)}</div></div>)}</div><div className="limitations"><b>局限性</b>{result.report.limitations.map((item) => <span key={item}>{item}</span>)}</div></section>
    <section className="panel papers-panel"><div className="papers-header"><PanelTitle eyebrow="OPEN CITATION SIGNAL" title="近 5 年高影响力文献" detail="开放引用 · 年龄校正分数 · 不是 Journal Impact Factor" /><div className="source-pill">Europe PMC · {formatNumber(result.top_papers.length)} 条</div></div><div className="paper-table-wrap"><table><thead><tr><th>论文</th><th>年份 / 期刊</th><th>开放引用</th><th>OA 状态</th><th /></tr></thead><tbody>{result.top_papers.slice(0, 20).map((paper) => <tr key={paper.pmid}><td><button className="paper-title" onClick={() => onSelectPaper(paper)}>{paper.title}</button><small>PMID {paper.pmid}</small></td><td>{paper.year ?? "未知"}<small>{paper.journal ?? "—"}</small></td><td><strong>{paper.citation?.citation_count ?? "—"}</strong><small>{paper.citation?.influence_score !== null && paper.citation?.influence_score !== undefined ? `score ${paper.citation.influence_score}` : "暂无数据"}</small></td><td><span className={`oa-badge ${paper.open_access?.status === "open" ? "open" : "unknown"}`}>{paper.open_access?.label ?? "状态未知"}</span></td><td><a className="external-link" href={paper.pubmed_url} target="_blank" rel="noreferrer" aria-label={`打开 PMID ${paper.pmid}`}>↗</a></td></tr>)}</tbody></table></div></section>
  </section>;
}

function Metric({ label, value, note, accent = "" }: { label: string; value: string; note: string; accent?: string }) { return <div className={`metric-card ${accent}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PanelTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="panel-title"><div className="section-kicker">/ {eyebrow}</div><h2>{title}</h2><p>{detail}</p></div>; }
function PaperDrawer({ paper, onClose }: { paper: Paper; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="paper-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose} aria-label="关闭论文详情">×</button><span className="section-kicker">/ EVIDENCE · PMID {paper.pmid}</span><h2>{paper.title}</h2><div className="drawer-meta">{paper.year ?? "未知年份"} · {paper.journal ?? "未知期刊"}</div><p>{paper.abstract ?? "该记录没有可用摘要。"}</p><dl><dt>第一作者机构</dt><dd>{paper.affiliation ?? "未提供"}</dd><dt>地域识别</dt><dd>{paper.country} · {paper.country_confidence === "heuristic" ? "启发式匹配" : "未识别"}</dd><dt>开放获取</dt><dd>{paper.open_access?.label ?? "状态未知"}</dd></dl><div className="drawer-actions"><a href={paper.pubmed_url} target="_blank" rel="noreferrer">查看 PubMed ↗</a>{paper.open_access?.landing_url && <a href={paper.open_access.landing_url} target="_blank" rel="noreferrer">查看合法全文 ↗</a>}</div></aside></div>; }

export default App;
