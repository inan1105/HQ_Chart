from fastapi import APIRouter, Request

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/signal")
async def incoming_signal(request: Request):
    payload = await request.json()

    return {
        "received": True,
        "payload": payload
    }
