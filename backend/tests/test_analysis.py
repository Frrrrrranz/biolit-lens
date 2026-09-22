from app.schemas import Paper
from app.services.analysis import detect_country, tokenize


def test_detect_country_keeps_unknown_visible() -> None:
    assert detect_country("Department of Biology, Tsinghua University, Beijing, China")[0] == "中国"
    assert detect_country("A fictional affiliation")[0] == "未知"


def test_title_has_double_weight() -> None:
    papers = [Paper(pmid="1", title="Cancer pathway", abstract="Pathway study", pubmed_url="https://pubmed.ncbi.nlm.nih.gov/1/")]
    counts = tokenize(papers)
    assert counts["pathway"] == 3

