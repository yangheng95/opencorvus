"""Positive data/scoring contracts. Synthetic marks test mechanics, not judge quality."""

import importlib.util
import math
import shutil
import tempfile
import unittest
from pathlib import Path

import heavy_workbench as bench

spec = importlib.util.spec_from_file_location(
    "reference", bench.PACKAGE / "reference_calculations.py"
)
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


class ComputationalContracts(unittest.TestCase):
    def test_cluster_difference_and_sampling_uncertainty(self):
        rows = [
            dict(
                id=str(i),
                school=str(i),
                arm=str(i // 2),
                eligible="1",
                pre="10",
                post=str(10 + d),
            )
            for i, d in enumerate((1, 3, 4, 6))
        ]
        result = reference.outputs("H01", rows)
        self.assertEqual(result["estimate"][0]["effect"], 3)
        self.assertEqual(result["estimate"][0]["se"], math.sqrt(2))
        self.assertEqual(result["attrition"][0]["eligible"], 2)

    def test_rolling_predictions_and_one_based_horizon(self):
        rows = [dict(t=str(t), value=str(t)) for t in range(392)]
        result = reference.outputs("H02", rows)
        self.assertEqual(
            result["forecasts"][0],
            dict(origin=168, model="last", horizon=1, prediction=167),
        )
        self.assertEqual(result["metrics"][0]["mae"], 14.5)
        seasonal = next(
            x
            for x in result["forecasts"]
            if x["origin"] == 168 and x["model"] == "seasonal7" and x["horizon"] == 8
        )
        self.assertEqual(seasonal["prediction"], 161)

    def test_cash_rounds_each_voucher_with_decimal_half_up(self):
        rows = [
            dict(
                id=str(i),
                month="2026-01",
                department="sales",
                status="paid",
                amount="0.015",
                fx="1",
            )
            for i in range(2)
        ]
        self.assertEqual(reference.outputs("H03", rows)["cash"][0]["net"], 0.04)

    def test_migration_keeps_signed_minor_units_and_natural_keys(self):
        rows = [
            dict(id="O1", customer="C2", currency="USD", total="-12.34"),
            dict(id="O2", customer="C1", currency="CNY", total="0.01"),
        ]
        result = reference.outputs("H04", rows)
        self.assertEqual(
            result["orders"][0],
            dict(order_id="O1", customer_id=2, currency="USD", total_minor=-1234),
        )
        self.assertEqual(result["audit"][0]["total_minor"], 1)

    def test_event_identity_includes_tenant_and_replays_converge(self):
        rows = [
            dict(tenant="alpha", event_id="E1", amount="100"),
            dict(tenant="beta", event_id="E1", amount="200"),
            dict(tenant="alpha", event_id="E1", amount="100"),
        ]
        result = reference.outputs("H05", rows)
        self.assertEqual(
            result["replay"],
            [
                {"pass": 1, "distinct": 2, "total": 300},
                {"pass": 2, "distinct": 2, "total": 300},
            ],
        )
        self.assertEqual(
            result["duplicates"], [dict(tenant="alpha", event_id="E1", attempts=2)]
        )

    def test_procurement_baseline_is_feasible_cost_upper_bound(self):
        rows = [dict(sku="A", week="1", demand="10", capacity="6", unit_cost="20")]
        result = reference.outputs("H06", rows)
        self.assertEqual(result["baseline"][0]["cost"], 260)
        self.assertEqual(result["capacity"][0]["expedite_needed_without_inventory"], 4)

    def test_meta_analysis_uses_only_eligible_final_results(self):
        rows = [
            dict(
                study="A",
                design="randomized",
                followup_weeks="12",
                effect="0.2",
                se="0.1",
                risk="low",
            ),
            dict(
                study="B",
                design="randomized",
                followup_weeks="8",
                effect="0.4",
                se="0.1",
                risk="high",
            ),
            dict(
                study="C",
                design="observational",
                followup_weeks="12",
                effect="9",
                se="0.01",
                risk="high",
            ),
        ]
        result = reference.outputs("H07", rows)
        self.assertAlmostEqual(result["pooled"][0]["effect"], 0.3)
        self.assertAlmostEqual(result["pooled"][0]["se"], math.sqrt(1 / 200))

    def test_schedule_lower_bound_differs_from_resource_workload(self):
        result = reference.outputs("H08", reference.make_inputs()["H08"])
        engineer = next(x for x in result["roles"] if x["role"] == "engineer")
        self.assertEqual(engineer["person_days"], 38)
        self.assertEqual(result["bounds"][0]["days"], 26)
        self.assertEqual(result["bounds"][0]["cost"], 67400)

    def test_mastery_threshold_is_inclusive(self):
        rows = [
            dict(learner="A", topic="sql", score="70", cohort="novice"),
            dict(learner="B", topic="sql", score="69", cohort="experienced"),
        ]
        result = reference.outputs("H09", rows)
        self.assertEqual(result["mastery"][0]["count"], 1)
        self.assertEqual(
            result["support"],
            [
                dict(learner="A", topics_below_70=0),
                dict(learner="B", topics_below_70=1),
            ],
        )

    def test_energy_totals_preserve_units_and_tariff_stress(self):
        rows = [
            dict(site=site, day=str(day), hour=str(hour), kwh="1", tariff="0.5")
            for site in ("A", "B", "C")
            for day in range(1, 31)
            for hour in range(24)
        ]
        result = reference.outputs("H10", rows)
        self.assertEqual(result["daily"][0]["kwh"], 24)
        self.assertEqual(result["baseline"][0]["cost"], 360)
        self.assertEqual(result["stress"][0]["cost_plus20"], 432)


class GradingContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def artifacts(self, cid):
        case = bench.select(cid)
        out = self.root / cid
        for leaf in case["rubric"][:4]:
            check = leaf["check"]
            target = out / check["artifact"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(bench.PACKAGE / check["expected"], target)
        (out / "evidence.md").write_text(
            "Synthetic scoring mechanics evidence. Not an expert deliverable.\n",
            encoding="utf-8",
        )
        return out

    def run_record(self, cid="H01"):
        budget = {
            k: v
            for k, v in bench.select(cid)["budget"].items()
            if k not in {"expert_hours_estimate", "estimate_status"}
        }
        return dict(
            run_id=f"{cid}-mechanics",
            case=cid,
            version="0.1.0-dev",
            system="synthetic-mechanics",
            model="none",
            tool_profile="unit-test",
            environment="temporary-directory",
            input_revision="test",
            budget=budget,
            started_at="2026-10-29T00:00:00Z",
            ended_at="2026-10-29T00:01:00Z",
            disposition="completed",
            replay=dict(
                status="verified",
                reviewer="test-witness",
                evidence=[
                    dict(
                        path="evidence.md",
                        locator="line 1",
                        observation="synthetic mechanics witness",
                    )
                ],
            ),
        )

    def reviews(self, cid="H01", rating=2):
        return [
            dict(
                reviewer=name,
                case=cid,
                version="0.1.0-dev",
                run_id=f"{cid}-mechanics",
                blind=True,
                independent=True,
                marks=[
                    dict(
                        leaf=x["id"],
                        rating=rating,
                        rationale="Synthetic anchor mechanics only.",
                        evidence=[
                            dict(
                                path="evidence.md",
                                locator="line 1",
                                observation="synthetic witness",
                            )
                        ],
                    )
                    for x in bench.select(cid)["rubric"][4:]
                ],
            )
            for name in ("test-a", "test-b")
        ]

    def test_definition_has_ten_complete_scoring_contracts(self):
        self.assertEqual(
            bench.validate(),
            dict(version="0.1.0-dev", cases=10, leaves=200, status="definition_valid"),
        )

    def test_export_gives_usable_public_case_and_schema(self):
        target = self.root / "export"
        receipt = bench.prepare("H01", target)
        self.assertEqual(receipt["case"], "H01")
        self.assertEqual(
            bench.load(target / "task.json")["result_contract"]["diagnostic_schema"][2][
                "record_keys"
            ],
            [{"id": "complete_case"}],
        )
        self.assertEqual(len(bench.table(target / "inputs/records.csv")), 720)

    def test_actual_checker_scores_all_forty_diagnostic_tables(self):
        reports = [
            bench.objective(f"H{i:02d}", self.artifacts(f"H{i:02d}"))
            for i in range(1, 11)
        ]
        self.assertEqual([r["points"] for r in reports], [20] * 10)
        self.assertEqual(sum(len(r["leaves"]) for r in reports), 40)

    def test_real_value_error_maps_to_explicit_zero_leaf(self):
        out = self.artifacts("H01")
        path = out / "diagnostics/estimate.csv"
        rows = bench.table(path)
        rows[0]["effect"] = "999"
        reference.write_table(path, rows)
        result = bench.objective("H01", out)
        self.assertEqual(result["points"], 15)
        self.assertEqual(result["leaves"][2]["reason"], "value_mismatch")

    def test_nonfinite_number_is_artifact_contract_error(self):
        out = self.artifacts("H01")
        path = out / "diagnostics/estimate.csv"
        rows = bench.table(path)
        rows[0]["effect"] = "NaN"
        reference.write_table(path, rows)
        result = bench.objective("H01", out)
        self.assertEqual(result["leaves"][2]["reason"], "artifact_contract_error")

    def test_unreadable_oracle_is_infrastructure_error(self):
        package = self.root / "package"
        shutil.copytree(bench.PACKAGE, package)
        (package / "oracle/H01/estimate.csv").write_text(
            "wrong\nvalue\n", encoding="utf-8"
        )
        with self.assertRaises(bench.ContractError) as caught:
            bench.objective("H01", self.artifacts("H01"), package)
        self.assertEqual(caught.exception.code, "oracle_integrity")

    def test_score_is_evidence_bound_provisional_and_retains_condition(self):
        report = bench.grade(
            "H01", self.artifacts("H01"), self.reviews(), self.run_record()
        )
        self.assertEqual(report["score"], 100)
        self.assertEqual(report["assessment"], "provisional")
        self.assertEqual(report["condition"]["system"], "synthetic-mechanics")
        self.assertEqual(report["provisional_qualified"], True)

    def test_disagreement_remains_visible_and_unqualified(self):
        reviews = self.reviews()
        reviews[1]["marks"][0]["rating"] = 1
        report = bench.grade("H01", self.artifacts("H01"), reviews, self.run_record())
        self.assertEqual(report["score"], 98.75)
        self.assertEqual(report["disagreements"], ["H01-R01"])
        self.assertEqual(report["provisional_qualified"], False)

    def test_infrastructure_failure_is_unscored_without_fabricated_reviews(self):
        run = self.run_record()
        run["disposition"] = "infra_error"
        report = bench.grade("H01", self.root, [], run)
        self.assertEqual(report["assessment"], "unscored")
        self.assertEqual(report["disposition"], "infra_error")
        self.assertEqual(report["score"], None)

    def reports(self):
        return [
            dict(
                case=f"H{i:02d}",
                run_id=f"{i}-a",
                version="0.1.0-dev",
                score=i * 5,
                condition=dict(
                    system="A",
                    model="M",
                    environment="E",
                    input_revision="I",
                    budget="B",
                    tool_profile="T",
                ),
            )
            for i in range(1, 11)
        ]

    def test_complete_aggregation_equal_weights_cases(self):
        reports = self.reports()
        reports.append({**reports[0], "run_id": "1-b", "score": 15})
        result = bench.summarize(reports)
        self.assertEqual(result["case_means"]["H01"], 10)
        self.assertEqual(result["macro_mean"], 28)

    def test_unknown_cases_map_to_scope_error(self):
        reports = self.reports()
        reports[0]["case"] = "OTHER"
        with self.assertRaises(bench.ContractError) as caught:
            bench.summarize(reports)
        self.assertEqual(caught.exception.code, "summary_scope")

    def test_out_of_range_score_maps_to_score_error(self):
        reports = self.reports()
        reports[0]["score"] = 999
        with self.assertRaises(bench.ContractError) as caught:
            bench.summarize(reports)
        self.assertEqual(caught.exception.code, "summary_score")

    def test_mixed_models_map_to_condition_error(self):
        reports = self.reports()
        reports[0]["condition"]["model"] = "OTHER"
        with self.assertRaises(bench.ContractError) as caught:
            bench.summarize(reports)
        self.assertEqual(caught.exception.code, "summary_condition")

    def test_incomplete_coverage_reports_partial_case_means(self):
        result = bench.summarize(self.reports()[:2])
        self.assertEqual(result["observed_cases"], 2)
        self.assertEqual(result["macro_mean"], None)

    def procurement_plan(self, scenario):
        inputs = bench.PACKAGE / "inputs/H06"
        rows = []
        for raw in bench.table(inputs / "records.csv"):
            capacity = int(raw["capacity"])
            if scenario == "stress" and 6 <= int(raw["week"]) <= 8:
                capacity = math.floor(capacity * 0.8)
            regular = min(capacity, int(raw["demand"]))
            rows.append(
                dict(
                    sku=raw["sku"],
                    week=raw["week"],
                    regular=regular,
                    expedite=int(raw["demand"]) - regular,
                    closing_inventory=0,
                )
            )
        return rows

    def test_procurement_checker_accepts_feasible_base_and_stress_plans(self):
        for scenario in ("base", "stress"):
            path = self.root / f"{scenario}.csv"
            reference.write_table(path, self.procurement_plan(scenario))
            result = bench.verify_plan(
                "H06", bench.PACKAGE / "inputs/H06", path, scenario
            )
            self.assertEqual(result["passed"], True)
            self.assertGreater(result["metrics"]["cost_cny"], 0)

    def test_procurement_imbalance_has_explicit_business_violation(self):
        rows = self.procurement_plan("base")
        rows[0]["closing_inventory"] = 1
        path = self.root / "invalid.csv"
        reference.write_table(path, rows)
        result = bench.verify_plan("H06", bench.PACKAGE / "inputs/H06", path)
        self.assertEqual(result["violations"][0]["code"], "material_balance")

    def schedule(self, scenario="base"):
        finish, available, rows = {}, {}, []
        for raw in bench.table(bench.PACKAGE / "inputs/H08/records.csv"):
            start = max(
                [finish[p] for p in raw["deps"].split("|") if p]
                + [available.get(raw["role"], 0)]
            )
            duration = int(raw["duration"]) + (
                3 if scenario == "stress" and raw["task"] == "T07" else 0
            )
            end = start + duration
            finish[raw["task"]] = end
            available[raw["role"]] = end
            rows.append(dict(task=raw["task"], start=start, finish=end))
        return rows

    def test_schedule_checker_accepts_resource_feasible_base_and_stress(self):
        for scenario in ("base", "stress"):
            path = self.root / f"{scenario}.csv"
            reference.write_table(path, self.schedule(scenario))
            result = bench.verify_plan(
                "H08", bench.PACKAGE / "inputs/H08", path, scenario
            )
            self.assertEqual(result["passed"], True)
            self.assertEqual(result["metrics"]["makespan_days"], 38)

    def test_overlapping_role_has_explicit_business_violation(self):
        rows = self.schedule()
        rows[2]["start"] = 0
        rows[2]["finish"] = 3
        path = self.root / "overlap.csv"
        reference.write_table(path, rows)
        result = bench.verify_plan("H08", bench.PACKAGE / "inputs/H08", path)
        self.assertIn("resource_overlap", [x["code"] for x in result["violations"]])

    def dispatch(self, efficiency=0.95):
        rows = []
        for raw in bench.table(bench.PACKAGE / "inputs/H10/records.csv"):
            first = raw["site"] == "A" and raw["day"] == "1"
            charge = 1 if first and raw["hour"] == "0" else 0
            discharge = efficiency**2 if first and raw["hour"] == "1" else 0
            rows.append(
                dict(
                    site=raw["site"],
                    day=raw["day"],
                    hour=raw["hour"],
                    capacity_kwh=50 if raw["site"] == "A" else 0,
                    charge_kwh=charge,
                    discharge_kwh=discharge,
                    soc_kwh=efficiency if charge else 0,
                    grid_kwh=float(raw["kwh"]) + charge - discharge,
                )
            )
        return rows

    def test_energy_checker_accepts_nonzero_physical_cycle_in_all_scenarios(self):
        for scenario, eff in [("base", 0.95), ("price", 0.95), ("efficiency", 0.9)]:
            path = self.root / f"{scenario}.csv"
            reference.write_table(path, self.dispatch(eff))
            result = bench.verify_plan(
                "H10", bench.PACKAGE / "inputs/H10", path, scenario
            )
            self.assertEqual(result["passed"], True)
            self.assertEqual(result["metrics"]["capacities_kwh"]["A"], 50)

    def test_energy_imbalance_has_explicit_business_violation(self):
        rows = self.dispatch()
        rows[0]["soc_kwh"] = 0.5
        path = self.root / "imbalance.csv"
        reference.write_table(path, rows)
        result = bench.verify_plan("H10", bench.PACKAGE / "inputs/H10", path)
        self.assertEqual(result["violations"][0]["code"], "soc_balance")

    def test_empty_fixed_input_is_infrastructure_integrity_error(self):
        for cid in ("H06", "H08", "H10"):
            copied = self.root / cid
            shutil.copytree(bench.PACKAGE / "inputs" / cid, copied)
            source = copied / "records.csv"
            source.write_text(
                source.read_text(encoding="utf-8").splitlines()[0] + "\n",
                encoding="utf-8",
            )
            with self.assertRaises(bench.ContractError) as caught:
                bench.verify_plan(cid, copied, self.root / "unused.csv")
            self.assertEqual(caught.exception.code, "input_integrity")

    def test_changed_deadline_is_infrastructure_integrity_error(self):
        copied = self.root / "inputs"
        shutil.copytree(bench.PACKAGE / "inputs/H08", copied)
        context = bench.load(copied / "context.json")
        context["plan_contract"]["deadline"] = 999
        bench.save(copied / "context.json", context)
        with self.assertRaises(bench.ContractError) as caught:
            bench.verify_plan("H08", copied, self.root / "unused.csv")
        self.assertEqual(caught.exception.code, "input_integrity")

    def test_changed_business_value_is_infrastructure_integrity_error(self):
        copied = self.root / "inputs"
        shutil.copytree(bench.PACKAGE / "inputs/H06", copied)
        rows = bench.table(copied / "records.csv")
        rows[0]["demand"] = "999"
        reference.write_table(copied / "records.csv", rows)
        with self.assertRaises(bench.ContractError) as caught:
            bench.verify_plan("H06", copied, self.root / "unused.csv")
        self.assertEqual(caught.exception.code, "input_integrity")

    def test_unreadable_plan_is_candidate_contract_error(self):
        result = bench.verify_plan(
            "H06", bench.PACKAGE / "inputs/H06", self.root / "missing.csv"
        )
        self.assertEqual(result["violations"][0]["code"], "plan_contract_error")


if __name__ == "__main__":
    unittest.main()
