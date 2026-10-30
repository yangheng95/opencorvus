import unittest

from duration import normalize_duration


class NormalizeDurationTests(unittest.TestCase):
    def test_hours_and_minutes(self):
        self.assertEqual(normalize_duration("1:30"), 90)

    def test_whitespace_and_leading_zero(self):
        self.assertEqual(normalize_duration(" 02:05 "), 125)

    def test_zero(self):
        self.assertEqual(normalize_duration("0"), 0)

    def test_minutes(self):
        self.assertEqual(normalize_duration("45"), 45)

    def test_minute_out_of_range(self):
        with self.assertRaises(ValueError) as caught:
            normalize_duration("2:75")
        self.assertEqual(str(caught.exception), "MINUTE_OUT_OF_RANGE")

    def test_negative_duration(self):
        with self.assertRaises(ValueError) as caught:
            normalize_duration("-1")
        self.assertEqual(str(caught.exception), "INVALID_DURATION")


if __name__ == "__main__":
    unittest.main()
