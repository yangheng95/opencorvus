import unittest
from decimal import localcontext

from invoice import sum_due


class SumDueTests(unittest.TestCase):
    def test_required_values(self):
        cases = [
            ([(3, "0.10")], "0.30"),
            ([(1, "1.005")], "1.01"),
            ([(1, "9007199254740993.10"), (1, "0.20")], "9007199254740993.30"),
            ([], "0.00"),
        ]
        for rows, expected in cases:
            with self.subTest(rows=rows):
                self.assertEqual(sum_due(rows), expected)

    def test_round_only_after_sum(self):
        self.assertEqual(sum_due([(1, "0.004"), (1, "0.004")]), "0.01")

    def test_beyond_default_decimal_precision(self):
        self.assertEqual(
            sum_due([(3, "123456789012345678901234567890.10"), (1, "0.20")]),
            "370370367037037036703703703670.50",
        )

    def test_large_quantity(self):
        self.assertEqual(
            sum_due([(123456789012345678901234567890, "0.10")]),
            "12345678901234567890123456789.00",
        )

    def test_local_precision_and_context_preservation(self):
        with localcontext() as context:
            context.prec = 3
            self.assertEqual(
                sum_due([(1, "9007199254740993.10"), (1, "0.20")]),
                "9007199254740993.30",
            )
            self.assertEqual(context.prec, 3)

    def test_fraction_alignment_and_carry(self):
        self.assertEqual(sum_due([(1, "999.999"), (1, "0.001")]), "1000.00")


if __name__ == "__main__":
    unittest.main()
