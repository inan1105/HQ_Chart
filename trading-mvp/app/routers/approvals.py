from fastapi import APIRouter, HTTPException

from app.services.approval_service import create_approval, approve, reject, review, get_approval

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/request")
def request_approval():
    decision = {
        "ticker": "NVDA",
        "direction": "BUY",
        "decision": "BUY",
        "score": 78
    }

    return create_approval(
        decision=decision,
        qty=10,
        limit_price=150,
        stop_loss=142,
        take_profit=170
    )


@router.get("/{approval_id}")
def read_approval(approval_id: str):
    result = get_approval(approval_id)
    if not result:
        raise HTTPException(status_code=404, detail="approval not found")
    return result


@router.post("/approve/{approval_id}")
def approve_request(approval_id: str):
    result = approve(approval_id)
    if not result:
        raise HTTPException(status_code=404, detail="approval not found")
    return result


@router.post("/reject/{approval_id}")
def reject_request(approval_id: str):
    result = reject(approval_id)
    if not result:
        raise HTTPException(status_code=404, detail="approval not found")
    return result


@router.post("/review/{approval_id}")
def review_request(approval_id: str):
    result = review(approval_id)
    if not result:
        raise HTTPException(status_code=404, detail="approval not found")
    return result
