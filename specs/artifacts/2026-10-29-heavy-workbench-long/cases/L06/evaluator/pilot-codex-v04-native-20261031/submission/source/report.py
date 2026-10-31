"""Create the readable report and evidence index from original runtime products."""
import json,csv,sys,platform,datetime
from pathlib import Path
from fractions import Fraction as F
r=Path(__file__).resolve().parents[1]
s=json.loads((r/'summary.json').read_text());v=json.loads((r/'derivation/build-01/values.json').read_text());review=json.loads((r/'derivation/independent-bellman-review.json').read_text());term=json.loads((r/'native-run-02/owner-terminal.json').read_text());started=json.loads((r/'native-run-02/owner-started.json').read_text());first=json.loads((r/'native-run-01/owner-started.json').read_text());error=json.loads((r/'native-run-01/owner-error.json').read_text())
base=next(x for x in term['instances']['base']['episodes'] if x['controlled_cuts']);episode=base['directory'];cutrows=[];recovery={}
for kind,follow in [('order','cut-laboratory'),('laboratory','completed')]:
    folder=r/'native-run-02'/episode;cut=json.loads((folder/('cut-'+kind)/'crash-after-commit.json').read_text());resume=json.loads((folder/follow/'resume-receipt.json').read_text());worker1=json.loads((folder/('cut-'+kind)/'worker/worker-started.json').read_text());worker2=json.loads((folder/follow/'worker/worker-started.json').read_text());controller1=json.loads((folder/('cut-'+kind)/'controller-started.json').read_text());controller2=json.loads((folder/follow/'controller-started.json').read_text())
    recovery[kind]={'episode':episode,'committed_seq':cut['committed_seq'],'original_key':cut['original_key'],'observation':cut['observed_result'],'cut_controller_pid':controller1['pid'],'resume_controller_pid':controller2['pid'],'cut_worker_pid':worker1['pid'],'resume_worker_pid':worker2['pid'],'controller_actual_exit':cut['controller_actual_exit'],'worker_exit_before_cut':cut['worker_exit_before_cut'],'original_receipt':resume['original_receipt'],'next_seq':resume['next_seq'],'original_cut_record':str((folder/('cut-'+kind)/'crash-after-commit.json').relative_to(r)),'original_replay_record':str((folder/follow/'resume-receipt.json').relative_to(r))}
    cutrows.append(f"| {kind} | {cut['committed_seq']} | {cut['observed_result'] or 'not a sample'} | {controller1['pid']} → {controller2['pid']} | {worker1['pid']} → {worker2['pid']} | 73 / 0 |")
(r/'recovery-index.json').write_text(json.dumps(recovery,indent=2)+'\n',encoding='utf-8')
execution={'format':'l06-owned-execution-index/1','observed_by':'native tool completions plus original owner/controller/worker records','runs':[{'directory':'native-run-01','owner_pid':first['pid'],'argv':first['argv'],'actual_native_exit':1,'state':'facility failure after 197 completed episodes and before row-order completion','error_original':'native-run-01/owner-error.json','log_original':'logs/native-run-01.txt'},{'directory':'native-run-02','owner_pid':started['pid'],'argv':started['argv'],'actual_native_exit':0,'state':'complete native closure including all branches, both original-receipt recoveries, and row-order control','terminal_original':'native-run-02/owner-terminal.json','seconds':term['seconds']}],'source_runner_difference':'runner/readonly-copy-fix.diff','source_actor_unchanged_between_runs':True}
(r/'execution-index.json').write_text(json.dumps(execution,indent=2)+'\n',encoding='utf-8')
rows=[];bound=[];components=[]
for ident,x in s['instances'].items():
    rows.append(f"| {ident} | {x['expected_cost_exact']} | {float(F(x['expected_cost_exact'])):.9f} | 0 | {x['terminal_histories']} / {x['decision_histories']} | {x['minimum_cash']} | {x['minimum_final_cash']} | {x['maximum_raw_peak']} |")
    bound.append(f"| {ident} | {v[ident]['class-A']['value_exact']} | {v[ident]['class-B']['value_exact']} | {x['advance_class_information_bound_exact']} ({float(F(x['advance_class_information_bound_exact'])):.9f}) | {x['intrinsic_information_value_exact']} ({float(F(x['intrinsic_information_value_exact'])):.9f}) | {x['no_inspection_physical_optimum_exact']} |")
    components.append('| '+ident+' | '+' | '.join(x['components_exact'][k] for k in ['normal','certified','production','laboratory','holding','disposal'])+' |')
report='''# Exact eight-week operating policy and native evidence

This submission implements an optimal deterministic same-information policy for each complete synthetic input. It executed every positive-probability policy history in fresh native actors and original SQLite controllers. Exact expected costs agree with an independently checked rational Bellman certificate, giving zero policy regret and meeting the registered 1% limit.

Terminology: CSV = comma-separated values; JSON = JavaScript Object Notation; AR = accounts receivable; PID = process identifier; SQL = Structured Query Language; WAL = write-ahead log; EOF = end of file; PNG = Portable Network Graphics; SVG = Scalable Vector Graphics; PDF = Portable Document Format.

## Results and actual scope

All amounts are synthetic cash units. Histories are complete observed logical paths, not independent sampled futures. Decision histories count full prefixes; the compact policy merges equivalent sufficient states.

| Instance | Expected cost, exact | Rounded cost | Policy regret | Terminal / decision histories | Minimum settled cash | Minimum final cash | Maximum actual raw peak [units] |
|---|---|---:|---:|---:|---:|---:|---:|
'''+ '\n'.join(rows)+'''

Each instance has exact total path mass 1. Every one of 197 terminal histories has 16 committed stages: 3,152 actual stage receipts. All demand is met, all supported outcomes are feasible, and every final incoming order is cleared. Remaining sales receivables are due at absolute week 8: 24 and week 9: 12 on every path. They are recorded, not collected within week 7. Final balances satisfy cash ≥ 0; cash-tight exactly attains both credit floor −15 and final cash 0 on supported branches. The optimal actual peak is 3 good units, below capacity 4; the successful laboratory admission check still uses the full potential extra 2 units.

| Instance | Normal | Certified | Production | Laboratory | Holding | Disposal |
|---|---|---|---|---|---|---|
'''+ '\n'.join(components)+'''

`summary.json` contains exact components and absolute post-horizon receivables for every logical path. `stage-ledger.csv` exports the required columns plus exact conditional probabilities, post-decision posteriors, before/after quarantine, incoming commitments and cost components. `probability_exact` is repeated terminal path mass, never multiplied across rows. `node_probability_exact` is pre-action prefix mass. Receipts, states, keys and all laboratory results remain in original SQLite and wires.

## Information, sufficient state and feasibility

Let class A have success probabilities (17/20, 3/20) for (A,B), and class B have (3/20,17/20). A1 and A2 are observationally equivalent; so are B1 and B2. For every adaptive experiment their entire conditional result laws are equal, hence no policy can distinguish the labels within a pair. Their posterior ratios remain A1:A2 = 1:3 and B1:B2 = 3:1 in all supplied inputs. Finite histories also cannot identify either class with certainty because all outcomes have strictly positive probability.

Define k = number of A-good and B-reject paid results minus the number of A-reject and B-good paid results. With prior class probability π, class odds after the observed paid prefix are π/(1−π) × (17/3)^k. Thus a scalar k plus the original prior gives the full class posterior; within-pair ratios reconstruct all four label probabilities. The actor additionally uses the public exact posterior on the complete committed prefix. Procurement, nonselection, delayed inspection, skips and retained packs contribute no likelihood.

The sufficient decision state is (week, phase, actual good inventory, A-slot occupancy, B-slot occupancy, settled cash, k). Calendar demand is mandatory and all orders have lead 1: after a laboratory start, all earlier normal orders have arrived, so incoming orders need not be separately stored in this *value* state. Operations moves a new order into next week's occupied slot. Receivables due in any week are calendar-determined by past mandatory shipments plus original opening receivables. Original receipt IDs remain in full actor packets even though they do not alter continuation cost. Cumulative expense is sunk and minimum historical cash cannot affect future feasibility after a valid prefix. Terminal good units and retained packs are disposed at declared charges. These facts justify compression; the actor first replays every original full-prefix transition, rather than trusting compressed private balance.

All operations payments are nonnegative. Therefore the cash immediately after normal/certified/production and holding or disposal payments is the lowest cash during those operations. The solver checks it before scheduled next-week receipts are rolled in. Laboratory fees are checked separately. The supplied model independently verifies every individual payment. All actions enumerate integer certified units through capacity, skip or one available paid test, and none/A/B next-week orders under original slot commitments. A test is admissible only if its successful preconsumption outcome fits capacity and BOTH positive-probability continuations have feasible policies. The same conditions apply at every reached prefix, including low-cash reject histories.

## Exact Bellman derivation and certificate

For each sufficient state s, each admissible action a has immediate expense c(s,a), exact outcome probabilities p(o|s,a), and successor T(s,a,o). The finite recursion is

    V(s) = min_a [ c(s,a) + Σ_o p(o|s,a) V(T(s,a,o)) ].

Terminal feasible continuation value is zero; a state with no feasible action has value infeasible. A decision with any positive-probability infeasible successor is infeasible. The minimum is over decisions using only s and never a future result or selected class. Phase advances from laboratory to operations and operations advances the week, making the graph acyclic. Backward induction proves feasibility and optimality of each chosen minimum, and that the root is the exact same-information optimum. Deterministic iteration order resolves exact ties. No floating-point optimizer status enters this claim.

`source/bellman.py` and `source/rebuild.py` construct this recursion with Fraction arithmetic. The compressed exact certificates in `derivation/build-01/certificates` include all explored states, values (null = infeasible), and chosen actions for the full-information, same-information and no-inspection comparisons. `source/verify_bellman.py` does not import the solver: it enumerates alternatives independently, creates the calendar receivables explicitly, and uses public `model.advance` to reconstruct physical successors and immediate expenses. It checks exact Bellman minima and chosen-action values at every stored state, with feasible-successor closure. An unexpanded branch is allowed only when another positive-probability successor already has certified infeasible value. Acyclic induction validates those infeasibility certificates as well.

The independent implementation verified '''+str(sum(x['states_exactly_verified'] for x in review['certificates'].values()))+''' states, '''+str(review['valid_alternative_actions'])+''' valid alternative actions and '''+str(review['original_model_outcome_edges'])+''' authoritative-model outcome edges across all 12 certificates. See `derivation/independent-bellman-review.json`. This is an independent computational method authored by the same candidate, not a claim of external-person review.

A second source rebuild in `derivation/rebuild-02` used the retained native input originals. Every complete rebuilt policy object and every exact comparison value equals the delivered policy. `derivation/rebuild-reconciliation.json` records content/value comparison rather than a source digest. The online actor has only standard-library dependencies and loads no solver or network service.

## Advance class information and causal interpretation

The following bound reveals the distribution class before week 0, but still leaves all individual future outcomes uncertain. Each revealed-class policy obeys the same capacity, cash and commitment rules on both outcomes. Prior-weighting the two conditional optima is a lower bound on the unknown-class optimum because any unknown-class policy remains available with extra information.

| Instance | Class A optimum | Class B optimum | Prior-weighted advance-class bound | Intrinsic information value (same optimum minus bound) | No-inspection physical optimum |
|---|---|---|---|---|---|
'''+ '\n'.join(bound)+'''

Policy regret is delivered cost minus the same-information optimum: exactly zero. Intrinsic information value is the separate positive gap to advance class revelation. The no-inspection difference changes usable material: without inspecting, normal packs never become certified good stock. Therefore it is not a pure information ablation and must not be reported as information value.

All results are consequences of declared synthetic likelihoods and explicit interventions on purchase, inspection and production. An inspection simultaneously transforms a pack and provides evidence. Adaptive supplier selection means observed unweighted success rates across selected lots are not a causal comparison. The likelihood-based policy evaluation explicitly accounts for selection and branch probabilities. These are finite-model operating decisions, not empirical supplier estimates, real procurement/credit approval, statistical maturity or evidence that a future individual lot must pass.

## Original recovery and runtime provenance

The successful run is `native-run-02`; its source capsules, source directories, original public tables, SQLite journals, wires, complete prefix backups and actual native commands are retained. The public runner's controller uses SQLite WAL with FULL synchronization. Neither actor nor controller receives future outcomes in argv/environment/input files: the owner passes complete sequences only to the controller's parent stdin, and the actor receives solely the current full packet. Discovery enumerates actor-produced branches, and the owner subsequently executes each complete branch in a fresh controller/actor process before associating its exact branch weight.

Both controlled interruptions happened after a committed irreversible action and before its acknowledgement. The worker closes on owned EOF and the controller exits 73. The next process asks the same original packet and must reproduce the same key, payload and belief, then returns the original stored receipt. All original prefix SQL rows are compared byte-for-byte with final rows. The paid laboratory result is not resampled. These are genuine controlled process exits, not a claim of physical power loss or arbitrary crash safety.

| Cut | Committed seq | Original observed result | Controller PID cut → resume | Actor PID cut → resume | Controller / worker cut exit |
|---|---:|---|---|---|---|
'''+ '\n'.join(cutrows)+'''

Detailed keys, receipts and original evidence paths are in `recovery-index.json`; successful episode is `native-run-02/'''+episode+'''`. `native-run-02/actual-commands.json` retains every controller argv/exit/stdout/stderr; each worker directory retains its actual PID, argv, wire and exit. The row-order control is a further completed native 16-stage episode, matched to a business-equivalent original base history.

## All actual failures and limitations

The unmodified public exercise was run first in `native-run-01` and exited 1 after all 197 native terminal histories and both recovery boundaries, at the final CSV row-reorder step. `shutil.copytree` propagated the Windows read-only bit from authoritative input files, so opening its owned row-order copy for writing raised PermissionError. Original traceback, source capsules, complete prior executions and partial row-order copy remain unchanged. This is an exercise facility failure, distinct from a policy failure or success.

The repaired owned runner at `runner/exercise.py` adds only a writable permission bit to each owned row-order CSV just before its existing write. `runner/readonly-copy-fix.diff` preserves the exact three-line addition; public inputs/source were not changed. The actor and generated policies were unchanged. A fresh full run `native-run-02` then exited 0, including the row-order control. No failed run was resumed by rewriting old artifacts or erased. `execution-index.json` distinguishes the two owner runs and actual exits.

Native diagnosis checks intentionally produced `duplicate_original_key`, `original_receipt_state`, `changed_original_packet`, `unsupported_public_facts`, and typed `settled_cash_floor` outcomes; stdout/stderr/PID/argv/exit and original inputs are retained in `actor-contract-checks`. The changed-input startup test exits 1 with its named unsupported-facts diagnosis. These are positive error-contract checks, not completed operational episodes. No policy-run actor/controller failure occurred in the successful closure. No solver failure or dependency-install failure occurred.

Exact claims cover supplied three inputs and the declared row reorder. Unknown changed laws are diagnosed, not generalized. The compact online table covers every contingent history of the delivered policy; valid histories from other policies are diagnosed as unsupported if their sufficient state is absent. No future result is inferred with certainty. Plot coordinates/labels are numerical renderings of exact ledger values and are rounded; exact fractions remain authoritative. All PNGs were actually rendered and visually inspected for readability and correct units/labels. No UI automation or user process/window operation was used.

An independent-author whole-case review remains a distinct handoff step for the coordinating reviewer; this candidate does not mislabel its own independent-method computational review as third-party review. The scope does not certify useful candidate hours, professional/statistical maturity, physical power loss, arbitrary failures, real business approval or all ten tasks. There is no benchmark score claim. The standalone submission directory is not a Git checkout and has no configured upstream; no repository or publication state was fabricated.

## Product map

- `programme/submission.json`, `programme/actor.py`, `programme/policies/*.json`: original declared native entry and complete contingent policy.
- `source/`: solver, independent certificate verifier, native contract checks, reconciliation, figures and report builders.
- `derivation/`: both original/rebuilt policies, rational certificates, exact values and verification records.
- `stage-ledger.csv`, `summary.json`, `episodes.json`, `reconciliation-full.json`: machine-readable actual physical/information/cost/cash/AR accounting.
- `native-run-01/`: untouched failed original exercise run; `native-run-02/`: completed owned-runner run with all original evidence.
- `runner/`: retained source repair and exact diff; `execution-index.json`, `recovery-index.json`: navigation to actual records.
- `figures/`: actual policy, cost/information and cash/material figures in PNG, SVG and PDF.
- `dependencies/`, `download-cache/`, `plot-cache/`, `requirements-plot.txt`: actual local plotting dependencies, cache and pinned versions; online actor requires only Python standard library.
- `HANDOFF.md`, `REPRODUCE.ps1`, `source-archive.zip`: operator instructions, rebuild/execute commands and source archive after freeze.
'''
(r/'REPORT.md').write_text(report,encoding='utf-8')
print(json.dumps({'status':'report-generated','recovery_episode':episode,'source_entry':'programme/actor.py','native_stages':3152}))
