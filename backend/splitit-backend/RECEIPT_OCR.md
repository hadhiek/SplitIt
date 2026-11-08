# Receipt extraction and itemized expenses

## Current client flow

The itemized-expense screen performs OCR in the browser/on-device using Tesseract.js. Receipt images are not uploaded to Render for scanning. The frontend build prepares and serves the Tesseract.js worker, WebAssembly core files, and English language data from the app's own /ocr static path. Scanning therefore does not require a third-party CDN at runtime.

1. The user selects a JPG, PNG, or WEBP image (maximum 10 MB).
2. The browser decodes and bounds the image to approximately 8 megapixels before recognition.
3. A reusable Tesseract.js worker recognises the receipt and returns structured blocks, lines, words, bounding boxes, and confidence.
4. The browser parser uses row/column positions where headers are present; it filters common invoice identifiers and summary rows, and only infers quantity/rate when evidence is adequate.
5. The UI fills an editable draft. The user must review the items, quantities, prices, tax, discount, printed total, and participant assignments before saving.
6. The existing expense API receives only the final expense fields and per-person split amounts. The receipt image and OCR payload are not sent or persisted.

## Compatibility endpoint

POST /api/receipts/extract remains available as a legacy fallback for previously installed clients. It accepts JPEG, PNG, and WEBP uploads up to 10 MB, processes them in memory using RapidOCR (ONNX Runtime), and returns the same general editable-draft shape. Current frontend builds do not call this endpoint.

The legacy OCR model is loaded lazily on the first legacy request rather than during normal FastAPI startup. The model is cached per worker and OCR calls on that worker are serialized. Receipt-specific bytes and text are not cached or stored.

## Parsed fields

The on-device parser returns:

- merchant_name, date (ISO YYYY-MM-DD), and currency.
- currency_detected to distinguish a visible currency marker from the INR fallback.
- line_items[]: name, quantity, unit_price, line_total, and OCR confidence.
- subtotal, subtotal_source, tax, discount, total_amount, and total_amount_source.
- Overall confidence and warnings, including arithmetic mismatches and ambiguous rows.

## Accuracy and user confirmation

Receipt layouts are not standardised. The parser recognises common item/quantity/rate/amount headers and common quantity forms. When there are two unlabelled numeric fields, it does not guess which is quantity and which is price. Common invoice/order/GST identifiers, phone numbers, footer lines, and summary rows are excluded from line-item candidates.

This is still heuristic OCR parsing, not a receipt-trained document-understanding model. OCR confidence is not a guarantee of semantic correctness. The UI keeps the result editable and asks users to review all values; subtotal/printed-total mismatches are surfaced before saving.

English is the currently bundled OCR language. Receipts printed in other languages may have lower recognition accuracy. A future multilingual model should be added only with measured accuracy and mobile download-size trade-offs.

## Persistence and privacy

On-device OCR does not send the receipt image or raw OCR text to Render or Supabase. Expense submission sends only the final description, total, date, group and participant split amounts. Receipt attachments are not currently retained with saved expenses.

Legacy clients that explicitly call POST /api/receipts/extract still upload the image temporarily to Render for processing. The compatibility endpoint does not persist image bytes or OCR output.

## Tests

Run the frontend parser regression suite:

```bash
cd frontend
npm ci
npm run test:receipt-ocr
npm run build
```

Run the legacy backend parser tests:

```bash
cd backend/splitit-backend
python -m unittest discover -s tests -v
```

The frontend CI workflow runs local OCR asset preparation, parser tests, lint, and a production build.
