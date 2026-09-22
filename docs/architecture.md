# Architecture

BioLit Lens is a small two-process application. React/Vite renders the analysis workbench, while FastAPI owns all third-party access and the in-memory job lifecycle.

```text
React UI → POST /analyses → FastAPI background task
                              ├─ PubMed ESearch + EFetch
                              ├─ Europe PMC citation metadata
                              └─ deterministic statistics/report
React UI ← poll job/result ← FastAPI
```

The current demo keeps jobs and results in memory so it can start with one command. SQLite/TTL persistence, retry queues and reproducible snapshots belong to the v0.2 track. No full text is stored or proxied.

