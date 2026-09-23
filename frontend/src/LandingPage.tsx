import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const EXAMPLE_QUERY = "(CRISPR OR genome editing) AND cancer";
const QUICK_QUERIES = ["CRISPR and cancer", "single-cell RNA sequencing in immunology"];

interface LandingPageProps { initialQuery?: string; onStart: (query: string) => void; }

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { threshold: 0.16, rootMargin: "0px 0px -8%" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal-shell ${isVisible ? "is-visible" : ""} ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

export default function LandingPage({ initialQuery = EXAMPLE_QUERY, onStart }: LandingPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 64);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const normalizedQuery = query.trim(); if (normalizedQuery) onStart(normalizedQuery); }

  return <>
    <header className={`topbar${isScrolled ? " is-scrolled" : ""}`}>
      <div className="topbar-inner">
        <a className="brand" href="#top" aria-label="BioLit Lens 首页"><img className="brand-logo" src="/favicon.svg?v=ribbon-1" alt="" aria-hidden="true" />BioLit Lens</a>
        <nav className="topbar-nav" aria-label="主导航"><a href="#methodology">Methodology</a><a href="#sources">Data Sources</a><a href="#notice">Open Science</a><a href="https://github.com/Frrrrrranz/biolit-lens" target="_blank" rel="noreferrer">GitHub</a></nav>
        <a className="workspace-link" href="#workspace">Open workspace</a>
      </div>
    </header>

    <section className="hero" id="top">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-inner">
        <div className="eyebrow">PUBMED-NATIVE RESEARCH INTELLIGENCE</div>
        <h1>把一个问题，读成一张研究地图。</h1>
        <p className="hero-copy">检索 PubMed，梳理趋势、主题与开放证据，并让每个结论回到原始文献。</p>
        <form className="query-card" id="workspace" onSubmit={handleSubmit}><div className="query-row"><div className="query-input-wrap"><span className="query-icon" aria-hidden="true">⌕</span><input id="query" aria-label="PubMed 检索式" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：CRISPR 在癌症免疫治疗中的机制与临床转化" /></div><button className="landing-submit" type="submit">开始探索 <span aria-hidden="true">→</span></button></div></form>
        <div className="quick-queries"><span>探索示例：</span>{QUICK_QUERIES.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
      </div>
    </section>

    <MethodologySection />
    <Reveal className="full-section-reveal brief-reveal"><EvidenceBrief onExplore={() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "center" })} /></Reveal>
    <Reveal className="full-section-reveal sources-reveal"><DataSources /></Reveal>
    <Reveal className="full-section-reveal notice-reveal"><AcademicNotice /></Reveal>
    <footer className="footer"><div className="footer-identity"><strong>BioLit Lens</strong><p>让每个研究问题，都能回到原始文献。</p></div><nav className="footer-nav" aria-label="页脚导航"><a href="#top">返回顶部 ↑</a><a href="#methodology">研究方法</a><a href="#sources">数据来源</a></nav></footer>
  </>;
}

function MethodologySection() {
  return <section className="methodology" id="methodology"><Reveal className="section-intro-reveal"><div className="section-intro"><div className="section-kicker">/ HOW IT WORKS</div><h2>从检索到证据，分三步看清研究全貌。</h2><p>把一个研究问题拆成可检索、可比较、可回到原文的证据路径。</p></div></Reveal><div className="method-steps"><MethodStep number="01" label="ASK" title="提出你的科学设问" copy="从自然语言问题或完整 Boolean 检索式开始。系统保留检索式预览，帮助你检查关键词、字段和 MeSH 方向，再决定如何继续。" visual={<AskVisual />} /><MethodStep number="02" label="MAP" title="把结果展开成研究地图" copy="将 PubMed 摘要按出版年份、主题词、作者地域和开放状态整理为可读的结构，帮助你看见研究热度与分支，而不是只看单篇论文。" visual={<MapVisual />} reverse /><MethodStep number="03" label="TRACE" title="让每一句结论回到原始文献" copy="简报中的发现保留 PMID 与证据句关联。你可以从结论直接打开 PubMed，查看摘要、期刊和开放获取状态，降低无法追溯的生成风险。" visual={<TraceVisual />} /></div></section>;
}

function MethodStep({ number, label, title, copy, visual, reverse = false }: { number: string; label: string; title: string; copy: string; visual: ReactNode; reverse?: boolean }) {
  return <Reveal className="method-reveal"><article className={`method-step${reverse ? " reverse" : ""}`}><div className="method-visual">{visual}</div><div className="method-copy"><span className="method-number">{number}</span><span className="method-label">STAGE {number} · {label}</span><h3>{title}</h3><p>{copy}</p></div></article></Reveal>;
}

function AskVisual() { return <div className="demo-surface ask-demo"><div className="demo-card"><div className="demo-card-head"><span className="signal-dot" /> <span>E-UTILITIES · ME-SH ENGINE</span><b>QUERY PREVIEW</b></div><div className="demo-field"><small>NATURAL LANGUAGE QUESTION</small><p>How does base editing minimize off-target breaks?</p></div><div className="demo-chip-row"><small>RESOLVED DIRECTIONS</small><div><span>CRISPR-Cas Systems</span><span>Gene Editing</span><span>Off-Target Effects</span></div></div><code><i>QUERY:</i> (Base Editing[Title/Abstract]) AND (Fidelity[MeSH])</code></div></div>; }
function MapVisual() { return <div className="demo-surface map-demo"><div className="demo-card"><div className="demo-card-head"><span>THEME TOPOLOGY</span><b>n=2,184 records</b></div><div className="topology"><svg viewBox="0 0 380 150" aria-hidden="true"><path d="M35 40 160 92 280 38 345 104M160 92l56 35" /><circle cx="35" cy="40" r="5" /><circle cx="160" cy="92" r="6" /><circle cx="280" cy="38" r="5" /><circle cx="345" cy="104" r="5" /></svg><span className="node node-a">HDR/NHEJ Repair <b>26.4%</b></span><span className="node node-b">Lipid Nanoparticles <b>19.8%</b></span><span className="node node-c">Exhaustion Reversal <b>22.1%</b></span></div><div className="trend-mini"><small>5-YEAR PUBLICATION TRAJECTORY</small><div><i /><i /><i /><i /><i /></div></div></div></div>; }
function TraceVisual() { return <div className="demo-surface trace-demo"><div className="demo-card"><div className="demo-card-head"><span>↗ EVIDENCE-LINKED SYNTHESIS</span><b>PMID TRACEABLE</b></div><blockquote>Multiplex nucleotide editing shows lower off-target activity across primary T-cell models.</blockquote><div className="evidence-links"><a href="https://pubmed.ncbi.nlm.nih.gov/38210941/" target="_blank" rel="noreferrer">PMID 38210941 ↗</a><a href="https://pubmed.ncbi.nlm.nih.gov/37492150/" target="_blank" rel="noreferrer">PMID 37492150 ↗</a></div><div className="trace-foot"><span>Evidence sentence linked</span><b>Open access status</b></div></div></div>; }

function EvidenceBrief({ onExplore }: { onExplore: () => void }) { return <section className="evidence-brief"><div className="brief-context"><div className="section-kicker">/ SYNTHESIS OUTPUT SAMPLE</div><h2>从检索结果，到可核验的证据简报。</h2><p>参考系统综述的信息组织方式，把文献集的范围、主题和代表性发现放进同一张可读的工作面。</p><div className="brief-note"><span>↳</span><p>每个发现保留 PMID，方便快速回到 PubMed 摘要与原文入口。</p></div><button className="landing-cta" type="button" onClick={onExplore}>进入研究工作台 <span aria-hidden="true">→</span></button></div><div className="brief-paper"><div className="brief-paper-head"><div><small>LITERATURE BRIEF · 2025-081</small><h3>CRISPR &amp; Immuno-oncology Horizon</h3></div><span>INDEXED</span></div><div className="brief-metrics"><BriefMetric label="总记录" value="2,184" note="PubMed hits" /><BriefMetric label="主题簇" value="5" note="规则归纳" /><BriefMetric label="引用匹配" value="68.4%" note="Europe PMC" /></div><div className="brief-findings"><div className="brief-findings-title">DOMINANT SIGNALS <span>按证据回溯</span></div><BriefFinding theme="THEME 1 · EX VIVO ENHANCEMENT" count="842 篇" text="Base editing 在免疫细胞改造研究中呈现持续增长的应用趋势。" pmid="36581944" /><BriefFinding theme="THEME 2 · TARGET DELIVERY" count="591 篇" text="脂质纳米颗粒是近年递送方向中反复出现的研究节点。" pmid="35194208" /></div></div></section>; }
function BriefMetric({ label, value, note }: { label: string; value: string; note: string }) { return <div><small>{label}</small><strong>{value}</strong><span>{note}</span></div>; }
function BriefFinding({ theme, count, text, pmid }: { theme: string; count: string; text: string; pmid: string }) { return <article><div><b>{theme}</b><span>{count}</span></div><p>{text}</p><a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer">PMID {pmid} ↗</a></article>; }
function DataSources() { const sources = [{ label: "PRIMARY ARCHIVE", title: "PubMed / NLM", copy: "官方 E-Utilities 接口提供生物医学摘要与 PMID 索引。", status: "检索入口" }, { label: "CITATION GRAPH", title: "Europe PMC", copy: "补充开放引文网络与文章元数据，用于引用关系和影响力计算。", status: "引用网络" }, { label: "OPEN REPOSITORIES", title: "Unpaywall", copy: "定位出版商与机构仓储中的合规开放获取全文入口。", status: "OA 状态" }, { label: "DETERMINISTIC LINK", title: "PMID 关联", copy: "把发现、证据句和原始记录保持在同一条可核验链路上。", status: "证据回溯" }]; return <section className="sources" id="sources"><div className="section-intro"><div className="section-kicker">/ INTEGRITY &amp; EVIDENCE</div><h2>以证据为先，每一次检索都有据可循。</h2><p>连接公开学术基础设施，保留元数据来源与回溯路径。</p></div><div className="source-grid">{sources.map((source) => <article key={source.title}><small>{source.label}</small><h3>{source.title}</h3><p>{source.copy}</p><span>● {source.status}</span></article>)}</div></section>; }
function AcademicNotice() { return <section className="academic-notice" id="notice"><div className="notice-heading"><span className="section-kicker">/ OPEN SCIENCE</span><h2>开放证据，清晰边界。</h2></div><p>BioLit Lens 整理公开学术文献与元数据，帮助追溯研究线索。机构名称仅用于说明数据来源，不代表 NCBI、NLM 或 NIH 的官方意见；研究结果需结合原始论文判断，也不能替代专业临床评估。</p></section>; }
