"""Ephemeral receipt OCR endpoint. Uploaded bytes are processed in memory only."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from core.security import get_current_user_id
from services.receipt_extraction import extract_receipt

router = APIRouter(prefix="/api/receipts", tags=["receipt extraction"])

MAX_RECEIPT_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("/extract")
async def extract_receipt_endpoint(
    file: UploadFile = File(...),
    _user_id: str = Depends(get_current_user_id),
):
    """Extract structured receipt data without writing the upload or result anywhere."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WEBP receipt image.")

    contents = await file.read(MAX_RECEIPT_BYTES + 1)
    await file.close()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded receipt is empty.")
    if len(contents) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="Receipt image must be smaller than 10 MB.")

    try:
        return await run_in_threadpool(extract_receipt, contents)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Do not return OCR text, image bytes, or internal paths in API errors.
        raise HTTPException(status_code=500, detail="Receipt processing failed. Try a clearer image.") from exc
