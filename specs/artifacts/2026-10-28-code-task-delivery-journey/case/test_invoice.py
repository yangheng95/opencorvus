import unittest
from decimal import Inexact, ROUND_DOWN, localcontext

from invoice import sum_due


class SumDueTests(unittest.TestCase):
    def test_decimal_multiplication(self):
        self.assertEqual(sum_due([(3, "0.10")]), "0.30")

    def test_half_up(self):
        self.assertEqual(sum_due([(1, "1.005")]), "1.01")

    def test_large_original_acceptance(self):
        self.assertEqual(
            sum_due([(1, "9007199254740993.10"), (1, "0.20")]),
            "9007199254740993.30",
        )

    def test_empty(self):
        self.assertEqual(sum_due([]), "0.00")

    def test_long_fraction_below_half(self):
        self.assertEqual(sum_due([(1, "1.004" + "9" * 100)]), "1.00")

    def test_large_integer_and_fraction(self):
        price = "1234567890123456789012345678901234567890.125"
        self.assertEqual(
            sum_due([(2, price)]),
            "2469135780246913578024691357802469135780.25",
        )

    def test_round_only_final_total(self):
        self.assertEqual(sum_due([(1, "0.005"), (1, "0.005")]), "0.01")

    def test_large_quantity(self):
        self.assertEqual(sum_due([(10**60, "0.01")]), "1" + "0" * 58 + ".00")

    def test_cancellation_preserves_small_amount(self):
        self.assertEqual(sum_due([(1, "1e100"), (1, "0.015"), (-1, "1e100")]), "0.02")

    def test_negative_half_up(self):
        self.assertEqual(sum_due([(-1, "1.005")]), "-1.01")

    def test_sum_carry(self):
        self.assertEqual(sum_due([(1, "999.999")] * 1000), "999999.00")

    def test_independent_of_caller_context(self):
        with localcontext() as context:
            context.prec = 2
            context.rounding = ROUND_DOWN
            context.traps[Inexact] = True
            self.assertEqual(
                sum_due([(3, "12345678901234567890.005")]), "37037036703703703670.02"
            )
            self.assertEqual(context.prec, 2)
            self.assertEqual(context.rounding, ROUND_DOWN)
            self.assertTrue(context.traps[Inexact])


if __name__ == "__main__":
    unittest.main()
