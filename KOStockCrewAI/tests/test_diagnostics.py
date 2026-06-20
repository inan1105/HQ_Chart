"""
test_diagnostics.py
-------------------
진단 모듈의 구조 테스트. live=False 라 외부 호출 없음.
키가 없는 환경에서도 안전하게 표준 구조를 반환하는지 확인.
"""

from app.core.diagnostics import diagnose


def test_diagnose_structure_offline():
    """live=False 점검 결과가 표준 구조를 갖는지 확인."""
    result = diagnose(live=False)
    assert result["live_check"] is False
    services = result["services"]
    # 다섯 개 서비스가 모두 있어야 한다
    for name in ("openai", "dart", "ecos", "koscom", "database"):
        assert name in services
        st = services[name]
        # 각 항목은 표준 키를 가진다
        assert set(st.keys()) == {"configured", "reachable", "detail"}
        assert isinstance(st["configured"], bool)
        assert isinstance(st["detail"], str)


def test_diagnose_does_not_leak_keys():
    """응답 어디에도 실제 키 값처럼 보이는 문자열이 노출되지 않아야 한다."""
    result = diagnose(live=False)
    text = str(result)
    # 점검 결과는 설정 여부/상세 메시지만 담아야 한다
    assert "sk-" not in text
