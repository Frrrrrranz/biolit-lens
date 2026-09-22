import asyncio
import os
from datetime import datetime, timezone
from urllib.parse import quote, urlparse

import httpx

from app.schemas import CitationMetric, OpenAccessLocation, Paper


class EuropePmcClient:
    base_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

    def __init__(self, client: httpx.AsyncClient | None = None, unpaywall_email: str | None = None) -> None:
        self.client = client
        self.unpaywall_email = unpaywall_email or os.getenv("UNPAYWALL_EMAIL")

    async def _unpaywall_location(self, client: httpx.AsyncClient, paper: Paper) -> dict[str, object] | None:
        if not paper.doi or not self.unpaywall_email:
            return None
        try:
            response = await client.get(
                f"https://api.unpaywall.org/v2/{quote(paper.doi, safe='')}",
                params={"email": self.unpaywall_email},
            )
            response.raise_for_status()
            location = response.json().get("best_oa_location")
            if not isinstance(location, dict):
                return None
            landing_url = location.get("url")
            pdf_url = location.get("url_for_pdf")
            if not isinstance(landing_url, str) or urlparse(landing_url).scheme != "https":
                return None
            if not isinstance(pdf_url, str) or urlparse(pdf_url).scheme != "https":
                pdf_url = None
            return {"location": location, "landing_url": landing_url, "pdf_url": pdf_url}
        except (httpx.HTTPError, ValueError):
            return None

    async def enrich(self, papers: list[Paper]) -> list[Paper]:
        if not papers:
            return papers
        own_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            for start in range(0, len(papers), 100):
                batch = papers[start : start + 100]
                query = " OR ".join(f"EXT_ID:{paper.pmid}" for paper in batch)
                try:
                    response = await client.get(self.base_url, params={"query": query, "format": "json", "pageSize": 100})
                    response.raise_for_status()
                    results = response.json().get("resultList", {}).get("result", [])
                    by_id = {str(item.get("pmid")): item for item in results if item.get("pmid")}
                except (httpx.HTTPError, ValueError):
                    by_id = {}
                checked_at = datetime.now(timezone.utc)
                for paper in batch:
                    item = by_id.get(paper.pmid, {})
                    citation_count = item.get("citedByCount")
                    if citation_count is not None:
                        citation_count = int(citation_count)
                    paper.citation = CitationMetric(pmid=paper.pmid, citation_count=citation_count, checked_at=checked_at)
                    pmcid = item.get("pmcid")
                    if pmcid:
                        paper.open_access = OpenAccessLocation(
                            pmid=paper.pmid, doi=paper.doi, status="open", label="PMC 开放全文", version="published", host_type="repository",
                            landing_url=f"https://europepmc.org/articles/{pmcid}", pdf_url=f"https://europepmc.org/articles/{pmcid}?pdf=render", source="Europe PMC", checked_at=checked_at,
                        )
                        continue
                    unpaywall = await self._unpaywall_location(client, paper)
                    if unpaywall:
                        location = unpaywall["location"]
                        host_type = str(location.get("host_type") or "")
                        label = "机构仓储版" if host_type == "repository" else "出版商开放版"
                        paper.open_access = OpenAccessLocation(
                            pmid=paper.pmid, doi=paper.doi, status="open", label=label,
                            license=str(location.get("license")) if location.get("license") else None,
                            version=str(location.get("version")) if location.get("version") else None,
                            host_type=host_type or None, landing_url=str(unpaywall["landing_url"]),
                            pdf_url=str(unpaywall["pdf_url"]) if unpaywall["pdf_url"] else None, source="Unpaywall", checked_at=checked_at,
                        )
                    else:
                        paper.open_access = OpenAccessLocation(
                            pmid=paper.pmid, doi=paper.doi,
                            status="unknown", label="未找到合法开放版本" if item.get("isOpenAccess") is False else "状态未知",
                            source="Europe PMC", checked_at=checked_at,
                        )
                await asyncio.sleep(0.05)
            return papers
        finally:
            if own_client:
                await client.aclose()

