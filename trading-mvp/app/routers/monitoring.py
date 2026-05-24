from fastapi import APIRouter

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Trading MVP"
    }
