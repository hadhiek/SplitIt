"""In-memory OCR and rule-based receipt parser inspired by common ReceiptIQ patterns.

No uploaded image, OCR output, or parsed receipt is written to disk or a database.
"""
from __future__ import annotations

import io
import re
from functools import lru_cache
from typing import Any

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rapidocr_onnxruntime import RapidOCR


MAX_IMAGE_PIXELS = 25_000_000
MAX_ITEMS = 80

@lru_cache(maxsize=1)
def _ocr_engine() -> RapidOCR:
    # The model is cached in process memory; receipt data is not cached.
    return RapidOCR()


def _prepare_image(image_bytes: bytes) -> np.ndarray:
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large. Choose a smaller image.")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((2400, 2400))
            if image.width < 1400:
                scale = min(2.0, 1400 / max(image.width, 1))
                image = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
            image = ImageOps.grayscale(image)
            image = ImageEnhance.Contrast(image).enhance(1.6)
            image = image.filter(ImageFilter.SHARPEN)
            return np.asarray(image.convert("RGB"))
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable receipt image.") from exc


def _join_ocr_lines(results: list[Any]) -> list[str]:
    """Group RapidOCR word boxes into physical text lines, ordered left-to-right."""
    words: list[tuple[float, float, float, str]] = []
    for entry in results or []:
        try:
            box, text, score = entry
            if not text or float(score) < 0.25:
                continue
            points = np.asarray(box, dtype=float)
            x1, x2 = float(points[:, 0].min()), float(points[:, 0].max())
            y1, y2 = float(points[:, 1].min()), float(points[:, 1].max())
            words.append(((y1 + y2) / 2, (y2 - y1), x1, str(text).strip()))
        except (TypeError, ValueError, IndexError):
            continue

    words.sort(key=lambda word: word[0])
    lines: list[dict[str, Any]] = []
    for center_y, height, x, text in words:
        target = None
        for line in reversed(lines[-4:]):
            tolerance = max(10.0, min(height, line["height"]) * 0.65)
            if abs(center_y - line["center"]) <= tolerance:
                target = line
                break
        if target is None:
            lines.append({"center": center_y, "height": height, "words": [(x, text)]})
        else:
            target["words"].append((x, text))
            count = len(target["words"])
            target["center"] = (target["center"] * (count - 1) + center_y) / count
            target["height"] = max(target["height"], height)

    lines.sort(key=lambda line: line["center"])
    return [" ".join(word for _, word in sorted(line["words"])) for line in lines]


MONEY_RE = re.compile(r"(?:₹|Rs\.?|INR\s*)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)\s*$", re.I)
TOTAL_LABELS = ("grand total", "amount due", "net amount", "total")
SUBTOTAL_LABELS = ("sub total", "subtotal", "sub-total")
TAX_LABELS = ("gst", "cgst", "sgst", "vat", "tax", "service charge")
DISCOUNT_LABELS = ("discount", "coupon", "savings")
IGNORE_START = re.compile(
    r"^(?:item|description|particulars|qty|quantity|rate|price|amount|hsn|sac|"
    r"invoice|receipt|bill no|date|time|cashier|phone|tel|address|gstin|"
    r"thank\s+you|www\.|http)",
    re.I,
)


def _amount(match: re.Match[str]) -> float | None:
    try:
        value = float(match.group(1).replace(",", ""))
        return value if value >= 0 else None
    except (ValueError, AttributeError):
        return None


def _parse_receipt(lines: list[str]) -> dict[str, Any]:
    merchant = next((line.strip() for line in lines[:6] if 2 <= len(line.strip()) <= 64 and not re.search(r"\b(tax invoice|receipt|bill no|gstin)\b", line, re.I)), "")
    date_value = None
    date_pattern = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b")
    for line in lines[:15]:
        match = date_pattern.search(line)
        if match:
            date_value = match.group(1)
            break

    subtotal = tax = discount = total = None
    items: list[dict[str, Any]] = []
    warnings: list[str] = []
    for line in lines:
        normalized = re.sub(r"\s+", " ", line).strip()
        lower = normalized.lower()
        money_match = MONEY_RE.search(normalized)
        value = _amount(money_match) if money_match else None

        if value is not None and any(label in lower for label in TOTAL_LABELS):
            total = value
            continue
        if value is not None and any(label in lower for label in SUBTOTAL_LABELS):
            subtotal = value
            continue
        if value is not None and any(label in lower for label in TAX_LABELS):
            tax = (tax or 0.0) + value
            continue
        if value is not None and any(label in lower for label in DISCOUNT_LABELS):
            discount = (discount or 0.0) + value
            continue
        if not money_match or value is None or value <= 0 or IGNORE_START.search(normalized):
            continue
        if re.search(r"\b(total|subtotal|balance|change|tendered|round off)\b", lower):
            continue

        name_part = normalized[:money_match.start()].strip(" :-|*•")
        if not name_part or len(name_part) > 100:
            continue
        quantity = 1
        qty_match = re.match(r"^(\d+(?:\.\d+)?)\s*[xX×]\s*(.+)$", name_part)
        if qty_match:
            try:
                quantity = max(1, int(float(qty_match.group(1))))
                name_part = qty_match.group(2).strip()
            except ValueError:
                pass
        # Keep the observed line amount as unit price for simple receipts.
        items.append({
            "name": name_part,
            "quantity": quantity,
            "unit_price": round(value / quantity, 2),
            "line_total": round(value, 2),
        })
        if len(items) >= MAX_ITEMS:
            warnings.append(f"Only the first {MAX_ITEMS} possible line items were returned.")
            break

    if not items:
        warnings.append("No confident line items were detected. Enter the items manually or try a sharper image.")
    if subtotal is not None and items:
        item_sum = sum(item["line_total"] for item in items)
        if abs(item_sum - subtotal) > max(2.0, subtotal * 0.05):
            warnings.append("The detected item sum differs from the printed subtotal; verify the line items.")
    if total is not None and subtotal is not None and tax is not None:
        expected = subtotal + tax - (discount or 0.0)
        if abs(expected - total) > max(2.0, total * 0.03):
            warnings.append("The printed subtotal, tax, discount and total do not reconcile; verify the amounts.")

    if total is None and subtotal is not None:
        total = round(subtotal + (tax or 0.0) - (discount or 0.0), 2)

    return {
        "merchant_name": merchant or None,
        "date": date_value,
        "line_items": items,
        "subtotal": round(subtotal, 2) if subtotal is not None else None,
        "tax": round(tax, 2) if tax is not None else None,
        "discount": round(discount, 2) if discount is not None else None,
        "total_amount": round(total, 2) if total is not None else None,
        "currency": "INR",
        "warnings": warnings,
    }


def extract_receipt(image_bytes: bytes) -> dict[str, Any]:
    image = _prepare_image(image_bytes)
    result, _elapsed = _ocr_engine()(image)
    lines = _join_ocr_lines(result or [])
    if not lines:
        raise ValueError("No readable text found. Try a sharper, well-lit image.")
    return _parse_receipt(lines)
