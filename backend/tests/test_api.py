from fastapi.testclient import TestClient

from app.main import app


def test_health_does_not_expose_configuration() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "biolit-lens-api"}


def test_create_analysis_validates_record_limit() -> None:
    client = TestClient(app)
    response = client.post("/api/v1/analyses", json={"query": "cancer", "maxRecords": 99})
    assert response.status_code == 422

