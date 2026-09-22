export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobStage = "validate" | "search" | "fetch" | "citations" | "analyze" | "report" | "done";

export interface AnalysisJob {
  id: string;
  query: string;
  max_records: number;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  processed_records: number;
  total_hits: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CitationMetric {
  pmid: string;
  citation_count: number | null;
  source: string;
  checked_at: string;
  influence_score: number | null;
}

export interface OpenAccessLocation {
  pmid: string;
  doi: string | null;
  status: string;
  label: string;
  license: string | null;
  version: string | null;
  host_type: string | null;
  landing_url: string | null;
  pdf_url: string | null;
  source: string | null;
  checked_at: string;
}

export interface Paper {
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  authors: string[];
  affiliation: string | null;
  country: string;
  country_confidence: string;
  journal: string | null;
  published_date: string | null;
  year: number | null;
  mesh_terms: string[];
  publication_types: string[];
  pubmed_url: string;
  citation: CitationMetric | null;
  open_access: OpenAccessLocation | null;
}

export interface TopicCluster {
  id: string;
  label: string;
  keywords: string[];
  paper_count: number;
  share: number;
  representative_pmids: string[];
}

export interface ReportFinding {
  text: string;
  pmids: string[];
}

export interface Report {
  title: string;
  scope: string;
  key_findings: ReportFinding[];
  limitations: string[];
  generated_by: string;
}

export interface AnalysisResult {
  total_hits: number;
  analyzed_count: number;
  query: string;
  retrieved_at: string;
  date_range: { from: string | null; to: string | null };
  year_distribution: Record<string, number>;
  geography_distribution: Record<string, number>;
  keyword_frequency: Array<{ term: string; count: number }>;
  mesh_frequency: Array<{ term: string; count: number }>;
  topics: TopicCluster[];
  top_papers: Paper[];
  data_quality: {
    analyzed_count: number;
    abstract_coverage: number;
    geography_coverage: number;
    citation_match_rate: number;
    open_access_match_rate: number;
  };
  report: Report;
  oa_status_distribution: Record<string, number>;
}

