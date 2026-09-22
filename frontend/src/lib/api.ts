import type { AnalysisJob, AnalysisResult } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: { message?: string } } | null;
    throw new Error(body?.detail?.message ?? `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export function createAnalysis(query: string, maxRecords: number): Promise<AnalysisJob> {
  return request<AnalysisJob>("/api/v1/analyses", {
    method: "POST",
    body: JSON.stringify({ query, maxRecords, useAiSummary: false }),
  });
}

export function getAnalysis(id: string): Promise<AnalysisJob> {
  return request<AnalysisJob>(`/api/v1/analyses/${id}`);
}

export function getResult(id: string): Promise<AnalysisResult> {
  return request<AnalysisResult>(`/api/v1/analyses/${id}/result`);
}

export function exportUrl(id: string, format: "csv" | "json" | "md"): string {
  return `${API_BASE_URL}/api/v1/analyses/${id}/export?format=${format}`;
}

