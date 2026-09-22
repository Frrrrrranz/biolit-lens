import { useEffect, useMemo, useState } from "react";
import { ArrowRightOutlined, DownloadOutlined, GithubOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Dropdown, Empty, Input, Progress, Select, Space, Steps, Table, Tag, Tooltip, type MenuProps, type TableColumnsType } from "antd";
import { createAnalysis, exportUrl, getAnalysis, getResult } from "./lib/api";
import type { AnalysisJob, AnalysisResult, Paper } from "./types";

const EXAMPLE_QUERY = "(CRISPR OR genome editing) AND cancer";
const stageItems = ["检索 PubMed", "解析摘要", "补全开放引用", "统计与主题", "生成中文简报"];
const stageKeys: AnalysisJob["stage"][] = ["search", "fetch", "citations", "analyze", "report"];

function formatNumber(value: number): string { return new Intl.NumberFormat("zh-CN").format(value); }
function percent(value: number): string { return `${Math.round(value * 100)}%`; }
function currentStage(stage: AnalysisJob["stage"]): number { const index = stageKeys.indexOf(stage); return index < 0 ? 0 : index; }

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
    if (job) window.open(exportUrl(job.id, format), "_blank", "noopener,noreferrer");
  }

  const isWorking = job?.status === "queued" || job?.status === "running";
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BioLit Lens 首页"><span className="brand-mark">BL</span><span>BioLit <i>Lens</i></span></a>
        <div className="topbar-meta"><span className="status-dot" /><span>PubMed research intelligence</span><a href="https://github.com/Frrrrrranz/biolit-lens" target="_blank" rel="noreferrer"><GithubOutlined /> GitHub ↗</a></div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">/ 01 · FIND THE SIGNAL</div>
        <h1>把一条 PubMed 查询，<br /><em>变成一份可核验的洞察。</em></h1>
        <p className="hero-copy">输入关键词或完整 PubMed 检索式。BioLit Lens 从摘要元数据中提炼趋势、主题、地域和开放引用，并把每个结论连回 PMID。</p>
        <form className="query-card" onSubmit={handleSubmit}>
          <label htmlFor="query">PUBMED QUERY</label>
          <div className="query-row">
            <Input id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：CRISPR AND cancer" disabled={isWorking} variant="borderless" size="large" />
            <Button htmlType="submit" type="primary" size="large" disabled={isWorking || !query.trim()} icon={<ArrowRightOutlined />}>{isWorking ? "分析中…" : "开始分析"}</Button>
          </div>
          <div className="query-footer"><Button type="link" className="example-button" onClick={() => setQuery(EXAMPLE_QUERY)} disabled={isWorking}>使用示例查询</Button><label className="record-control">分析上限 <Select value={maxRecords} onChange={setMaxRecords} disabled={isWorking} options={[500, 1000, 2000, 5000].map((value) => ({ value, label: `${formatNumber(value)} 条` }))} variant="borderless" size="small" /></label><span>支持 Boolean / 字段语法</span></div>
        </form>
      </section>

      {error && <Alert className="alert error" type="error" showIcon closable message="分析未完成" description={error} onClose={() => setError(null)} />}
      {job && !result && <ProgressPanel job={job} />}
      {result && <Dashboard result={result} onSelectPaper={setSelectedPaper} onDownload={handleDownload} years={sortedYears} />}
      <PaperDrawer paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      <footer className="footer"><span>BioLit Lens · v0.1</span><span>非 NCBI 官方产品 · 非医疗建议</span><span>数据源：PubMed · Europe PMC · Unpaywall</span></footer>
    </main>
  );
}

function ProgressPanel({ job }: { job: AnalysisJob }) {
  const failed = job.status === "failed";
  return <section className="progress-panel" aria-live="polite"><div className="section-kicker">/ LIVE PIPELINE</div><div className="progress-header"><div><h2>{failed ? "这次分析遇到问题" : "正在把文献变成信号"}</h2><p>{failed ? job.error_message : `已处理 ${formatNumber(job.processed_records)} 条${job.total_hits ? ` / 总命中 ${formatNumber(job.total_hits)} 条` : ""}`}</p></div><span className="progress-value">{failed ? "!" : `${job.progress}%`}</span></div><Progress percent={failed ? 0 : job.progress} showInfo={false} status={failed ? "exception" : "active"} /><Steps className="analysis-steps" current={failed ? 0 : currentStage(job.stage)} status={failed ? "error" : job.status === "completed" ? "finish" : "process"} size="small" items={stageItems.map((title) => ({ title }))} /></section>;
}

interface DashboardProps { result: AnalysisResult; onSelectPaper: (paper: Paper) => void; onDownload: (format: "csv" | "json" | "md") => void; years: Array<[string, number]>; }
function Dashboard({ result, onSelectPaper, onDownload, years }: DashboardProps) {
  const maxYearCount = Math.max(...years.map(([, value]) => value), 1); const geography = Object.entries(result.geography_distribution).slice(0, 8); const maxGeoCount = Math.max(...geography.map(([, value]) => value), 1);
  const downloadItems: MenuProps["items"] = [{ key: "md", label: "Markdown" }, { key: "csv", label: "Top 100 CSV" }, { key: "json", label: "完整 JSON" }];
  const columns: TableColumnsType<Paper> = [
    { title: "论文", key: "paper", width: "46%", render: (_, paper) => <><Button type="link" className="paper-title" onClick={() => onSelectPaper(paper)}>{paper.title}</Button><small>PMID {paper.pmid}</small></> },
    { title: "年份 / 期刊", key: "journal", render: (_, paper) => <>{paper.year ?? "未知"}<small>{paper.journal ?? "—"}</small></> },
    { title: <Tooltip title="ln(1 + citationCount) / sqrt(max(ageInYears, 1))">开放引用 ⓘ</Tooltip>, key: "citation", render: (_, paper) => <><strong>{paper.citation?.citation_count ?? "—"}</strong><small>{paper.citation?.influence_score !== null && paper.citation?.influence_score !== undefined ? `score ${paper.citation.influence_score}` : "暂无数据"}</small></> },
    { title: "OA 状态", key: "oa", render: (_, paper) => <Tag color={paper.open_access?.status === "open" ? "success" : "default"}>{paper.open_access?.label ?? "状态未知"}</Tag> },
    { title: "", key: "url", render: (_, paper) => <a className="external-link" href={paper.pubmed_url} target="_blank" rel="noreferrer" aria-label={`打开 PMID ${paper.pmid}`}>↗</a> },
  ];
  return <section className="dashboard">
    <div className="dashboard-heading"><div><div className="section-kicker">/ ANALYSIS REPORT</div><h2>你的文献地图，已经就位。</h2><p className="muted">检索式：<code>{result.query}</code> · 更新时间 {new Date(result.retrieved_at).toLocaleString("zh-CN")}</p></div><Dropdown menu={{ items: downloadItems, onClick: ({ key }) => onDownload(key as "csv" | "json" | "md") }}><Button icon={<DownloadOutlined />}>导出结果</Button></Dropdown></div>
    <div className="metric-grid"><Metric label="总命中数" value={formatNumber(result.total_hits)} note="PubMed ESearch count" accent="mint" /><Metric label="实际分析" value={formatNumber(result.analyzed_count)} note="摘要元数据样本" /><Metric label="时间跨度" value={`${result.date_range.from ?? "—"} — ${result.date_range.to ?? "—"}`} note="可解析出版年份" /><Metric label="摘要覆盖率" value={percent(result.data_quality.abstract_coverage)} note="解析到摘要的样本" /></div>
    <div className="quality-strip"><div><span>地域识别</span><b>{percent(result.data_quality.geography_coverage)}</b></div><div><span>开放引用匹配</span><b>{percent(result.data_quality.citation_match_rate)}</b></div><div><span>合法 OA 识别</span><b>{percent(result.data_quality.open_access_match_rate)}</b></div><div className="quality-note">缺失数据会被标记，不会静默当作 0。</div></div>
    <div className="two-column"><section className="panel trend-panel"><PanelTitle eyebrow="PUBLICATION TREND" title="发文节奏" detail="每年可解析出版记录" />{years.length ? <div className="bar-chart" aria-label="年度发文量柱状图">{years.slice(-15).map(([year, count]) => <div className="bar-column" key={year}><span className="bar-value">{count}</span><div className="bar" style={{ height: `${Math.max(8, count / maxYearCount * 100)}%` }} /><span className="bar-label">{year.slice(-2)}</span></div>)}</div> : <Empty description="暂无年份数据" />}</section><section className="panel geography-panel"><PanelTitle eyebrow="FIRST AUTHOR AFFILIATION" title="地域分布" detail="第一作者第一条机构 affiliation" /><div className="horizontal-bars">{geography.map(([country, count]) => <div className="h-bar-row" key={country}><div className="h-bar-label"><span>{country}</span><b>{count}</b></div><div className="h-bar-track"><span style={{ width: `${count / maxGeoCount * 100}%` }} /></div></div>)}</div></section></div>
    <div className="two-column topics-row"><section className="panel topics-panel"><PanelTitle eyebrow="RESEARCH DIRECTIONS" title="研究方向" detail="规则归纳 · 需人工核验" />{result.topics.length ? <div className="topic-grid">{result.topics.map((topic, index) => <article className="topic-card" key={topic.id}><span className="topic-index">0{index + 1}</span><h3>{topic.label}</h3><p>{topic.keywords.join(" · ")}</p><div className="topic-footer"><b>{topic.paper_count}</b> 条样本 <span>{percent(topic.share)}</span></div></article>)}</div> : <Empty description="暂未形成主题" />}</section><section className="panel word-panel"><PanelTitle eyebrow="TITLE + ABSTRACT" title="高频信号" detail="标题权重 ×2 · 摘要权重 ×1" /><div className="word-cloud">{result.keyword_frequency.slice(0, 18).map((item, index) => <span key={item.term} className={`word-size-${index % 5}`}>{item.term}</span>)}</div><div className="mesh-line"><span>MeSH</span>{result.mesh_frequency.slice(0, 4).map((item) => <b key={item.term}>{item.term}</b>)}</div></section></div>
    <section className="panel report-panel"><div className="report-header"><div><PanelTitle eyebrow="CHINESE BRIEF" title={result.report.title} detail={result.report.generated_by} /></div><span className="report-stamp">PMID<br /><b>TRACEABLE</b></span></div><p className="report-scope">{result.report.scope}</p><div className="finding-list">{result.report.key_findings.map((finding, index) => <div className="finding" key={finding.text}><span>0{index + 1}</span><p>{finding.text}</p><div className="pmid-chips">{finding.pmids.map((pmid) => <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer" key={pmid}>PMID {pmid} ↗</a>)}</div></div>)}</div><div className="limitations"><b>局限性</b>{result.report.limitations.map((item) => <span key={item}>{item}</span>)}</div></section>
    <section className="panel papers-panel"><div className="papers-header"><PanelTitle eyebrow="OPEN CITATION SIGNAL" title="近 5 年高影响力文献" detail="开放引用 · 年龄校正分数 · 不是 Journal Impact Factor" /><div className="source-pill">Europe PMC · {formatNumber(result.top_papers.length)} 条</div></div><div className="paper-table-wrap"><Table className="paper-table" rowKey="pmid" columns={columns} dataSource={result.top_papers.slice(0, 20)} pagination={false} size="middle" locale={{ emptyText: <Empty description="暂无近五年论文" /> }} /></div></section>
  </section>;
}

function Metric({ label, value, note, accent = "" }: { label: string; value: string; note: string; accent?: string }) { return <div className={`metric-card ${accent}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PanelTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="panel-title"><div className="section-kicker">/ {eyebrow}</div><h2>{title}</h2><p>{detail}</p></div>; }
function PaperDrawer({ paper, onClose }: { paper: Paper | null; onClose: () => void }) { return <Drawer open={Boolean(paper)} onClose={onClose} width={560} title={paper ? `EVIDENCE · PMID ${paper.pmid}` : "论文证据"} footer={paper ? <Space><Button href={paper.pubmed_url} target="_blank">查看 PubMed ↗</Button>{paper.open_access?.landing_url && <Button type="primary" href={paper.open_access.landing_url} target="_blank">查看合法全文 ↗</Button>}</Space> : null}>{paper && <div className="paper-drawer-content"><h2>{paper.title}</h2><div className="drawer-meta">{paper.year ?? "未知年份"} · {paper.journal ?? "未知期刊"}</div><p>{paper.abstract ?? "该记录没有可用摘要。"}</p><dl><dt>第一作者机构</dt><dd>{paper.affiliation ?? "未提供"}</dd><dt>地域识别</dt><dd>{paper.country} · {paper.country_confidence === "heuristic" ? "启发式匹配" : "未识别"}</dd><dt>开放获取</dt><dd>{paper.open_access?.label ?? "状态未知"}</dd></dl></div>}</Drawer>; }

export default App;
