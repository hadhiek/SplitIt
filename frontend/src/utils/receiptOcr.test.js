import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptData } from './receiptOcr.js';

function word(text, x, confidence = 96) {
  return {
    text,
    confidence,
    bbox: { x0: x - 12, x1: x + 12, y0: 0, y1: 20 },
  };
}

function line(text, words, y = 0, confidence = 96) {
  return {
    text,
    confidence,
    bbox: { x0: 0, x1: 340, y0: y, y1: y + 20 },
    words: words.map((entry) => ({ ...entry, bbox: { ...entry.bbox, y0: y, y1: y + 20 } })),
  };
}

function receiptBlocks(lines) {
  return [{
    paragraphs: [{
      lines,
    }],
  }];
}

test('parses quantity, unit rate and amount from aligned receipt columns', () => {
  const data = parseReceiptData({
    text: 'Cafe\\nItem Qty Rate Amount\\nCoffee 2 50.00 100.00\\nGrand Total 100.00',
    blocks: receiptBlocks([
      line('Cafe', [word('Cafe', 30)], 0),
      line('Item Qty Rate Amount', [
        word('Item', 30), word('Qty', 150), word('Rate', 210), word('Amount', 310),
      ], 30),
      line('Coffee 2 50.00 100.00', [
        word('Coffee', 30), word('2', 150), word('50.00', 210), word('100.00', 310),
      ], 60),
      line('Grand Total 100.00', [word('Grand', 30), word('Total', 75), word('100.00', 310)], 90),
    ]),
  });

  assert.equal(data.line_items.length, 1);
  assert.deepEqual(
    {
      name: data.line_items[0].name,
      quantity: data.line_items[0].quantity,
      unit_price: data.line_items[0].unit_price,
      line_total: data.line_items[0].line_total,
    },
    { name: 'Coffee', quantity: 2, unit_price: 50, line_total: 100 },
  );
  assert.equal(data.total_amount, 100);
});

test('ignores invoice identifiers and metadata instead of making them line items', () => {
  const data = parseReceiptData({
    text: 'INVOICE NO 987654\\nGSTIN 32ABCDE1234F1Z5\\nMilk 42.00\\nGrand Total 42.00',
    blocks: receiptBlocks([
      line('INVOICE NO 987654', [word('INVOICE', 30), word('NO', 90), word('987654', 310)], 0),
      line('GSTIN 32ABCDE1234F1Z5', [word('GSTIN', 30), word('32ABCDE1234F1Z5', 200)], 25),
      line('Milk 42.00', [word('Milk', 30), word('42.00', 310)], 50),
      line('Grand Total 42.00', [word('Grand', 30), word('Total', 90), word('42.00', 310)], 75),
    ]),
  });

  assert.equal(data.line_items.length, 1);
  assert.equal(data.line_items[0].name, 'Milk');
  assert.equal(data.total_amount, 42);
});

test('does not guess quantity from two ambiguous unlabelled numbers', () => {
  const data = parseReceiptData({
    text: 'Burger 2 80.00\\nGrand Total 80.00',
    blocks: receiptBlocks([
      line('Burger 2 80.00', [word('Burger', 30), word('2', 150), word('80.00', 310)], 0),
      line('Grand Total 80.00', [word('Grand', 30), word('Total', 90), word('80.00', 310)], 25),
    ]),
  });

  assert.equal(data.line_items.length, 0);
  assert.ok(data.warnings.some((warning) => warning.includes('two unlabelled numeric values')));
});

test('parses Indian day-first dates and rejects impossible dates', () => {
  const valid = parseReceiptData({
    text: 'Cafe\\n09/11/2026\\nTea 20.00',
    blocks: receiptBlocks([
      line('Cafe', [word('Cafe', 30)], 0),
      line('09/11/2026', [word('09/11/2026', 30)], 20),
      line('Tea 20.00', [word('Tea', 30), word('20.00', 310)], 40),
    ]),
  });
  const invalid = parseReceiptData({
    text: 'Cafe\\n31/02/2026\\nTea 20.00',
    blocks: receiptBlocks([
      line('Cafe', [word('Cafe', 30)], 0),
      line('31/02/2026', [word('31/02/2026', 30)], 20),
      line('Tea 20.00', [word('Tea', 30), word('20.00', 310)], 40),
    ]),
  });

  assert.equal(valid.date, '2026-11-09');
  assert.equal(invalid.date, null);
});

test('reports subtotal mismatches rather than silently accepting wrong item totals', () => {
  const data = parseReceiptData({
    text: 'Tea 20.00\\nSubtotal 25.00\\nGrand Total 25.00',
    blocks: receiptBlocks([
      line('Tea 20.00', [word('Tea', 30), word('20.00', 310)], 0),
      line('Subtotal 25.00', [word('Subtotal', 30), word('25.00', 310)], 25),
      line('Grand Total 25.00', [word('Grand', 30), word('Total', 90), word('25.00', 310)], 50),
    ]),
  });

  assert.equal(data.line_items[0].line_total, 20);
  assert.ok(data.warnings.some((warning) => warning.includes('differs from the printed subtotal')));
});
