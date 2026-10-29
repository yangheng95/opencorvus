"""Focused non-UI positive contracts; full real-process exercises live in reproduce.py."""

import csv
import sqlite3
import tempfile
import unittest
from pathlib import Path

from service import Service, ServiceError


class LedgerContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.root = Path(self.tmp.name)
        self.db = self.root / "ledger.sqlite"

    def tearDown(self):
        self.tmp.cleanup()

    def event(self, tenant="alpha", event_id="E0000", amount="100"):
        return {"tenant": tenant, "event_id": event_id, "amount": amount, "received_at": "2026-10-01T00:00:00Z"}

    def test_joint_identity_attempts_and_restart(self):
        service = Service(self.db)
        self.assertEqual(service.ingest(self.event())["status"], "inserted")
        self.assertEqual(service.ingest(self.event())["attempts"], 2)
        self.assertEqual(service.ingest(self.event("beta", amount="200"))["status"], "inserted")
        service.close()
        service = Service(self.db)
        self.assertEqual(service.ingest(self.event())["attempts"], 3)
        self.assertEqual(service.snapshot()["tenants"], {
            "alpha": {"distinct": 1, "total": 100, "attempts": 3},
            "beta": {"distinct": 1, "total": 200, "attempts": 1}})
        self.assertEqual(service.db.execute("SELECT event_id FROM ledger ORDER BY tenant").fetchall(), [("E0000",), ("E0000",)])
        service.close()

    def test_amount_conflict_has_explicit_error_contract(self):
        service = Service(self.db)
        service.ingest(self.event())
        with self.assertRaises(ServiceError) as captured:
            service.ingest(self.event(amount="101"))
        self.assertEqual(captured.exception.code, "AMOUNT_CONFLICT")
        self.assertEqual(service.snapshot()["tenants"]["alpha"], {"distinct": 1, "total": 100, "attempts": 1})
        service.close()

    def test_database_isolation_preserves_independent_money(self):
        first, second = Service(self.db), Service(self.root / "other.sqlite")
        first.ingest(self.event(amount="100"))
        second.ingest(self.event(amount="777"))
        self.assertEqual(first.snapshot()["tenants"]["alpha"], {"distinct": 1, "total": 100, "attempts": 1})
        self.assertEqual(second.snapshot()["tenants"]["alpha"], {"distinct": 1, "total": 777, "attempts": 1})
        first.close()
        second.close()

    def test_transaction_retry_after_storage_abort(self):
        service = Service(self.db)
        service.db.execute("CREATE TRIGGER fail_insert BEFORE INSERT ON ledger BEGIN SELECT RAISE(ABORT,'injected-storage-abort'); END")
        with self.assertRaises(sqlite3.IntegrityError) as captured:
            service.ingest(self.event())
        self.assertEqual(str(captured.exception), "injected-storage-abort")
        service.db.execute("DROP TRIGGER fail_insert")
        self.assertEqual(service.ingest(self.event())["status"], "inserted")
        self.assertEqual(service.snapshot()["tenants"]["alpha"], {"distinct": 1, "total": 100, "attempts": 1})
        service.close()

    def test_invalid_amount_maps_to_contract(self):
        service = Service(self.db)
        for raw in ("1.5", True, "100.0", "9223372036854775808"):
            with self.subTest(raw=raw), self.assertRaises(ServiceError) as captured:
                service.ingest(self.event(amount=raw))
            self.assertEqual(captured.exception.code, "INVALID_EVENT")
        self.assertEqual(service.ingest(self.event(amount="-10"))["amount"], -10)
        service.close()

    def test_identity_reconciliation_detects_cancelling_money(self):
        service = Service(self.db)
        service.ingest(self.event(event_id="wrong", amount="100"))
        expected = self.root / "expected.csv"
        with expected.open("w", newline="", encoding="utf8") as stream:
            writer = csv.DictWriter(stream, fieldnames=["tenant", "event_id", "amount", "received_at"])
            writer.writeheader()
            writer.writerow(self.event())
        policy = {"duplicate_rate_warning": 0.1, "reconciliation_amount_critical": 0,
                  "reconciliation_identities_critical": 0, "amount_conflicts_critical": 0}
        result = service.monitor(expected, policy)
        self.assertEqual(result["status"], "critical")
        self.assertEqual(result["tenants"][0]["amount_delta"], 0)
        self.assertEqual((result["tenants"][0]["missing"], result["tenants"][0]["extra"]), (1, 1))
        self.assertEqual(result["alerts"][0]["code"], "LEDGER_RECONCILIATION")
        service.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
