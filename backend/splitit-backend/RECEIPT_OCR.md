# Receipt extraction and itemized expenses

The itemized-expense screen sends a selected JPG, PNG, or WEBP image to the authenticated `POST /api/receipts/extract` endpoint.

## Processing pipeline

1. FastAPI accepts only JPEG, PNG, and WEBP uploads, reads at most 10 MB plus one byte, and always closes the temporary upload.
2. Pillow applies EXIF orientation, pixel-count limits, resizing, contrast enhancement, and sharpening in memory.
3. RapidOCR (ONNX Runtime) detects text boxes, text and confidence scores. The server groups detections into physical receipt rows while retaining mean confidence.
4. A separate, dependency-light parser interprets merchant, date, currency, item rows, quantities, unit prices, subtotal, taxes, discounts and printed total.
5. The API returns an editable draft. It does not create files, database rows, storage objects, or OCR history.

The ONNX OCR model is cached once per worker. OCR calls on that worker are serialized. Receipt-specific bytes and text are not cached.

## Response fields

The response includes:

- `merchant_name`, `date` (ISO `YYYY-MM-DD`), and `currency`.
- `currency_detected` to distinguish a visible currency marker from the India-first INR fallback.
- `line_items[]`: `name`, `quantity`, `unit_price`, `line_total`, and OCR `confidence`.
- `subtotal`, `subtotal_source`, `tax`, `discount`, `total_amount`, and `total_amount_source`.
- Overall item confidence, processing duration, OCR engine and parser warnings.

Example:

```json
{
  "merchant_name": "Example Cafe",
  "date": "2026-11-03",
  "line_items": [
    { "name": "Coffee", "quantity": 2, "unit_price": 60.0, "line_total": 120.0, "confidence": 0.96 }
  ],
  "subtotal": 120.0,
  "subtotal_source": "printed",
  "tax": 6.0,
  "discount": null,
  "total_amount": 126.0,
  "total_amount_source": "printed",
  "currency": "INR",
  "currency_detected": true,
  "warnings": []
}
```

## Accuracy and user confirmation

Receipt layouts are not standardised. The parser handles common POS-style rows, quantity/rate/line-total columns, Indian and Western comma grouping, date formats, GST components, discounts, and summary totals. It uses OCR positions and confidence rather than treating every trailing number as a price.

This is still heuristic parsing, not a trained receipt-understanding model. It flags low-confidence or unreconciled values rather than silently claiming certainty. The itemized screen shows the printed total and blocks saving while the editable item/tax/discount calculation differs from that printed total. Review every item and participant assignment.

For an unfamiliar currency, OCR results are not auto-applied to the INR form; convert the values manually first. If a currency marker is absent, INR is assumed with a warning.

## Persistence and privacy

The image is sent to the backend for temporary extraction. It is not uploaded to Supabase Storage and no extracted OCR payload is stored. The expense submission sends only the final description, total, date, group and participant split amounts. Receipt attachments are not currently retained with saved expenses.

## Tests

Run the parser tests without installing the OCR model:

```bash
cd backend/splitit-backend
python -m unittest discover -s tests -v
```

The parser test suite is also run by the GitHub Actions workflow for this receipt branch.
