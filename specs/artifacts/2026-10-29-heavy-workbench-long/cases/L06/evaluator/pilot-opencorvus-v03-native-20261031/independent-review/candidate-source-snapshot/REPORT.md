# Staged factory: causal commitments, execution and operational handoff

## Executive result

The delivered policy costs exactly 197049/4 minor units in expectation across eight equally probable paths. The actual executable canonical current-needs spot alternative costs 70640. Saving is 85511/4 (30.2630%), exceeding the declared 15% target; the exact maximum is 60044. Expected purchase, freight, production and holding are purchase_cost=292949/8, freight_cost=12615/2, production_cost=5802, holding_cost=4273/8. Minimum settled cash is -3298; all intermediate weeks satisfy -9000 and every terminal cash balance is nonnegative. See receivables.json for every path's week16..19 assets; those receipts are not spent early.

## Policy and causal information

tools/solve.py builds a mixed-integer linear program with integer pack counts, binary trucks, integer routed production and end stocks. One node is one complete observed event prefix; there are 60 week-indexed information nodes. All actions at a common prefix share variables. Parent stock and cash, and ancestor lead-time orders, connect nodes. Each path enforces the complete raw BOM, allowed routes, shared hours, supplier volumes and minimum dispatch, both stage peaks, delayed receipts, credit floors and terminal restrictions. Positive orders must arrive before week16. Finished stock is exactly zero at week15; raw stock has holding but no salvage.

The actor has no optimizer dependency. It reads only public support and current stdin packets, reconstructs state from every committed event/action/receipt, rejects inconsistent packets or a changed historical action, finds support paths with the same COMPLETE history, and requires their prescribed current actions to coincide. Internal support labels index offline arrays only; no actual selected path or future is provided on stdin, argv or environment. It validates the proposed current action before responding. Determinism uses no randomness; request identity is a digest of the complete observed history and action. No mutable actor checkpoint is required.

## Optimization and information relaxation

The causal solver stopped with status 1 (Time limit reached. (HiGHS Status 13: Time limit reached)); the integer incumbent is checked by exact public recurrence, not accepted from solver status alone. Native floating dual bound was 47658.125 and reported relative gap 0.03256296657176641. This is NOT an exact-optimality claim. The delivered policy is reusable even if re-solving under a different timing budget produces a different incumbent.

The required information relaxation is a separate perfect-information continuous model: path actions are no longer tied across histories and all packs/trucks/production may be fractional. Its numerical objective is 46727.848214286, status Optimization terminated successfully. (HiGHS Status 7: Optimal). This model is non-deployable and is not a perfect-information integer optimum; its solver floating arithmetic is not an independently proved rational lower certificate. A separate exact analytic lower bound is 39714: over the horizon, net demand requires at least its BOM minus initial raw stock, purchased at the cheapest listed unit prices, and at least the cheapest allowed production cost per delivered unit. Freight/holding are nonnegative. Ignoring capacity, timing, freight, holding, packs and causality can only reduce cost. This exact bound is intentionally weak and does not prove the incumbent optimal. No old-instance bound is used.

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
