import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any

import httpx

from app.config import Settings
from app.schemas import Paper


class UpstreamError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class PubMedClient:
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self.client = client

    def _params(self, **extra: str | int) -> dict[str, str | int]:
        params: dict[str, str | int] = {
            "tool": self.settings.ncbi_tool,
            "email": self.settings.ncbi_email,
        }
        if self.settings.ncbi_api_key:
            params["api_key"] = self.settings.ncbi_api_key
        params.update(extra)
        return params

    async def _get(self, endpoint: str, params: dict[str, str | int]) -> httpx.Response:
        own_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=15.0))
        try:
            for attempt in range(3):
                try:
                    response = await client.get(f"{self.base_url}/{endpoint}", params=params)
                    if response.status_code == 429 or response.status_code >= 500:
                        if attempt < 2:
                            retry_after = int(response.headers.get("Retry-After", "0") or 0)
                            await asyncio.sleep(max(retry_after, 2**attempt))
                            continue
                    response.raise_for_status()
                    return response
                except (httpx.TimeoutException, httpx.NetworkError) as exc:
                    if attempt == 2:
                        raise UpstreamError("UPSTREAM_TIMEOUT", "PubMed 请求超时或网络不可用") from exc
                    await asyncio.sleep(2**attempt)
            raise UpstreamError("NCBI_RATE_LIMITED", "PubMed 暂时限流，请稍后重试")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                raise UpstreamError("NCBI_RATE_LIMITED", "PubMed 暂时限流，请稍后重试") from exc
            raise UpstreamError("UPSTREAM_ERROR", "PubMed 返回了暂时不可用的响应") from exc
        finally:
            if own_client:
                await client.aclose()

    async def search(self, query: str, max_records: int) -> tuple[int, list[str]]:
        response = await self._get(
            "esearch.fcgi",
            self._params(db="pubmed", term=query, retmode="json", retmax=max_records, sort="relevance"),
        )
        try:
            data = response.json()["esearchresult"]
            count = int(data["count"])
            return count, [str(pmid) for pmid in data.get("idlist", [])]
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamError("UPSTREAM_ERROR", "无法解析 PubMed 检索结果") from exc

    async def fetch(self, pmids: list[str]) -> list[Paper]:
        if not pmids:
            return []
        response = await self._get(
            "efetch.fcgi",
            self._params(db="pubmed", id=",".join(pmids), retmode="xml"),
        )
        try:
            root = ET.fromstring(response.content)
        except ET.ParseError as exc:
            raise UpstreamError("UPSTREAM_ERROR", "无法解析 PubMed XML") from exc
        return [self._parse_article(article) for article in root.findall("PubmedArticle")]

    @staticmethod
    def _text(node: ET.Element | None) -> str | None:
        if node is None:
            return None
        return "".join(node.itertext()).strip() or None

    @classmethod
    def _parse_article(cls, article: ET.Element) -> Paper:
        medline = article.find("MedlineCitation")
        article_node = medline.find("Article") if medline is not None else None
        pmid = cls._text(medline.find("PMID") if medline is not None else None) or ""
        title = cls._text(article_node.find("ArticleTitle") if article_node is not None else None) or "Untitled"
        abstract_parts = [cls._text(item) for item in (article_node.findall("Abstract/AbstractText") if article_node is not None else [])]
        abstract = " ".join(part for part in abstract_parts if part)
        authors: list[str] = []
        affiliation: str | None = None
        for author in (article_node.findall("AuthorList/Author") if article_node is not None else []):
            last = cls._text(author.find("LastName"))
            initials = cls._text(author.find("Initials"))
            if last:
                authors.append(f"{last} {initials or ''}".strip())
            if affiliation is None:
                affiliation = cls._text(author.find("AffiliationInfo/Affiliation"))
        doi = None
        for identifier in article.findall("PubmedData/ArticleIdList/ArticleId"):
            if identifier.attrib.get("IdType") == "doi":
                doi = cls._text(identifier)
                break
        year, date = cls._extract_date(article_node)
        mesh_terms = [cls._text(item.find("DescriptorName")) for item in (medline.findall("MeshHeadingList/MeshHeading") if medline is not None else [])]
        mesh_terms = [item for item in mesh_terms if item]
        publication_types = [cls._text(item) for item in (article_node.findall("PublicationTypeList/PublicationType") if article_node is not None else [])]
        publication_types = [item for item in publication_types if item]
        journal = cls._text(article_node.find("Journal/Title")) if article_node is not None else None
        return Paper(
            pmid=pmid,
            doi=doi,
            title=title,
            abstract=abstract or None,
            authors=authors,
            affiliation=affiliation,
            journal=journal,
            published_date=date,
            year=year,
            mesh_terms=mesh_terms,
            publication_types=publication_types,
            pubmed_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        )

    @classmethod
    def _extract_date(cls, article: ET.Element | None) -> tuple[int | None, str | None]:
        if article is None:
            return None, None
        candidates = [
            article.find("ArticleDate"),
            article.find("Journal/JournalIssue/PubDate"),
        ]
        for node in candidates:
            if node is None:
                continue
            year_text = cls._text(node.find("Year")) or cls._text(node.find("MedlineDate"))
            if year_text:
                match = re.search(r"(19|20)\d{2}", year_text)
                if match:
                    return int(match.group(0)), year_text
        return None, None

