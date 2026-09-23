import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import LandingPage from "./LandingPage";
import WorkspaceLoadBoundary from "./WorkspaceLoadBoundary";

type View = "landing" | "workspace";
function getInitialView(): View { return window.location.hash === "#workspace" ? "workspace" : "landing"; }

export default function AppShell() {
  const [view, setView] = useState<View>(getInitialView);
  const [query, setQuery] = useState("");
  const [workspaceLoadKey, setWorkspaceLoadKey] = useState(0);
  const Workspace = useMemo(() => lazy(() => import("./ResearchWorkspace")), [workspaceLoadKey]);

  useEffect(() => {
    function handlePopState() { setView(window.location.hash === "#workspace" && query ? "workspace" : "landing"); }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [query]);

  function handleStart(nextQuery: string) {
    setQuery(nextQuery);
    setView("workspace");
    window.history.pushState({ view: "workspace", query: nextQuery }, "", "#workspace");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleBack() { if (window.location.hash === "#workspace") window.history.back(); else setView("landing"); }
  function handleRetryWorkspace() { setWorkspaceLoadKey((previous) => previous + 1); }

  if (view === "workspace" && query) return <WorkspaceLoadBoundary key={workspaceLoadKey} query={query} onRetry={handleRetryWorkspace}><Suspense fallback={<WorkspaceFallback query={query} />}><Workspace query={query} onBack={handleBack} /></Suspense></WorkspaceLoadBoundary>;
  return <LandingPage initialQuery={query || undefined} onStart={handleStart} />;
}

function WorkspaceFallback({ query }: { query: string }) {
  return <section className="workspace-shell workspace-fallback" aria-live="polite"><div className="workspace-toolbar"><span className="workspace-back">← 返回首页</span><span className="workspace-query">PUBMED QUERY · <strong>{query}</strong></span></div><div className="fallback-header"><span className="section-kicker">/ LOADING WORKSPACE</span><h1>正在准备研究工作台</h1><p>加载分析表格、证据链和导出工具…</p></div><div className="fallback-grid"><div /><div /><div /></div></section>;
}
