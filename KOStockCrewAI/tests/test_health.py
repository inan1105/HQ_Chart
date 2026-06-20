"""
test_health.py
--------------
/health 엔드포인트와 root 엔드포인트가 정상 응답하는지 확인합니다.
외부 API 호출 없이 동작합니다(DB 연결 실패해도 status 는 ok 여야 함).
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_endpoint():
    """/health 가 200 과 status=ok 를 돌려주는지 확인."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "KOStockCrewAI"
    # database_connected 는 True/False 중 하나(불리언)여야 함
    assert isinstance(data["database_connected"], bool)


def test_root_endpoint():
    """루트(/) 가 사용법과 고지문을 포함하는지 확인."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "KOStockCrewAI"
    assert "disclaimer" in data
