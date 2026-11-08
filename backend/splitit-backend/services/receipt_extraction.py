"""In-memory RapidOCR service for receipt extraction.

The OCR model is cached per worker, but uploaded images and extracted receipt data
are never persisted by this service.
"""
from __future__ import annotations

import io
import logging
import time
from functools import lru_cache
from threading import Lock
from typing import Any

from services.receipt_parser import MAX_ITEMS, parse_receipt_lines


logger = logging.getLogger(__name__)

MAX_IMAGE_PIXELS = 25_000_000
MAX_IMAGE_SIZE = (2000, 2800)
_OCR_LOCK = Lock()


@lru_cache(maxsize=1)
def _ocr_engine():
    # Avoid importing the native OCR runtime during API startup. The browser
    # performs receipt OCR for current clients; this remains a lazy fallback
    # for older clients that still call the legacy endpoint.
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


def _prepare_image(image_bytes: bytes) -> np.ndarray:
    """Decode safely, correct phone orientation and improve print contrast."""
    try:
        import numpy as np
        from PIL import Image, ImageEnhance, ImageFilter, ImageOps

        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.width <= 0 or source.height <= 0:
                raise ValueError("The receipt image has invalid dimensions.")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large. Choose a smaller image.")
            image = ImageOps.exif_transpose(source).convert("RGB")
            # Bound the pixel count before OCR. Upscaling small phone images
            # increases inference time without restoring detail that is not there.
            image.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)

            image = ImageOps.grayscale(image)
            image = ImageEnhance.Contrast(image).enhance(1.5)
            image = image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=3))
            # RapidOCR's ONNX wrapper accepts a NumPy image. Convert grayscale
            # back to three channels for consistent model input.
            return np.asarray(image.convert("RGB"))
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable receipt image.") from exc


def _join_ocr_lines(results: list[Any]) -> tuple[list[str], list[float]]:
    """Group word detections into physical rows, preserving mean confidence."""
    words: list[tuple[float, float, float, str, float]] = []
    for entry in results or []:
        try:
            box, text, score = entry
            confidence = float(score)
            if not text or confidence < 0.15:
                continue
            points = np.asarray(box, dtype=float)
            if points.ndim != 2 or points.shape[0] < 4 or points.shape[1] < 2:
                continue
            x1 = float(points[:, 0].min())
            y1 = float(points[:, 1].min())
            y2 = float(points[:, 1].max())
            height = max(1.0, y2 - y1)
            center_y = (y1 + y2) / 2
            words.append((center_y, height, x1, str(text).strip(), confidence))
        except (TypeError, ValueError, IndexError):
            continue

    words.sort(key=lambda word: (word[0], word[2]))
    rows: list[dict[str, Any]] = []
    for center_y, height, x, text, confidence in words:
        target = None
        # Nearby boxes usually belong to the same printed row. Looking back
        # only a few rows avoids merging two columns on a dense receipt.
        for row in reversed(rows[-4:]):
            tolerance = max(8.0, min(height, row["height"]) * 0.55)
            if abs(center_y - row["center"]) <= tolerance:
                target = row
                break

        if target is None:
            rows.append({
                "center": center_y,
                "height": height,
                "words": [(x, text, confidence)],
            })
            continue

        target["words"].append((x, text, confidence))
        count = len(target["words"])
        target["center"] = (target["center"] * (count - 1) + center_y) / count
        target["height"] = max(target["height"], height)

    rows.sort(key=lambda row: row["center"])
    lines: list[str] = []
    confidences: list[float] = []
    for row in rows:
        ordered = sorted(row["words"], key=lambda item: item[0])
        lines.append(" ".join(item[1] for item in ordered))
        confidences.append(sum(item[2] for item in ordered) / len(ordered))
    return lines, confidences


def extract_receipt(image_bytes: bytes) -> dict[str, Any]:
    """Run OCR and return a reviewable, structured receipt draft."""
    started = time.perf_counter()
    image = _prepare_image(image_bytes)
    preprocessed_at = time.perf_counter()
    # The cached pipeline is shared within this worker. Serialize calls to avoid
    # mutable preprocessing state being shared across concurrent requests.
    with _OCR_LOCK:
        engine = _ocr_engine()
        engine_ready_at = time.perf_counter()
        result, elapsed = engine(image)
    finished_at = time.perf_counter()
    logger.info(
        "Receipt OCR timings: dimensions=%sx%s preprocess=%.2fs model_ready=%.2fs "
        "inference=%.2fs total=%.2fs",
        image.shape[1],
        image.shape[0],
        preprocessed_at - started,
        engine_ready_at - preprocessed_at,
        finished_at - engine_ready_at,
        finished_at - started,
    )
    lines, confidences = _join_ocr_lines(result or [])
    if not lines:
        raise ValueError("No readable text found. Try a sharper, well-lit image.")

    parsed = parse_receipt_lines(lines, confidences)
    parsed["ocr_engine"] = "RapidOCR (ONNX Runtime)"
    try:
        parsed["processing_seconds"] = round(float(elapsed), 2)
    except (TypeError, ValueError):
        parsed["processing_seconds"] = None
    if len(parsed.get("line_items", [])) > MAX_ITEMS:
        parsed["line_items"] = parsed["line_items"][:MAX_ITEMS]
    return parsed
