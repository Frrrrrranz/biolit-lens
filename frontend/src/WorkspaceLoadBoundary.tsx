import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorkspaceLoadBoundaryProps { query: string; onRetry: () => void; children: ReactNode; }
interface WorkspaceLoadBoundaryState { error: Error | null; }

// React only exposes render-time error boundaries through a class component.
export default class WorkspaceLoadBoundary extends Component<WorkspaceLoadBoundaryProps, WorkspaceLoadBoundaryState> {
  state: WorkspaceLoadBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WorkspaceLoadBoundaryState { return { error }; }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {}

  render() {
    if (this.state.error) {
      return <section className="workspace-shell workspace-error" role="alert"><div className="workspace-toolbar"><span className="workspace-back">← 返回首页</span><span className="workspace-query">PUBMED QUERY · <strong>{this.props.query}</strong></span></div><div className="workspace-error-card"><span className="section-kicker">/ WORKSPACE LOAD FAILED</span><h1>研究工作台暂时无法加载</h1><p>你的检索式已保留，可以重试加载工作台；不需要刷新页面。</p><button type="button" onClick={this.props.onRetry}>重试加载</button></div></section>;
    }
    return this.props.children;
  }
}
