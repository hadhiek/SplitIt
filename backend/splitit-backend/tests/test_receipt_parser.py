import unittest

from services.receipt_parser import parse_receipt_lines


class ReceiptParserTests(unittest.TestCase):
    def test_indian_receipt_with_quantity_rate_tax_and_discount(self):
        result = parse_receipt_lines(
            [
                "CAFE MOCHA",
                "Tax Invoice",
                "Date: 09/11/2026",
                "Coffee 2 x 50.00 100.00",
                "Sandwich 1 80.00 80.00",
                "Subtotal 180.00",
                "CGST 2.5% 4.50",
                "SGST 2.5% 4.50",
                "Discount 10.00",
                "Grand Total ₹179.00",
            ],
            [0.99] * 10,
        )

        self.assertEqual(result["merchant_name"], "CAFE MOCHA")
        self.assertEqual(result["date"], "2026-11-09")
        self.assertEqual(result["currency"], "INR")
        self.assertEqual(result["line_items"][0]["name"], "Coffee")
        self.assertEqual(result["line_items"][0]["quantity"], 2)
        self.assertEqual(result["line_items"][0]["unit_price"], 50.0)
        self.assertEqual(result["line_items"][0]["line_total"], 100.0)
        self.assertEqual(result["line_items"][1]["name"], "Sandwich")
        self.assertEqual(result["line_items"][1]["quantity"], 1)
        self.assertEqual(result["tax"], 9.0)
        self.assertEqual(result["discount"], 10.0)
        self.assertEqual(result["total_amount"], 179.0)
        self.assertEqual(result["total_amount_source"], "printed")
        self.assertEqual(result["warnings"], [])

    def test_us_currency_and_month_name_date(self):
        result = parse_receipt_lines(
            [
                "NORTH MARKET",
                "November 8, 2026",
                "Milk $4.50",
                "Total $4.50",
            ],
            [0.9, 0.9, 0.95, 0.95],
        )
        self.assertEqual(result["date"], "2026-11-08")
        self.assertEqual(result["currency"], "USD")
        self.assertEqual(result["total_amount"], 4.5)

    def test_infers_subtotal_and_total_when_printed_values_missing(self):
        result = parse_receipt_lines(
            ["GREEN STORE", "Apples 120.00", "Bread 40.00"],
            [0.8, 0.9, 0.9],
        )
        self.assertEqual(result["subtotal"], 160.0)
        self.assertEqual(result["subtotal_source"], "calculated_from_items")
        self.assertEqual(result["total_amount"], 160.0)
        self.assertEqual(result["total_amount_source"], "calculated")

    def test_tax_percent_without_tax_amount_is_not_treated_as_money(self):
        result = parse_receipt_lines(
            ["FOOD SHOP", "Burger 100.00", "GST 5%", "Total 105.00"],
            [0.9] * 4,
        )
        self.assertIsNone(result["tax"])
        self.assertEqual(result["total_amount"], 105.0)
        self.assertTrue(any("do not reconcile" in warning for warning in result["warnings"]))

    def test_conflicting_totals_are_reported_for_review(self):
        result = parse_receipt_lines(
            [
                "SHOP",
                "Tea 30.00",
                "Subtotal 30.00",
                "Tax 5.00",
                "Grand Total 36.00",
            ],
            [0.9] * 5,
        )
        self.assertEqual(result["total_amount"], 36.0)
        self.assertTrue(any("do not reconcile" in warning for warning in result["warnings"]))

    def test_no_items_returns_manual_entry_warning(self):
        result = parse_receipt_lines(["SHOP", "Grand Total 500.00"])
        self.assertEqual(result["line_items"], [])
        self.assertTrue(any("No confident line items" in warning for warning in result["warnings"]))

    def test_round_off_and_change_are_not_detected_as_line_items(self):
        result = parse_receipt_lines(
            [
                "SHOP",
                "Coffee 50.00",
                "Round Off -0.50",
                "Cash Received 100.00",
                "Change 50.00",
                "Grand Total 49.50",
            ],
            [0.9] * 6,
        )
        self.assertEqual([item["name"] for item in result["line_items"]], ["Coffee"])
        self.assertEqual(result["total_amount"], 49.5)

    def test_confidence_is_carried_to_items(self):
        result = parse_receipt_lines(
            ["CAFE", "Coffee 20.00"],
            [0.95, 0.42],
        )
        self.assertEqual(result["line_items"][0]["confidence"], 0.42)
        self.assertEqual(result["confidence"], 0.42)


if __name__ == "__main__":
    unittest.main()
