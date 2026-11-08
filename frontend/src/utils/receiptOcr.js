const MAX_ITEMS = 80;
const TESSERACT_MODULE_PATH = '/ocr/tesseract.esm.min.js';

let workerPromise;

function normalize(value) {
  return String(value || '')
    .replace(/[\u00a0\u200b]/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function confidenceValue(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function moneyFromToken(value) {
  const raw = normalize(value);
  if (!raw || !/^(?:(?:₹|Rs\.?|INR|USD|EUR|GBP|[$€£])\s*)?[-+]?\d[\d,]*(?:\.\d{1,2})?(?:\/-)?$/i.test(raw)) {
    return null;
  }
  const cleaned = raw
    .replace(/^(?:₹|Rs\.?|INR|USD|EUR|GBP|[$€£])\s*/i, '')
    .replace(/\/-$/, '')
    .replace(/,/g, '')
    .replace(/[−–—]/g, '-')
    .trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function amountsInText(text) {
  const source = normalize(text);
  const pattern = /(?:^|[^A-Za-z0-9])((?:₹|Rs\.?|INR|USD|EUR|GBP|[$€£])?\s*[-−+]?\s*\d[\d,]*(?:\.\d{1,2})?(?:\/-)?)(?![A-Za-z0-9%])/gi;
  const matches = [];
  for (const match of source.matchAll(pattern)) {
    const raw = normalize(match[1]);
    const value = moneyFromToken(raw);
    if (value == null) continue;
    const leadingSeparator = match[0].length - match[1].length;
    matches.push({
      value,
      start: (match.index || 0) + leadingSeparator,
      end: (match.index || 0) + match[0].length,
    });
  }
  return matches;
}

function buildLines(data) {
  const lines = [];
  for (const block of Array.isArray(data.blocks) ? data.blocks : []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const words = (line.words || []).map((word) => {
          const bbox = word.bbox || {};
          const x0 = Number(bbox.x0);
          const x1 = Number(bbox.x1);
          return {
            text: normalize(word.text),
            confidence: confidenceValue(word.confidence, line.confidence),
            x: Number.isFinite(x0) && Number.isFinite(x1) ? (x0 + x1) / 2 : null,
            hasBox: Number.isFinite(x0) && Number.isFinite(x1),
            numericValue: moneyFromToken(word.text),
          };
        }).filter((word) => word.text);

        const text = normalize(line.text || words.map((word) => word.text).join(' '));
        if (text) {
          lines.push({
            text,
            confidence: confidenceValue(line.confidence),
            words,
          });
        }
      }
    }
  }

  if (lines.length) return lines;

  if (Array.isArray(data.lines) && data.lines.length) {
    return data.lines.map((line) => ({
      text: normalize(line.text),
      confidence: confidenceValue(line.confidence, 0.5),
      words: [],
    })).filter((line) => line.text);
  }

  return normalize(data.text).split(/\r?\n/)
    .map((text) => ({ text: normalize(text), confidence: 0.5, words: [] }))
    .filter((line) => line.text);
}

const IDENTIFIER_ROW_RE = /\b(?:invoice|receipt|gstin|gst\s*in|pan\s*(?:no|number)?|hsn|sac|cin|ifsc|order\s*(?:no|number|id)|bill\s*(?:no|number|date)|transaction\s*(?:id|no|number)|reference\s*(?:no|number)|ref\s*(?:no|number)|phone|mobile|telephone|cashier|table\s*(?:no|number)|kot\s*(?:no|number)|upi|customer\s*(?:id|phone)|serial\s*(?:no|number))\b/i;
const FOOTER_ROW_RE = /\b(?:balance|change\s*due|tendered|paid\s*by|payment\s*mode|cash\s*received|round\s*off|thank\s*you)\b/i;
const SUBTOTAL_RE = /\b(?:sub\s*total|subtotal|taxable\s+(?:value|amount))\b/i;
const DISCOUNT_RE = /\b(?:discount|coupon|savings)\b/i;
const TAX_RE = /\b(?:cgst|sgst|igst|gst|vat|tax|service\s*charge)\b/i;
const TAX_COMPONENT_RE = /\b(?:cgst|sgst|igst|vat)\b/i;
const TOTAL_LABELS = [
  [100, /\bgrand\s*total\b/i],
  [95, /\b(?:amount|net)\s+(?:payable|due)\b/i],
  [95, /\bpayable\s+amount\b/i],
  [90, /\btotal\s+(?:payable|due|amount)\b/i],
  [85, /\b(?:bill|invoice)\s+total\b/i],
  [75, /\bnet\s+total\b/i],
  [60, /\btotal\b/i],
];

function summaryKind(text) {
  if (SUBTOTAL_RE.test(text)) return 'subtotal';
  if (DISCOUNT_RE.test(text)) return 'discount';
  if (TAX_RE.test(text)) return TAX_COMPONENT_RE.test(text) ? 'tax_component' : 'tax';
  for (const [priority, pattern] of TOTAL_LABELS) {
    if (pattern.test(text)) return { kind: 'total', priority };
  }
  return null;
}

function numericWords(line) {
  return line.words
    .map((word, index) => ({ ...word, index, value: word.numericValue }))
    .filter((word) => word.value != null)
    .sort((a, b) => (a.x ?? a.index) - (b.x ?? b.index));
}

function findColumnHeader(lines) {
  for (const line of lines.slice(0, 35)) {
    if (!line.words.length || !line.words.every((word) => word.hasBox)) continue;
    const anchors = {};
    for (const word of line.words) {
      const label = word.text.toLowerCase().replace(/[^a-z]/g, '');
      const x = word.x;
      if (x == null) continue;
      if (/^(hsn|sac|itemcode|productcode)$/.test(label)) anchors.hsn = x;
      if (/^(qty|qnty|quantity|nos)$/.test(label)) anchors.quantity = x;
      if (/^(rate|price|unitprice|mrp)$/.test(label)) anchors.rate = x;
      if (/^(amount|amt|value|total)$/.test(label)) anchors.amount = x;
    }
    if (anchors.quantity != null && (anchors.rate != null || anchors.amount != null)) {
      return { line, anchors };
    }
  }
  return null;
}

function nearestNumber(numbers, x, pageWidth, used) {
  if (x == null) return null;
  const tolerance = Math.max(18, pageWidth * 0.09);
  const match = numbers
    .filter((number) => !used.has(number.index) && number.x != null)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  if (!match || Math.abs(match.x - x) > tolerance) return null;
  used.add(match.index);
  return match;
}

function cleanItemName(value) {
  return normalize(value)
    .replace(/^[\s|:;*•\-]+/, '')
    .replace(/[\s|:;*•\-]+$/, '')
    .replace(/^\d{1,3}[.)]\s+/, '')
    .trim();
}

function parseQuantityPrefix(prefix) {
  let name = normalize(prefix);
  let quantity = 1;

  let match = name.match(/^\s*(\d{1,3})\s*[x×]\s*(.+)$/i);
  if (match) {
    quantity = Number(match[1]);
    name = match[2];
  } else {
    match = name.match(/^(.+?)\s*[x×]\s*(\d{1,3})\s*$/i);
    if (match) {
      name = match[1];
      quantity = Number(match[2]);
    } else {
      match = name.match(/^(.+?)\s+(\d{1,3})\s*(?:pcs?|nos?|units?)$/i);
      if (match) {
        name = match[1];
        quantity = Number(match[2]);
      } else {
        match = name.match(/^(.+?)\s+(\d{1,2})\s*$/);
        if (match && Number(match[2]) >= 2) {
          name = match[1];
          quantity = Number(match[2]);
        }
      }
    }
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) quantity = 1;
  return { name: cleanItemName(name), quantity };
}

function itemConfidence(line) {
  const scores = line.words.map((word) => word.confidence).filter((score) => score > 0);
  return scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : confidenceValue(line.confidence, 0.5);
}

function makeItem(name, quantity, lineTotal, confidence, unitPrice = null) {
  const safeName = cleanItemName(name);
  if (!safeName || !/\p{L}/u.test(safeName) || safeName.length > 100) return null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null;
  if (!Number.isFinite(lineTotal) || lineTotal <= 0) return null;

  const calculatedUnitPrice = unitPrice == null ? lineTotal / quantity : unitPrice;
  if (!Number.isFinite(calculatedUnitPrice) || calculatedUnitPrice <= 0) return null;

  return {
    name: safeName,
    quantity,
    unit_price: Number(calculatedUnitPrice.toFixed(2)),
    line_total: Number(lineTotal.toFixed(2)),
    confidence: Number(confidenceValue(confidence).toFixed(3)),
  };
}

function parseWithColumns(line, columns, pageWidth, warnings) {
  if (!line.words.length || !line.words.every((word) => word.hasBox)) return null;
  const numbers = numericWords(line);
  if (!numbers.length) return null;

  const used = new Set();
  const qtyWord = nearestNumber(numbers, columns.anchors.quantity, pageWidth, used);
  const rateWord = nearestNumber(numbers, columns.anchors.rate, pageWidth, used);
  const amountWord = nearestNumber(numbers, columns.anchors.amount, pageWidth, used);

  const quantity = qtyWord && Number.isInteger(qtyWord.value) ? qtyWord.value : 1;
  if (quantity < 1 || quantity > 999) return null;

  const lineTotal = amountWord
    ? amountWord.value
    : (rateWord ? rateWord.value * quantity : null);
  if (lineTotal == null || lineTotal <= 0) return null;

  const firstNumericColumn = Math.min(
    columns.anchors.hsn ?? Infinity,
    columns.anchors.quantity ?? Infinity,
    columns.anchors.rate ?? Infinity,
    columns.anchors.amount ?? Infinity,
  );
  const name = line.words
    .filter((word) => word.numericValue == null && word.x != null && word.x < firstNumericColumn - pageWidth * 0.015)
    .map((word) => word.text)
    .join(' ');

  if (rateWord && Math.abs(rateWord.value * quantity - lineTotal) > Math.max(1, lineTotal * 0.02)) {
    warnings.push('A printed unit rate does not match its line total. Check this item before saving.');
  }

  return makeItem(name, quantity, lineTotal, itemConfidence(line), lineTotal / quantity);
}

function parseWithoutColumns(line, warnings) {
  const numbers = numericWords(line);
  const textAmounts = line.words.length ? [] : amountsInText(line.text);
  const amountValues = line.words.length
    ? numbers
    : textAmounts.map((amount, index) => ({ ...amount, index, x: amount.start, value: amount.value }));

  if (!amountValues.length) return null;

  if (amountValues.length >= 3) {
    const tail = amountValues.slice(-3);
    const quantity = tail[0].value;
    const unitPrice = tail[1].value;
    const lineTotal = tail[2].value;
    const expected = quantity * unitPrice;
    if (
      Number.isInteger(quantity) && quantity >= 1 && quantity <= 999 &&
      unitPrice > 0 && lineTotal > 0 &&
      Math.abs(expected - lineTotal) <= Math.max(1, lineTotal * 0.02)
    ) {
      let name = '';
      if (line.words.length) {
        name = line.words.slice(0, tail[0].index)
          .filter((word) => word.numericValue == null)
          .map((word) => word.text)
          .join(' ');
      } else {
        name = line.text.slice(0, tail[0].start);
      }
      return makeItem(name, quantity, lineTotal, itemConfidence(line), unitPrice);
    }

    warnings.push('A receipt row contains multiple numbers that could not be assigned safely to quantity and price. Check it manually.');
    return null;
  }

  if (amountValues.length === 2) {
    const first = amountValues[0];
    const second = amountValues[1];
    const suffixQuantity = line.text.match(/^(.+?)\s*[x×]\s*(\d{1,3})\s+[-+]?/i);
    if (suffixQuantity && Number.isInteger(Number(suffixQuantity[2])) && Number(suffixQuantity[2]) >= 1 && Number(suffixQuantity[2]) <= 999) {
      const quantity = Number(suffixQuantity[2]);
      const unitPrice = second.value;
      return makeItem(suffixQuantity[1], quantity, quantity * unitPrice, itemConfidence(line), unitPrice);
    }

    const explicitQuantity = /\b\d{1,3}\s*[x×]\s*\d[\d,.]*/i.test(line.text);
    if (explicitQuantity && Number.isInteger(first.value) && first.value >= 1 && first.value <= 999) {
      let name = '';
      if (line.words.length) {
        name = line.words.slice(0, first.index)
          .filter((word) => word.numericValue == null && !/^[x×]$/i.test(word.text))
          .map((word) => word.text)
          .join(' ');
      } else {
        name = line.text.slice(0, first.start);
      }
      return makeItem(name, first.value, first.value * second.value, itemConfidence(line), second.value);
    }

    warnings.push('A receipt row has two unlabelled numeric values. Quantity and price were not guessed.');
    return null;
  }

  const amount = amountValues[0];
  let prefix = '';
  if (line.words.length) {
    prefix = line.words.slice(0, amount.index)
      .filter((word) => word.numericValue == null)
      .map((word) => word.text)
      .join(' ');
  } else {
    prefix = line.text.slice(0, amount.start);
  }

  const parsedPrefix = parseQuantityPrefix(prefix);
  return makeItem(
    parsedPrefix.name,
    parsedPrefix.quantity,
    amount.value,
    itemConfidence(line),
    amount.value / parsedPrefix.quantity,
  );
}

function parseDate(lines) {
  for (const line of lines.slice(0, 25)) {
    let match = line.text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    let year;
    let month;
    let day;
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = line.text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
      if (!match) continue;
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
      if (year < 100) year += year >= 70 ? 1900 : 2000;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return [
        String(year).padStart(4, '0'),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0'),
      ].join('-');
    }
  }
  return null;
}

export function parseReceiptData(data = {}) {
  const lines = buildLines(data);
  const pageWidth = Math.max(
    1,
    ...lines.flatMap((line) => line.words.map((word) => word.hasBox ? word.x : 0)),
  );
  const columns = findColumnHeader(lines);
  const items = [];
  const warnings = [];
  const subtotals = [];
  const componentTaxes = [];
  const genericTaxes = [];
  const discounts = [];
  const totals = [];

  lines.forEach((line, index) => {
    const text = line.text;
    const amounts = line.words.length
      ? numericWords(line).map((word) => word.value)
      : amountsInText(text).map((amount) => amount.value);
    const lastAmount = amounts.length ? amounts[amounts.length - 1] : null;
    const summary = summaryKind(text);

    if (summary === 'subtotal') {
      if (lastAmount != null && lastAmount >= 0) subtotals.push(lastAmount);
      return;
    }
    if (summary === 'discount') {
      if (lastAmount != null && lastAmount >= 0) discounts.push(lastAmount);
      return;
    }
    if (summary === 'tax' || summary === 'tax_component') {
      if (lastAmount != null && lastAmount >= 0 && !/%\s*$/.test(text)) {
        (summary === 'tax_component' ? componentTaxes : genericTaxes).push(lastAmount);
      }
      return;
    }
    if (summary && summary.kind === 'total') {
      if (lastAmount != null && lastAmount >= 0 && !FOOTER_ROW_RE.test(text)) {
        totals.push({ priority: summary.priority, index, value: lastAmount });
      }
      return;
    }

    if (
      (columns && text === columns.line.text) ||
      IDENTIFIER_ROW_RE.test(text) ||
      FOOTER_ROW_RE.test(text) ||
      /\b(?:date|time)\b/i.test(text) ||
      !/\p{L}/u.test(text)
    ) {
      return;
    }

    const item = columns
      ? parseWithColumns(line, columns, pageWidth, warnings) || parseWithoutColumns(line, warnings)
      : parseWithoutColumns(line, warnings);
    if (item) {
      items.push(item);
      if (items.length >= MAX_ITEMS) {
        warnings.push('Only the first ' + MAX_ITEMS + ' possible items were returned.');
      }
    }
  });

  const limitedItems = items.slice(0, MAX_ITEMS);
  const itemSumCents = limitedItems.reduce(
    (sum, item) => sum + Math.round(item.line_total * 100),
    0,
  );
  const printedSubtotal = subtotals.length ? subtotals[subtotals.length - 1] : null;
  const subtotal = printedSubtotal != null
    ? printedSubtotal
    : (limitedItems.length ? itemSumCents / 100 : null);
  const taxValues = componentTaxes.length ? componentTaxes : genericTaxes;
  const tax = taxValues.length
    ? Number(taxValues.reduce((sum, value) => sum + value, 0).toFixed(2))
    : null;
  const discount = discounts.length
    ? Number(discounts.reduce((sum, value) => sum + value, 0).toFixed(2))
    : null;
  const bestTotal = totals.length
    ? totals.sort((a, b) => (b.priority - a.priority) || (b.index - a.index))[0].value
    : null;
  const total = bestTotal != null
    ? bestTotal
    : (subtotal == null ? null : Number((subtotal + (tax || 0) - (discount || 0)).toFixed(2)));

  if (!limitedItems.length) {
    warnings.push('No confident line items were detected. Enter items manually or try a sharper, well-lit image.');
  }
  if (printedSubtotal != null && limitedItems.length) {
    const difference = Math.abs(itemSumCents - Math.round(printedSubtotal * 100));
    if (difference > Math.max(200, Math.round(printedSubtotal * 5))) {
      warnings.push('The detected item sum differs from the printed subtotal. Check quantities and prices.');
    }
  }
  if (total != null && subtotal != null) {
    const expected = subtotal + (tax || 0) - (discount || 0);
    if (Math.abs(expected - total) > Math.max(2, total * 0.03)) {
      warnings.push('The subtotal, tax, discount and printed total do not reconcile. Verify the amounts.');
    }
  }
  if (limitedItems.some((item) => item.confidence < 0.55)) {
    warnings.push('Some item text has low OCR confidence. Review all extracted fields.');
  }

  const allText = lines.map((line) => line.text).join(' ');
  let currency = 'INR';
  let currencyDetected = true;
  if (/\$|\bUSD\b/i.test(allText)) currency = 'USD';
  else if (/€|\bEUR\b/i.test(allText)) currency = 'EUR';
  else if (/£|\bGBP\b/i.test(allText)) currency = 'GBP';
  else if (!/₹|\bINR\b|\bRs\.?/i.test(allText)) currencyDetected = false;
  if (!currencyDetected) warnings.push('No currency marker was detected. INR is assumed; verify the currency.');

  const merchant = lines.slice(0, 8).find((line) =>
    line.text.length >= 3 &&
    line.text.length <= 64 &&
    /\p{L}/u.test(line.text) &&
    !amountsInText(line.text).length &&
    !IDENTIFIER_ROW_RE.test(line.text) &&
    !summaryKind(line.text) &&
    !/\b(?:date|time)\b/i.test(line.text)
  );

  const scores = limitedItems.map((item) => item.confidence);
  const averageConfidence = scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(3))
    : null;

  return {
    merchant_name: merchant?.text || null,
    date: parseDate(lines),
    line_items: limitedItems,
    subtotal,
    subtotal_source: printedSubtotal != null ? 'printed' : (limitedItems.length ? 'calculated_from_items' : null),
    tax,
    discount,
    total_amount: total,
    total_amount_source: bestTotal != null ? 'printed' : (total == null ? null : 'calculated'),
    currency,
    currency_detected: currencyDetected,
    confidence: averageConfidence,
    warnings: [...new Set(warnings)],
    ocr_engine: 'Tesseract.js (on-device)',
  };
}

function assetUrl(path) {
  return new URL(path, window.location.origin).href;
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    const moduleUrl = assetUrl(TESSERACT_MODULE_PATH);
    workerPromise = import(/* @vite-ignore */ moduleUrl)
      .then(({ createWorker }) => createWorker('eng', 1, {
        workerPath: assetUrl('/ocr/worker.min.js'),
        corePath: assetUrl('/ocr/core/'),
        langPath: assetUrl('/ocr/lang'),
        workerBlobURL: false,
        cacheMethod: 'write',
        gzip: true,
        logger: (message) => {
          const progress = Number(message.progress || 0);
          if (message.status === 'loading language traineddata') {
            onProgress?.(Math.round(5 + progress * 15), 'Loading English model');
          } else if (message.status === 'recognizing text') {
            onProgress?.(Math.round(20 + progress * 80), 'Reading receipt');
          } else if (message.status) {
            onProgress?.(5, 'Starting OCR engine');
          }
        },
      }))
      .catch((error) => {
        workerPromise = null;
        throw new Error('Could not start the on-device OCR engine. ' + (error?.message || 'Check that the app has finished loading its OCR files.'));
      });
  }
  return workerPromise;
}

async function prepareReceiptImage(file) {
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (!bitmap.width || !bitmap.height) {
      throw new Error('The selected image has invalid dimensions.');
    }

    const maxWidth = 2400;
    const maxHeight = 3400;
    const maxPixels = 8_000_000;
    const scale = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height,
      Math.sqrt(maxPixels / (bitmap.width * bitmap.height)),
    );

    if (scale >= 0.999 && file.size <= 3 * 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return blob;
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid dimensions')) throw error;
    return file;
  } finally {
    bitmap?.close?.();
  }
}

export async function runReceiptOcr(file, onProgress) {
  if (!file) throw new Error('Choose a receipt image first.');

  try {
    onProgress?.(1, 'Preparing receipt image');
    const image = await prepareReceiptImage(file);
    onProgress?.(5, 'Starting OCR engine');

    const worker = await getWorker(onProgress);
    const result = await worker.recognize(image, {}, { blocks: true });
    const data = result?.data || {};
    if (!normalize(data.text)) {
      throw new Error('No readable text was found. Try a well-lit, sharply focused image.');
    }

    onProgress?.(100, 'Finishing');
    return parseReceiptData(data);
  } catch (error) {
    throw new Error(error?.message || 'On-device receipt scanning failed. Please retry or enter items manually.');
  }
}
