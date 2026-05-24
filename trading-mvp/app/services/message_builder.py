def build_approval_message(approval: dict) -> str:
    lines = [
        "[투자판단 승인 요청]",
        "",
        f"종목: {approval['ticker']}",
        f"방향: {approval['direction']}",
        f"판단: {approval['decision']}",
        f"점수: {approval['score']}",
        "",
        f"수량: {approval['qty']}",
        f"지정가: {approval['limit_price']}",
        f"손절가: {approval['stop_loss']}",
        f"목표가: {approval['take_profit']}",
        "",
        f"승인: /approve {approval['approval_id']}",
        f"거절: /reject {approval['approval_id']}",
        f"재검토: /review {approval['approval_id']}",
    ]
    return "\n".join(lines)
