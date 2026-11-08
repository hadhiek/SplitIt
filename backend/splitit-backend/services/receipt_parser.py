"""Layout-aware, offline receipt parsing helpers.

This module deliberately has no OCR dependency so the parser can be unit-tested
without loading the OCR model. OCR text and confidence are supplied by the
receipt-extraction service.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Sequence


MAX_ITEMS = 80
CENT = Decimal("0.01")

# Deliberately accepts Indian comma grouping (1,23,456.78) as well as western
# grouping (123,456.78). The value is normalised by removing commas.
MONEY_RE = re.compile(
    r"(?<![A-Za-z0-9])"
    r"(?P<currency>₹|Rs\.?|INR|USD|EUR|GBP|[$€£])?\s*"
    r"(?P<sign>[-−]?\s*)"
    r"(?P<amount>\d[\d,]*(?:\.\d{1,2})?)"
    r"(?:\s*/-)?"
    r"(?![A-Za-z0-9])"
    r"(?!\s*%)",
    re.IGNORECASE,
)
DATE_RE = re.compile(
    r"\b(?:"
    r"\d{4}[/-]\d{1,2}[/-]\d{1,2}|"
    r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
    r"\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|"
    r"[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}"
    r")\b"
)

SUBTOTAL_RE = re.compile(
    r"\b(?:sub\s*total|subtotal|sub-total|taxable\s+(?:value|amount))\b", re.I
)
TAX_RE = re.compile(
    r"\b(?:cgst|sgst|igst|gst|vat|tax|service\s+charge)\b", re.I
)
TAX_COMPONENT_RE = re.compile(r"\b(?:cgst|sgst|igst|vat)\b", re.I)
DISCOUNT_RE = re.compile(r"\b(?:discount|coupon|savings|less)\b", re.I)
TOTAL_LABELS = (
    (100, re.compile(r"\bgrand\s+total\b", re.I)),
    (95, re.compile(r"\b(?:amount|net)\s+(?:payable|due)\b", re.I)),
    (95, re.compile(r"\bpayable\s+amount\b", re.I)),
    (90, re.compile(r"\btotal\s+(?:payable|due|amount)\b", re.I)),
    (85, re.compile(r"\b(?:bill|invoice)\s+total\b", re.I)),
    (75, re.compile(r"\bnet\s+total\b", re.I)),
    (60, re.compile(r"\btotal\b", re.I)),
)
IGNORE_START_RE = re.compile(
    r"^(?:item|description|particulars|qty|quantity|rate|price|amount|"
    r"hsn|sac|invoice|receipt|bill\s*(?:no|number|date)|date|time|cashier|"
    r"phone|mobile|tel|address|gstin|pan|customer|table\s*no|"
    r"thank\s+you|www\.|https?://)",
    re.I,
)
FOOTER_RE = re.compile(
    r"\b(?:balance|change|tendered|paid\s+by|payment\s+mode|upi|"
    r"cash\s+received|round\s*off)\b",
    re.I,
)
CURRENCY_MARKERS = (
    (re.compile(r"₹|\bINR\b|\bRs\.?", re.I), "INR"),
    (re.compile(r"\$", re.I), "USD"),
    (re.compile(r"€", re.I), "EUR"),
    (re.compile(r"£", re.I), "GBP"),
)


def _normalise_line(value: str) -> str:
    value = str(value or "").replace("\u00a0", " ").replace("\u200b", "")
    value = value.replace("−", "-").replace("–", "-").replace("—", "-")
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


def _money_matches(line: str):
    matches = []
    for match in MONEY_RE.finditer(line):
        raw = match.group("amount").replace(",", "")
        try:
            amount = Decimal(raw)
        except InvalidOperation:
            continue
        if match.group("sign").strip():
            amount = -amount
        matches.append((match, amount))
    return matches


def _money_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(CENT, rounding=ROUND_HALF_UP))


def _last_amount(line: str) -> Decimal | None:
    matches = _money_matches(line)
    return matches[-1][1] if matches else None


def _normalise_date(lines: Sequence[str]) -> str | None:
    formats = (
        "%Y-%m-%d", "%Y/%m/%d",
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%d %b %Y", "%d %B %Y", "%d %b %y", "%d %B %y",
        "%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y",
    )
    for line in lines[:20]:
        match = DATE_RE.search(line)
        if not match:
            continue
        raw = match.group(0).strip()
        # Indian bills are day-first; this also avoids locale-dependent parsing.
        for fmt in formats:
            try:
                parsed = datetime.strptime(raw, fmt).date()
                return parsed.isoformat()
            except ValueError:
                continue
    return None


def _currency_details(lines: Sequence[str]) -> tuple[str, bool]:
    text = " ".join(lines)
    for pattern, code in CURRENCY_MARKERS:
        if pattern.search(text):
            return code, True
    # India-first fallback for bills without a visible currency marker. The
    # response includes currency_detected=False so the UI asks users to verify.
    return "INR", False

def _merchant_name(lines: Sequence[str]) -> str | None:
    for raw in lines[:8]:
        line = _normalise_line(raw)
        if len(line) < 3 or len(line) > 64:
            continue
        if DATE_RE.search(line) or _money_matches(line):
            continue
        if IGNORE_START_RE.search(line) or FOOTER_RE.search(line):
            continue
        if re.search(r"\b(?:tax\s+invoice|gstin|invoice\s+no)\b", line, re.I):
            continue
        if not re.search(r"[A-Za-z]", line):
            continue
        return line.strip(" :-|")
    return None


def _summary_kind(line: str) -> tuple[str | None, int]:
    if SUBTOTAL_RE.search(line):
        return "subtotal", 100
    if DISCOUNT_RE.search(line):
        return "discount", 100
    if TAX_RE.search(line):
        # Specific GST/VAT components take priority over an aggregate GST line.
        if re.search(r"\b(?:cgst|sgst|igst|vat)\b", line, re.I):
            return "tax_component", 100
        return "tax", 50
    for priority, pattern in TOTAL_LABELS:
        if pattern.search(line):
            return "total", priority
    return None, 0


def _parse_quantity_and_name(body: str) -> tuple[str, int]:
    body = body.strip(" :-|*•")
    quantity = 1

    # Common printed formats: "2 x Coffee", "Coffee x 2", and "Coffee 2 pcs".
    match = re.match(r"^\s*(\d{1,3})\s*[x×]\s*(.+)$", body, re.I)
    if match:
        quantity = max(1, int(match.group(1)))
        body = match.group(2)
    else:
        match = re.match(r"^(.+?)\s*[x×]\s*(\d{1,3})\s*$", body, re.I)
        if match:
            body, quantity = match.group(1), max(1, int(match.group(2)))
        else:
            match = re.match(
                r"^(.+?)\s+(\d{1,3})\s*(?:pcs?|nos?|units?)\s*$", body, re.I
            )
            if match:
                body, quantity = match.group(1), max(1, int(match.group(2)))
            else:
                # A trailing standalone integer before the final price is a
                # common quantity column in Indian POS printouts. Units such
                # as "500ml" do not match this pattern.
                match = re.match(r"^(.+?)\s+(\d{1,3})\s*$", body)
                if match:
                    body, quantity = match.group(1), max(1, int(match.group(2)))

    # Remove an explicit rate marker from the item description.
    body = re.sub(r"\s*@\s*$", "", body).strip(" :-|*•")
    return body, quantity


def _item_from_line(line: str, confidence: float) -> dict | None:
    normalized = _normalise_line(line)
    if not normalized or IGNORE_START_RE.search(normalized):
        return None
    if FOOTER_RE.search(normalized):
        return None

    matches = _money_matches(normalized)
    if not matches:
        return None

    # The right-most amount is normally the row amount. If a printed unit rate
    # is also present, use it only when rate * quantity reconciles to the row.
    last_match, raw_total = matches[-1]
    if raw_total <= 0:
        return None

    body = normalized[:last_match.start()].strip()
    quantity = 1
    candidate_rate = None

    # POS rows often print: description | quantity | unit rate | line total.
    # Detect the quantity immediately before the penultimate money value.
    if len(matches) >= 2:
        previous_match, previous_amount = matches[-2]
        prefix = normalized[:previous_match.start()].rstrip()
        qty_x = re.search(r"\b(\d{1,3})\s*[x×]\s*$", prefix, re.I)
        qty_plain = re.search(r"(?:^|\s)(\d{1,3})\s*$", prefix)
        unit_rate_only = re.search(
            r"^\s*[x×]\s*$",
            normalized[previous_match.end():last_match.start()],
            re.I,
        )
        qty_leading = re.match(r"^\s*(\d{1,3})\s*[x×]?\s+(.+)$", prefix)
        qty_suffix_x = re.match(r"^(.+?)\s*[x×]\s*(\d{1,3})\s*$", prefix, re.I)
        if qty_x:
            quantity = max(1, int(qty_x.group(1)))
            body = prefix[:qty_x.start()].strip()
            candidate_rate = previous_amount
        elif qty_plain:
            quantity = max(1, int(qty_plain.group(1)))
            body = prefix[:qty_plain.start()].strip()
            candidate_rate = previous_amount
        elif qty_leading:
            quantity = max(1, int(qty_leading.group(1)))
            body = qty_leading.group(2).strip()
            candidate_rate = previous_amount
        elif qty_suffix_x:
            quantity = max(1, int(qty_suffix_x.group(2)))
            body = qty_suffix_x.group(1).strip()
            candidate_rate = previous_amount
        elif unit_rate_only and previous_amount == previous_amount.to_integral_value() and previous_amount > 0:
            # "Tea 2 x 50.00" has a unit rate but no explicit line-total column.
            quantity = int(previous_amount)
            body = prefix.strip(" :-|*•")
            candidate_rate = raw_total
            raw_total = (candidate_rate * quantity).quantize(CENT, rounding=ROUND_HALF_UP)

    if candidate_rate is None:
        name, quantity = _parse_quantity_and_name(body)
    else:
        name = body.strip(" :-|*•")

    if not name or len(name) > 100 or not re.search(r"[A-Za-z]", name):
        return None
    if re.search(r"\b(?:total|subtotal|tax|discount|balance|change)\b", name, re.I):
        return None

    line_total = raw_total
    unit_price = (line_total / Decimal(quantity)).quantize(CENT, rounding=ROUND_HALF_UP)

    if candidate_rate is not None and quantity > 1:
        candidate_total = (candidate_rate * quantity).quantize(CENT, rounding=ROUND_HALF_UP)
        expected_total = line_total.quantize(CENT, rounding=ROUND_HALF_UP)
        tolerance = max(CENT, abs(expected_total) * Decimal("0.01"))
        if abs(candidate_total - expected_total) <= tolerance:
            unit_price = candidate_rate.quantize(CENT, rounding=ROUND_HALF_UP)

    # If a row explicitly uses "2 @ 50" without a separate line total,
    # treat the marked amount as a unit rate.
    if candidate_rate is None and re.search(r"\b\d{1,3}\s*@\s*$", body):
        unit_price = line_total
        line_total = (unit_price * quantity).quantize(CENT, rounding=ROUND_HALF_UP)

    return {
        "name": name,
        "quantity": quantity,
        "unit_price": _money_float(unit_price),
        "line_total": _money_float(line_total),
        "confidence": round(max(0.0, min(1.0, confidence)), 3),
    }


def parse_receipt_lines(
    raw_lines: Sequence[str],
    line_confidences: Sequence[float] | None = None,
) -> dict:
    """Convert OCR text lines into a cautious, editable receipt draft.

    No field is considered authoritative. Warnings flag missing or
    unreconciled values so the UI can require a human review.
    """
    lines = [_normalise_line(line) for line in raw_lines if _normalise_line(line)]
    confidences = list(line_confidences or [])
    if len(confidences) < len(lines):
        confidences.extend([0.0] * (len(lines) - len(confidences)))

    subtotal_candidates: list[Decimal] = []
    generic_tax: list[Decimal] = []
    component_tax: list[Decimal] = []
    discount_values: list[Decimal] = []
    total_candidates: list[tuple[int, int, Decimal]] = []
    items: list[dict] = []
    warnings: list[str] = []

    for index, line in enumerate(lines):
        amount = _last_amount(line)
        kind, priority = _summary_kind(line)
        if kind == "tax" and re.search(r"\\btax\\s+invoice\\b", line, re.I):
            kind = None
        if amount is not None and kind == "subtotal":
            if amount >= 0:
                subtotal_candidates.append(amount)
            continue
        if amount is not None and kind in {"tax", "tax_component"}:
            if amount >= 0:
                target = component_tax if kind == "tax_component" else generic_tax
                target.append(amount)
            continue
        if amount is not None and kind == "discount":
            discount_values.append(abs(amount))
            continue
        if amount is not None and kind == "total":
            # Never treat a prior-balance/change/tender line as the receipt total.
            if not FOOTER_RE.search(line):
                total_candidates.append((priority, index, amount))
            continue

        if kind is not None or not amount:
            continue
        item = _item_from_line(line, confidences[index])
        if item:
            items.append(item)
            if len(items) >= MAX_ITEMS:
                warnings.append(f"Only the first {MAX_ITEMS} possible items were returned.")
                break

    # If component-level GST lines exist, prefer their sum rather than also
    # counting an aggregate GST line printed on some receipts.
    tax_values = component_tax if component_tax else generic_tax
    subtotal = subtotal_candidates[-1] if subtotal_candidates else None
    tax = sum(tax_values, Decimal("0")) if tax_values else None
    discount = sum(discount_values, Decimal("0")) if discount_values else None

    # Prefer the strongest total label; within equal labels, the final value
    # is normally the amount actually payable.
    printed_total = max(total_candidates, key=lambda entry: (entry[0], entry[1]))[2] if total_candidates else None
    item_sum = sum((Decimal(str(item["line_total"])) for item in items), Decimal("0"))

    subtotal_source = "printed" if subtotal is not None else None
    if subtotal is None and items:
        subtotal = item_sum
        subtotal_source = "calculated_from_items"

    total_source = "printed" if printed_total is not None else None
    total = printed_total
    if total is None and subtotal is not None:
        total = subtotal + (tax or Decimal("0")) - (discount or Decimal("0"))
        total_source = "calculated"

    if not items:
        warnings.append("No confident line items were detected. Enter the items manually or try a sharper, well-lit image.")
    if subtotal_candidates and items:
        difference = abs(item_sum - subtotal_candidates[-1])
        tolerance = max(Decimal("2.00"), subtotal_candidates[-1].copy_abs() * Decimal("0.05"))
        if difference > tolerance:
            warnings.append("The detected item sum differs from the printed subtotal; verify the items and quantities.")
    if total is not None and subtotal is not None:
        expected = subtotal + (tax or Decimal("0")) - (discount or Decimal("0"))
        tolerance = max(Decimal("2.00"), total.copy_abs() * Decimal("0.03"))
        if abs(expected - total) > tolerance:
            warnings.append("The printed subtotal, tax, discount and total do not reconcile; verify the amounts.")
    if total is None:
        warnings.append("A receipt total could not be identified. Check the amount before saving.")
    if items and sum(item["confidence"] for item in items) / len(items) < 0.45:
        warnings.append("Some text was recognised with low confidence. Review every item name and amount.")

    item_confidences = [item["confidence"] for item in items]
    overall_confidence = (
        sum(item_confidences) / len(item_confidences) if item_confidences else None
    )
    currency, currency_detected = _currency_details(lines)
    if not currency_detected:
        warnings.append("No currency symbol was detected. INR is assumed; verify the currency on the bill.")

    return {
        "merchant_name": _merchant_name(lines),
        "date": _normalise_date(lines),
        "line_items": items,
        "subtotal": _money_float(subtotal),
        "subtotal_source": subtotal_source,
        "tax": _money_float(tax),
        "discount": _money_float(discount),
        "total_amount": _money_float(total),
        "total_amount_source": total_source,
        "currency": currency,
        "currency_detected": currency_detected,
        "confidence": round(overall_confidence, 3) if overall_confidence is not None else None,
        "warnings": list(dict.fromkeys(warnings)),
    }
