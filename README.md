# BioLit Lens

PubMed 原生、中文优先、指标口径透明的科研趋势洞察工具。输入 PubMed 查询式，得到年份趋势、地域分布、研究方向、开放获取状态、开放引用 Top 100 和可回溯的中文领域快报。

> Unofficial project; not affiliated with NCBI/NLM. BioLit Lens is not medical advice and does not provide a systematic review or clinical recommendation.

## Quick start

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
pnpm install
pnpm --dir frontend dev
```

Open http://localhost:5173. The frontend expects the API at `http://localhost:8000`; set `VITE_API_BASE_URL` in `frontend/.env.local` to override it.

## Vercel demo

The repository includes `vercel.json` for the Vite frontend. Import the repository into Vercel and keep the project root at the repository root. Set this environment variable in the Vercel project:

```text
VITE_API_BASE_URL=https://your-public-backend.example.com
```

The FastAPI backend must be deployed separately with a public HTTPS URL and CORS configured to allow the Vercel domain. A Vercel-hosted frontend cannot call a backend that only runs on your local `localhost:8000`.

## Data and methodology

- PubMed E-utilities provide result counts and abstracts in batches.
- Europe PMC provides open citation counts and PMCID metadata.
- Unpaywall is queried only for DOI-based legal OA locations and only with an email address.
- The influence score is `ln(1 + citationCount) / sqrt(max(ageInYears, 1))`; it is not Journal Impact Factor.
- Geography means the first author's first affiliation when it can be identified; unknown values remain visible.
- The default report is deterministic and works without an LLM key.
- Ant Design supplies interaction-heavy components; the editorial layout, charts and topic cards retain the project's custom visual layer.

See [docs/methodology.md](docs/methodology.md) for the detailed data contract and limitations.

