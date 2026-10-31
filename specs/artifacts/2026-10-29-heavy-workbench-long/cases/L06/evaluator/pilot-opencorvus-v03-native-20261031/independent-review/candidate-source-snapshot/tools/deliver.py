"""Derive exact delivery tables and readable report from actual executed journals."""

import csv
from fractions import Fraction
import json
from pathlib import Path
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    Table,
    TableStyle,
    PageBreak,
)
from common import (
    ROOT,
    PUBLIC,
    load_data,
    event,
    canonical,
    audit_policy,
    contingency,
    advance,
    initial_state,
    save,
)


def exact(value):
    value = Fraction(value)
    return int(value) if value.denominator == 1 else str(value)


def main():
    data, _ = load_data(PUBLIC)
    run = ROOT / "exercise/run-001"
    output = ROOT / "results"
    policy = json.loads((ROOT / "policy.json").read_text())
    journals = json.loads((run / "journals.json").read_text())
    audit = audit_policy(data, policy)
    alternative, base = contingency(data)
    save(output / "canonical-alternative.json", alternative)
    save(output / "canonical-audit.json", base)
    expected = Fraction(
        **{
            "numerator": audit["expected_cost_exact"]["numerator"],
            "denominator": audit["expected_cost_exact"]["denominator"],
        }
    )
    baseline = Fraction(
        base["expected_cost_exact"]["numerator"],
        base["expected_cost_exact"]["denominator"],
    )
    components = {
        key: Fraction()
        for key in ("purchase_cost", "freight_cost", "production_cost", "holding_cost")
    }
    receivables, ledger, commitments = {}, [], []
    analytic_bound = Fraction()
    for path in data["scenarios"]:
        pid = path["id"]
        state = initial_state(data)
        prob = Fraction(path["probability_numerator"], data["probability_denominator"])
        for t, item in enumerate(journals[pid]):
            state, row = advance(data, state, item["event"], item["action"])
            ledger.append(
                {
                    "path": pid,
                    "week": t,
                    **{
                        target: row[source]
                        for target, source in (
                            ("purchase", "purchase_cost"),
                            ("freight", "freight_cost"),
                            ("production", "production_cost"),
                            ("holding", "holding_cost"),
                            ("cost", "cost"),
                            ("receipts", "receipts"),
                            ("cash", "cash"),
                            ("raw_peak", "raw_stage_peak_volume"),
                            ("finished_peak", "product_stage_peak_volume"),
                        )
                    },
                }
            )
            for key in components:
                components[key] += prob * row[key]
            action = item["action"]
            for a, supplier in enumerate(data["suppliers"]):
                commitments.append(
                    [pid, t, "truck", supplier["id"], "", action["truck_on"][a]]
                )
                for m, raw in enumerate(data["raw_materials"]):
                    commitments.append(
                        [
                            pid,
                            t,
                            "order_lots",
                            supplier["id"],
                            raw,
                            action["order_lots"][a][m],
                        ]
                    )
            for p, plant in enumerate(data["plants"]):
                for j, product in enumerate(data["products"]):
                    commitments.append(
                        [
                            pid,
                            t,
                            "production",
                            plant,
                            product,
                            action["production"][p][j],
                        ]
                    )
        receivables[pid] = {
            "final_cash": state["cash"],
            "minimum_cash": min(r["cash"] for r in ledger if r["path"] == pid),
            "final_receivable": sum(state["receipts_by_week"][16:]),
            "due_after_horizon": {
                str(w): amount
                for w, amount in enumerate(state["receipts_by_week"])
                if w >= 16 and amount
            },
        }
        totals = [
            sum(path["demand"][t][j] for t in range(16)) - data["initial_products"][j]
            for j in range(4)
        ]
        # A deliberately weak but exact rational bound: all freight/holding are
        # nonnegative; every delivered unit consumes BOM and allowed route labor.
        lower = sum(
            totals[j]
            * min(
                data["production_cost_minor"][p][j]
                for p in range(2)
                if data["allowed"][p][j]
            )
            for j in range(4)
        )
        lower += sum(
            max(
                0,
                sum(totals[j] * data["bom"][j][m] for j in range(4))
                - data["initial_raw"][m],
            )
            * min(s["price_minor"][m] for s in data["suppliers"])
            for m in range(4)
        )
        analytic_bound += prob * lower
    with (output / "weekly-ledger.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(ledger[0]))
        writer.writeheader()
        writer.writerows(ledger)
    with (output / "commitment-policy.csv").open(
        "w", newline="", encoding="utf-8"
    ) as f:
        writer = csv.writer(f)
        writer.writerow(["path", "week", "kind", "entity", "item", "quantity"])
        writer.writerows(commitments)
    terminal = json.loads((run / "owner-terminal.json").read_text())
    optimization = json.loads((output / "optimization.json").read_text())
    relaxation = json.loads((output / "information-relaxation.json").read_text())
    summary = {
        "expected_cost_exact": exact(expected),
        "alternative_exact": exact(baseline),
        "saving_exact": exact(baseline - expected),
        "saving_fraction_exact": exact((baseline - expected) / baseline),
        "quality_maximum_exact": 60044,
        "components_exact": {k: exact(v) for k, v in components.items()},
        "minimum_cash": min(r["cash"] for r in ledger),
        "information_nodes": audit["information_nodes"],
        "full_path_count": 8,
        "probabilities_exact": {
            s["id"]: exact(
                Fraction(s["probability_numerator"], data["probability_denominator"])
            )
            for s in data["scenarios"]
        },
        "exact_analytic_lower_bound": exact(analytic_bound),
        "native_execution_provenance": terminal,
        "optimization_provenance": optimization,
        "information_relaxation_provenance": relaxation,
        "limits": "Finite public support and one controlled receipt-loss recovery only. Not global optimality, independent acceptance, real-world finance approval, OS confinement or power-loss certification.",
    }
    assert (
        sum(components.values()) == expected
        and len(ledger) == 128
        and len(commitments) == 2944
    )
    save(output / "summary.json", summary)
    save(output / "receivables.json", receivables)
    source_map = {
        "authority": "All 25 frozen public files; historical draft wording does not weaken the contract.",
        "source_files": sorted(
            p.relative_to(ROOT).as_posix()
            for p in PUBLIC.rglob("*")
            if p.is_file() and "__pycache__" not in p.parts
        ),
        "indices": {
            "raw": data["raw_materials"],
            "product": data["products"],
            "plant": data["plants"],
            "supplier": [s["id"] for s in data["suppliers"]],
        },
        "mapping": {
            "policy.json": "tools/solve.py: shared complete event-prefix nodes; supplier_terms and supplier_quotes determine pack units, freight and lead; demand/capacity tables determine current events.",
            "actor": "actor/actor.py: reads public support using explicit raw indices; reconstructs original committed prefix with public packet/replay; compares all consistent support actions. Never selects a future path.",
            "weekly-ledger.csv": "Actual exercise/run-001/journals.json replay using public tree_business.advance; integer minor units. Peaks are BEFORE consumption/dispatch, holding is AFTER fulfilment.",
            "commitment-policy.csv": "Every executed action coordinate including zeros; lot counts (not units), truck supplier ID and empty item, production plant/product IDs.",
            "receivables.json": "Original demand sales prices at absolute due week t+4; week16..19 assets excluded from week15 spendable cash and operating cost.",
            "summary.json": "Exact Fraction-weighted public replay; components keyed purchase_cost/freight_cost/production_cost/holding_cost. Solver floats appear only in explicitly labeled provenance.",
            "figures": "Direct plot of delivered integer weekly ledger and exact component sums; no fabricated illustrative observations.",
            "exercise": "Unmodified public/exercise.py executes this actor; actual commands/PIDs/SQLite exports, commit73/restart, original receipt and row reversal are retained.",
        },
        "equations": {
            "units_ordered": "lot[a,m] * pack[a,m]",
            "raw": "old_raw + all_due_arrivals + lead0 - BOM * made",
            "finished": "old_finished + made - demand",
            "cost": "purchase + freight + production + end-stock holding",
            "cash": "old_cash + historical_receipts - current_cost",
            "expected": "sum(path_cost * probability_numerator / 8)",
        },
        "preservation": "public is read-only; no private sources; no ineffective checksum acceptance. Request-ID digest identifies an idempotency payload, not correctness.",
    }
    assert len(source_map["source_files"]) == 25
    save(output / "source-map.json", source_map)
    figures = ROOT / "figures"
    figures.mkdir(exist_ok=True)
    plt.rcParams.update(
        {"font.size": 10, "axes.spines.top": False, "axes.spines.right": False}
    )
    fig, axes = plt.subplots(
        3, 1, figsize=(10, 9), sharex=True, constrained_layout=True
    )
    for path in data["scenarios"]:
        rows = [r for r in ledger if r["path"] == path["id"]]
        for ax, key in zip(axes, ["cash", "raw_peak", "finished_peak"]):
            ax.plot(
                range(16),
                [r[key] for r in rows],
                marker=".",
                label=path["id"],
                alpha=0.8,
            )
    axes[0].axhline(
        -9000, color="crimson", linestyle="--", label="intermediate floor -9000"
    )
    axes[0].scatter([15], [0], color="black", marker="x", label="terminal floor 0")
    axes[0].set_ylabel("End-week cash\n(minor units)")
    axes[0].legend(ncol=5, fontsize=8)
    axes[1].axhline(240, color="crimson", linestyle="--")
    axes[1].set_ylabel("Raw stage peak\n(volume units)")
    axes[2].axhline(100, color="crimson", linestyle="--")
    axes[2].set_ylabel("Finished stage peak\n(volume units)")
    axes[2].set_xlabel("Week (0..15)")
    axes[2].set_xticks(range(16))
    fig.suptitle(
        "Executed causal policy: liquidity and pre-consumption / pre-dispatch peaks"
    )
    fig.savefig(figures / "cash-and-storage.png", dpi=160)
    plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.8), constrained_layout=True)
    names = ["Purchase", "Freight", "Production", "Holding"]
    bottom = [0.0, 0.0]
    for key, label in zip(components, names):
        values = [
            float(components[key]),
            sum(
                sum(r[key] for r in base["paths"][s["id"]]["weeks"])
                for s in data["scenarios"]
            )
            / 8,
        ]
        axes[0].bar(
            ["Causal policy", "Canonical spot"], values, bottom=bottom, label=label
        )
        bottom = [a + b for a, b in zip(bottom, values)]
    axes[0].set_ylabel("Expected operating cost (minor units)")
    axes[0].legend(fontsize=8)
    axes[0].set_title(f"Saving: {float((baseline - expected) / baseline):.2%}")
    xs = [s["id"] for s in data["scenarios"]]
    axes[1].plot(
        xs,
        [audit["paths"][s]["total_cost_minor"] for s in xs],
        "o-",
        label="Causal policy",
    )
    axes[1].plot(
        xs,
        [base["paths"][s]["total_cost_minor"] for s in xs],
        "s-",
        label="Canonical spot",
    )
    axes[1].axhline(
        relaxation["objective_float"],
        linestyle=":",
        color="gray",
        label="PI continuous expected cost*",
    )
    axes[1].set_ylabel("Path cost (minor units)")
    axes[1].legend(fontsize=8)
    axes[1].set_title("All eight equally probable paths")
    fig.suptitle(
        "*Perfect information (PI) + fractional packs/trucks: non-deployable numerical relaxation"
    )
    fig.savefig(figures / "cost-comparison.png", dpi=160)
    plt.close(fig)
    report = f"""# Staged factory: causal commitments, execution and operational handoff

## Executive result

The delivered policy costs exactly {expected} minor units in expectation across eight equally probable paths. The actual executable canonical current-needs spot alternative costs {baseline}. Saving is {baseline - expected} ({float((baseline - expected) / baseline):.4%}), exceeding the declared 15% target; the exact maximum is 60044. Expected purchase, freight, production and holding are {", ".join(k + "=" + str(v) for k, v in components.items())}. Minimum settled cash is {summary["minimum_cash"]}; all intermediate weeks satisfy -9000 and every terminal cash balance is nonnegative. See receivables.json for every path's week16..19 assets; those receipts are not spent early.

## Policy and causal information

tools/solve.py builds a mixed-integer linear program with integer pack counts, binary trucks, integer routed production and end stocks. One node is one complete observed event prefix; there are {audit["information_nodes"]} week-indexed information nodes. All actions at a common prefix share variables. Parent stock and cash, and ancestor lead-time orders, connect nodes. Each path enforces the complete raw BOM, allowed routes, shared hours, supplier volumes and minimum dispatch, both stage peaks, delayed receipts, credit floors and terminal restrictions. Positive orders must arrive before week16. Finished stock is exactly zero at week15; raw stock has holding but no salvage.

The actor has no optimizer dependency. It reads only public support and current stdin packets, reconstructs state from every committed event/action/receipt, rejects inconsistent packets or a changed historical action, finds support paths with the same COMPLETE history, and requires their prescribed current actions to coincide. Internal support labels index offline arrays only; no actual selected path or future is provided on stdin, argv or environment. It validates the proposed current action before responding. Determinism uses no randomness; request identity is a digest of the complete observed history and action. No mutable actor checkpoint is required.

## Optimization and information relaxation

The causal solver stopped with status {optimization["status"]} ({optimization["message"]}); the integer incumbent is checked by exact public recurrence, not accepted from solver status alone. Native floating dual bound was {optimization["native_dual_bound_float"]} and reported relative gap {optimization["native_gap_float"]}. This is NOT an exact-optimality claim. The delivered policy is reusable even if re-solving under a different timing budget produces a different incumbent.

The required information relaxation is a separate perfect-information continuous model: path actions are no longer tied across histories and all packs/trucks/production may be fractional. Its numerical objective is {relaxation["objective_float"]:.9f}, status {relaxation["message"]}. This model is non-deployable and is not a perfect-information integer optimum; its solver floating arithmetic is not an independently proved rational lower certificate. A separate exact analytic lower bound is {analytic_bound}: over the horizon, net demand requires at least its BOM minus initial raw stock, purchased at the cheapest listed unit prices, and at least the cheapest allowed production cost per delivered unit. Freight/holding are nonnegative. Ignoring capacity, timing, freight, holding, packs and causality can only reduce cost. This exact bound is intentionally weak and does not prove the incumbent optimal. No old-instance bound is used.

## Actual source execution and durable recovery

The unmodified public/exercise.py ran the delivered actor with the standard-library Python3.14 host. exercise/run-001/owner-terminal.json records 128 path commits, 16 row-order-control commits and 10 actual worker processes. One controller exited 73 immediately after durably committing week7, before the next acknowledgement. The restarted controller read the original SQLite prefix, revalidated it, recovered the original receipt, and continued at week8 without editing any of the first eight rows. The original database backup, before-loss transcript, crash-after-commit record, resume-receipt and final export are preserved. The row-order control reverses CSV rows while explicit identity indices remain authoritative. The checker compared actual journal actions and business rows against the declared policy for all paths. These are producer diagnostics, not independent acceptance.

## Ledgers, financial discipline and figures

weekly-ledger.csv contains 128 exact integer rows. commitment-policy.csv contains all 2944 action coordinates including zeros; lots are pack counts, not raw units. source-map.json ties each field to the raw tables and equations. summary.json carries exact probabilities, component sums, cost, minimum cash, information nodes and native/optimization provenance. receivables.json includes each nonzero post-horizon amount at its original absolute due week.

Figure 1 plots all paths' settled cash and storage peaks from actual journals. Red dashed lines are business limits; the black cross is the week15 cash floor. Figure 2 compares cost components and per-path costs against the actual canonical policy. The gray line is only the expected perfect-information continuous relaxation, not a per-path lower bound. Common prefixes overlap; equal lines are not evidence that future events were observed.

## Crisis, credit and recovery desk

Before committing, use historical due arrivals and receipts from the original prefix; do not cancel an in-flight order after a supplier capacity announcement. Recheck current volumes, BOM, shared hours, both stage peaks and settled cash. Never finance today's costs with week16+ receivables. Preserve the journal and stop on unsupported observations, corrupt receipts, policy-history disagreement or credit infeasibility; do not invent another stock balance, approval or fallback purchase. A new event outside this finite support requires a new authorized decision, not an asserted guarantee. The canonical spot policy is a comparator, not an automatic switch: changing irrevocable past commitments requires a separately validated continuation.

On acknowledgement loss, retain the original database including its WAL files; reopen through the same controller and same public facts, and replay the original event/action/request ID to retrieve the original receipt. Do not submit a new ID to repeat a completed week. A conflicting payload under an old ID must fail. Do not overwrite a failed output directory. Back up before operator recovery; do not manually edit committed rows or receivable dates. The included exercise demonstrates this one bounded controller-loss case only.

## Reproduction and limits

See HANDOFF.md for exact source/output paths, installation and commands. Only solving and report generation need project-local dependencies; online actor/exercise need standard-library Python3.14. tools/verify.py independently recomputes all executed numerical recurrences from public raw facts and compares tables, policy and SQLite records; tools/test_actor.py checks packet reconstruction and deterministic continuation, including negative tests.

No real suppliers, customers, procurement, currency, financial approvals, arbitrary-failure guarantees, OS filesystem/memory confinement or power-loss certification are asserted. Simulated weeks and process timestamps are not agent working hours. The mixed-integer solve's time limit remains a truthful optimization limitation, not a feasibility failure. Independent review is pending. Original exercise records and local dependency versions are retained, without self-scoring.

Terminology: BOM = bill of materials; CSV = comma-separated values; PID = process identifier; WAL = write-ahead log; OS = operating system; JSON = JavaScript Object Notation. SQLite schema2 is the public controller's version2 database contract. Monetary values are synthetic minor units, not real currency.
"""
    (ROOT / "REPORT.md").write_text(report, encoding="utf-8")
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(ROOT / "REPORT.pdf"),
        pagesize=(612, 792),
        rightMargin=48,
        leftMargin=48,
        topMargin=44,
        bottomMargin=44,
    )
    story = []
    from xml.sax.saxutils import escape

    for block in report.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        if block.startswith("# "):
            story.append(Paragraph(escape(block[2:]), styles["Title"]))
        elif block.startswith("## "):
            story.append(Paragraph(escape(block[3:]), styles["Heading2"]))
        else:
            story.append(Paragraph(escape(block), styles["BodyText"]))
        story.append(Spacer(1, 7))
    story.pop()  # Avoid spilling a trailing spacer onto an empty page.
    story.extend(
        [
            PageBreak(),
            Paragraph(
                "Figure 1. Executed liquidity and stage peaks", styles["Heading2"]
            ),
            Image(
                str(figures / "cash-and-storage.png"), width=7 * inch, height=6.3 * inch
            ),
            PageBreak(),
            Paragraph(
                "Figure 2. Canonical comparison and information relaxation",
                styles["Heading2"],
            ),
            Image(
                str(figures / "cost-comparison.png"),
                width=7 * inch,
                height=7 * inch * 4.8 / 11,
            ),
        ]
    )
    table = [["Path", "Cost", "Final cash", "Min cash", "Late assets"]]
    for path in data["scenarios"]:
        pid = path["id"]
        r = receivables[pid]
        table.append(
            [
                pid,
                str(audit["paths"][pid]["total_cost_minor"]),
                str(r["final_cash"]),
                str(r["minimum_cash"]),
                str(r["final_receivable"]),
            ]
        )
    table_doc = Table(table, repeatRows=1)
    table_doc.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5eaf0")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend([Spacer(1, 20), table_doc])
    doc.build(story)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
