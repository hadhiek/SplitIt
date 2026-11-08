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


## Receipt-specific parsing alternatives considered

The current implementation stays offline and keeps RapidOCR as the text-recognition layer, with a separate parser that we can test and tune without external credentials. If real receipt photos still produce too many corrections, the next meaningful upgrade is a receipt-trained/document-understanding parser rather than adding more regular expressions.

- **Amazon Textract AnalyzeExpense (cloud):** receipt/invoice-aware output with separate `SummaryFields` and `LineItemGroups`, including normalized `ITEM`, `QUANTITY`, and `PRICE` detections. It also returns OCR geometry and confidence. This is a strong candidate for an optional cloud provider. Documentation: https://docs.aws.amazon.com/textract/latest/dg/expensedocuments.html
- **Azure AI Document Intelligence prebuilt receipt (cloud):** receipt-specific structured extraction for merchant, transaction date, tax, total, and item arrays with name, quantity, unit price and total price. Version 4.0 GA also exposes tax-detail and country/region fields. It requires an Azure Document Intelligence resource and sends the image to Azure. Documentation: https://learn.microsoft.com/azure/ai-services/document-intelligence/prebuilt/receipt?view=doc-intel-4.0.0
- **PaddleOCR PP-Structure (local):** a heavier local route for layout analysis and table extraction. It could help on dense multi-column invoices, but adds runtime/model weight and still needs a business parser for receipt totals and splits.
- **RapidOCR package maintenance:** this branch still uses the existing `rapidocr-onnxruntime` dependency to avoid an untested OCR-engine swap during the parser fix. Current RapidOCR documentation says the `rapidocr_onnxruntime`, `rapidocr_openvino`, and `rapidocr_paddle` packages are gradually being retired in favour of the consolidated `rapidocr` package. Schedule that API/dependency migration as a separate smoke-tested change: https://rapidai.github.io/RapidOCRDocs/main/en/install_usage/rapidocr/install/

The cloud options are not enabled in this PR. They need a provider decision, secrets management, cost controls, retention/privacy review, and representative receipt tests. For the current offline version, the most valuable next validation is a small, diverse set of real receipts (thermal till slips, restaurant bills with GST, supermarket quantity/rate columns, faded photos, and long receipts), with expected item and total annotations.
