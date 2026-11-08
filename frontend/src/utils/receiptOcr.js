const TESSERACT_VERSION = '6.0.1';
const WORKER_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const CORE_URL = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`;
const LANGUAGE_URL = 'https://tessdata.projectnaptha.com/4.0.0';

let workerPromise;

function normalize(value) {
  return String(value || '').replace(/[\u00a0\u200b]/g, ' ').replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function amountsIn(line) {
  const matches = [...line.matchAll(/(?:₹|Rs\.?|INR|USD|EUR|GBP|[$€£])?\s*(-?\d[\d,]*(?:\.\d{1,2})?)(?![\d%])/gi)];
  return matches.map((match) => ({
    value: Number(match[1].replace(/,/g, '')),
    index: match.index,
    end: match.index + match[0].length,
  })).filter((match) => Number.isFinite(match.value));
}

function parseDate(lines) {
  const formats = [
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
  ];
  for (const line of lines.slice(0, 18)) {
    let match = line.match(formats[0]);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    match = line.match(formats[1]);
    if (match) {
      let year = Number(match[3]);
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      const day = Number(match[1]);
      const month = Number(match[2]);
      if (day <= 31 && month <= 12) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseReceipt(data) {
  const ocrLines = (data.lines || []).map((line) => ({
    text: normalize(line.text),
    confidence: Number(line.confidence ?? 0) / (Number(line.confidence ?? 0) > 1 ? 100 : 1),
    words: line.words || [],
  })).filter((line) => line.text);
  const lines = ocrLines.length
    ? ocrLines
    : normalize(data.text).split(/\r?\n/).filter(Boolean).map((text) => ({ text, confidence: 0.5, words: [] }));

  const currencyText = lines.map((line) => line.text).join(' ');
  let currency = 'INR';
  let currencyDetected = true;
  if (/\$|\bUSD\b/i.test(currencyText)) currency = 'USD';
  else if (/€|\bEUR\b/i.test(currencyText)) currency = 'EUR';
  else if (/£|\bGBP\b/i.test(currencyText)) currency = 'GBP';
  else if (!/₹|\bINR\b|\bRs\.?/i.test(currencyText)) currencyDetected = false;

  const items = [];
  const warnings = [];
  const taxes = [];
  const discounts = [];
  const totals = [];
  const subtotals = [];
  const summaryPattern = /\b(grand\s*total|total\s*(?:payable|due|amount)?|amount\s*(?:payable|due)|net\s*amount|subtotal|sub\s*total|taxable\s*value|cgst|sgst|igst|gst|vat|tax|service\s*charge|discount|coupon|savings)\b/i;
  const ignorePattern = /\b(invoice|receipt|bill\s*(?:no|number|date)|invoice\s*(?:no|number)|gstin|pan\s*no|order\s*(?:no|number)|transaction\s*(?:id|no)|table\s*no|cashier|phone|mobile|www\.|upi|cash\s*received|change\s*due|tendered|round\s*off|thank\s*you)\b/i;

  for (const row of lines) {
    const text = row.text;
    const values = amountsIn(text);
    if (!values.length) continue;

    if (/\b(sub\s*total|subtotal|taxable\s*(?:value|amount))\b/i.test(text)) {
      subtotals.push(values[values.length - 1].value);
      continue;
    }
    if (/\b(discount|coupon|savings)\b/i.test(text)) {
      discounts.push(Math.abs(values[values.length - 1].value));
      continue;
    }
    if (/\b(cgst|sgst|igst|gst|vat|tax|service\s*charge)\b/i.test(text)) {
      const amount = values[values.length - 1].value;
      if (!/%\s*$/.test(text) && amount >= 0) taxes.push(amount);
      continue;
    }
    if (/\b(grand\s*total|total\s*(?:payable|due|amount)?|amount\s*(?:payable|due)|net\s*amount|bill\s*total)\b/i.test(text)) {
      totals.push(values[values.length - 1].value);
      continue;
    }
    if (ignorePattern.test(text) || summaryPattern.test(text) || /\b(?:date|time)\b/i.test(text)) continue;

    const last = values[values.length - 1];
    if (last.value <= 0) continue;
    let name = text.slice(0, last.index).replace(/[|:;\s-]+$/g, '').trim();
    if (!name) continue;

    let quantity = 1;
    const leadingQuantity = name.match(/^\s*(\d{1,3})\s*[x×]?\s+(.+)$/i);
    const trailingQuantity = name.match(/^(.+?)\s+(\d{1,3})\s*$/);
    const explicitSuffix = name.match(/^(.+?)\s*[x×]\s*(\d{1,3})\s*$/i);
    if (leadingQuantity) {
      quantity = Math.max(1, Number(leadingQuantity[1]));
      name = leadingQuantity[2];
    } else if (explicitSuffix) {
      quantity = Math.max(1, Number(explicitSuffix[2]));
      name = explicitSuffix[1];
    } else if (trailingQuantity && Number(trailingQuantity[2]) <= 99) {
      quantity = Math.max(1, Number(trailingQuantity[2]));
      name = trailingQuantity[1];
    }

    let lineTotal = last.value;
    let unitPrice = lineTotal / quantity;
    if (values.length >= 2 && quantity === 1) {
      const previous = values[values.length - 2].value;
      const ratio = lineTotal / previous;
      if (previous > 0 && ratio >= 2 && ratio <= 99 && Math.abs(ratio - Math.round(ratio)) < 0.015) {
        quantity = Math.round(ratio);
        unitPrice = previous;
      }
    }
    name = normalize(name).replace(/^[^A-Za-z]+/, '').replace(/[|:;]+$/g, '').trim();
    if (!/[A-Za-z]/.test(name) || name.length > 90 || /\b(total|subtotal|tax|discount|invoice|receipt)\b/i.test(name)) continue;
    const confidence = Math.max(0, Math.min(1, row.confidence || 0));
    items.push({
      name,
      quantity,
      unit_price: Number(unitPrice.toFixed(2)),
      line_total: Number(lineTotal.toFixed(2)),
      confidence: Number(confidence.toFixed(3)),
    });
  }

  const itemSum = items.reduce((sum, item) => sum + item.line_total, 0);
  const subtotal = subtotals.length ? subtotals[subtotals.length - 1] : (items.length ? itemSum : null);
  const tax = taxes.length ? Number(taxes.reduce((sum, value) => sum + value, 0).toFixed(2)) : null;
  const discount = discounts.length ? Number(discounts.reduce((sum, value) => sum + value, 0).toFixed(2)) : null;
  const total = totals.length ? totals[totals.length - 1] : (subtotal == null ? null : subtotal + (tax || 0) - (discount || 0));

  if (!items.length) warnings.push('No reliable line items were detected. Enter the items manually or try a clearer image.');
  if (subtotals.length && items.length && Math.abs(itemSum - subtotal) > Math.max(2, subtotal * 0.05)) {
    warnings.push('The detected item sum differs from the printed subtotal. Check quantities and prices.');
  }
  if (total != null && subtotal != null && Math.abs(subtotal + (tax || 0) - (discount || 0) - total) > Math.max(2, total * 0.03)) {
    warnings.push('The subtotal, tax, discount and total do not reconcile. Verify the receipt values.');
  }
  if (!currencyDetected) warnings.push('No currency symbol was detected. INR is assumed; verify the currency.');
  if (items.some((item) => item.confidence < 0.55)) warnings.push('Some item text has low OCR confidence. Review all extracted fields.');

  const merchant = lines.slice(0, 8).find((row) =>
    row.text.length >= 3 && row.text.length <= 64 &&
    /[A-Za-z]/.test(row.text) && !amountsIn(row.text).length &&
    !ignorePattern.test(row.text) && !summaryPattern.test(row.text)
  );

  return {
    merchant_name: merchant?.text || null,
    date: parseDate(lines.map((row) => row.text)),
    line_items: items.slice(0, 80),
    subtotal,
    subtotal_source: subtotals.length ? 'printed' : (items.length ? 'calculated_from_items' : null),
    tax,
    discount,
    total_amount: total,
    total_amount_source: totals.length ? 'printed' : (total == null ? null : 'calculated'),
    currency,
    currency_detected: currencyDetected,
    confidence: items.length ? Number((items.reduce((sum, item) => sum + item.confidence, 0) / items.length).toFixed(3)) : null,
    warnings,
    ocr_engine: 'Tesseract.js (browser)',
  };
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/+esm`)
      .then(({ createWorker }) => createWorker('eng', 1, {
        workerPath: WORKER_URL,
        corePath: CORE_URL,
        langPath: LANGUAGE_URL,
        cacheMethod: 'write',
        logger: (message) => {
          if (message.status === 'recognizing text' && Number.isFinite(message.progress)) {
            onProgress?.(Math.round(message.progress * 100));
          } else if (message.status === 'loading language traineddata') {
            onProgress?.(Math.round((message.progress || 0) * 20));
          }
        },
      }))
      .catch((error) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

export async function runReceiptOcr(file, onProgress) {
  const worker = await getWorker(onProgress);
  const result = await worker.recognize(file);
  return parseReceipt(result.data || {});
}
