# Temporary receipt extraction

The itemized-expense screen sends the selected JPG, PNG, or WEBP image to the authenticated `POST /api/receipts/extract` endpoint.

## Runtime

Install backend dependencies from `backend/splitit-backend`:

```bash
pip install -r requirements.txt
```

RapidOCR initializes its ONNX model on the first extraction request. The model is kept in process memory for reuse; receipt-specific data is not cached.

## Data handling

- The endpoint validates MIME type and enforces a 10 MB limit.
- Image bytes are read for the request, preprocessed in memory, passed to RapidOCR, parsed, and returned as JSON.
- The endpoint does not create receipt files, database rows, storage objects, or OCR history.
- The endpoint closes the uploaded file after reading it. FastAPI/Starlette may use a temporary spooled upload internally while receiving multipart data; it is closed after the request and is not retained as an application file.
- The returned line items remain in the React form state for user review. The existing expense submission sends only the expense total and participant splits; it does not send the image or extracted OCR payload.

## Response shape

```json
{
  "merchant_name": "Example Cafe",
  "date": "03/11/2026",
  "line_items": [
    { "name": "Coffee", "quantity": 1, "unit_price": 120.0, "line_total": 120.0 }
  ],
  "subtotal": 120.0,
  "tax": 6.0,
  "discount": null,
  "total_amount": 126.0,
  "currency": "INR",
  "warnings": []
}
```

OCR is heuristic. Users must verify extracted names, quantities, tax, discounts, and prices before saving an expense.
