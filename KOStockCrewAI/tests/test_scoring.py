"""
test_scoring.py
---------------
scoring 모듈의 점수 계산 로직을 단위 테스트합니다.
외부 API/DB 호출이 전혀 없습니다.
"""

from app.analysis.scoring import compute_scores, _rating_from_score, WEIGHTS


def test_weights_sum_to_one():
    """가중치 합이 1.0 인지 확인."""
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_compute_scores_high():
    """모든 점수가 높으면 STRONG_BUY 가 나와야 함."""
    result = compute_scores(90, 90, 90, 90)
    assert result["total_score"] == 90.0
    assert result["rating"] == "STRONG_BUY"
    # 리스크는 낮아야 함
    assert result["risk_score"] <= 20


def test_compute_scores_low():
    """모든 점수가 낮으면 RISK 등급, 리스크 점수는 높아야 함."""
    result = compute_scores(10, 10, 10, 10)
    assert result["rating"] == "RISK"
    assert result["risk_score"] >= 80


def test_compute_scores_neutral():
    """중립(50점)이면 HOLD 근처 등급이어야 함."""
    result = compute_scores(50, 50, 50, 50)
    assert result["total_score"] == 50.0
    assert result["rating"] == "HOLD"


def test_invalid_input_is_neutralized():
    """숫자가 아닌 입력은 중립(50)으로 처리되어 오류 없이 계산되어야 함."""
    result = compute_scores("oops", None, 50, 50)  # type: ignore
    assert 0 <= result["total_score"] <= 100


def test_rating_boundaries():
    """등급 경계값이 의도대로 매핑되는지 확인."""
    assert _rating_from_score(75) == "STRONG_BUY"
    assert _rating_from_score(62) == "BUY"
    assert _rating_from_score(48) == "HOLD"
    assert _rating_from_score(38) == "WATCH"
    assert _rating_from_score(10) == "RISK"
