# Active inspection: exact policy, native recovery and operator handoff

## Scope and delivered meaning

This is an eight-week synthetic, finite-model operating policy for all three complete supplied instances. All 21 public files were used as original inputs. The actor's sole decision inputs are the original public law and the complete observed packet; neither class nor future laboratory outcomes are actor inputs. Online execution uses only the Python standard library and precomputed policy lookup, with no optimizer or network. Currency units and good material units below are synthetic. This report is a producer verification record, not independent acceptance or real-world approval.

## Sufficient state and exact Bayesian law

Use state (t, phase, g, q, c, k). Here t is week 0..7; phase is laboratory or operations; g is actual good material; q is the two-bit retained-pack mask (A=1, B=2); c is settled cash; k is the number of A-good or B-reject observations minus A-reject or B-good observations. Only actual paid inspections contribute. Conditional independence makes likelihood multiplication valid even when suppliers are adaptively chosen, because action-selection probabilities cancel when conditioning on the observed deterministic policy history.

Let alpha be the initial probability of class A={A1,A2}. Alpha=1/2 for base and cash-tight, and 3/4 for shifted-prior. Posterior class odds are alpha/(1-alpha)*(17/3)^k. Thus p(A-good)=3/20+(14/20)*P(class A), and p(B-good)=1-p(A-good). The actor nevertheless returns all four exact original-label probabilities, calculated by model.posterior on the entire paid-inspection history, not merely a class estimate. Fraction strings are exact rationals, never floating approximations.

A1 and A2 have identical per-supplier laws, as do B1 and B2. At every adaptive history their likelihoods are equal within each pair. Induction on decisions proves equality of laws for every admissible adaptive experiment, including purchases, skips and delayed inspections. Original posterior ratios remain A1:A2=1:3 and B1:B2=3:1 in all supplied instances. The two classes are distinguishable in distribution because their likelihood rows differ, but every finite supported result sequence has positive probability under both; no finite observation here proves a unique class or an individual future result. Four-label uncertainty is not eliminated by learning the class.

The reduced physical state loses no feasibility or value information. All leads equal one: the prior order has arrived before a laboratory decision, so there is no unresolved incoming order at a decision state. An operations order is represented in next week's q after deterministic arrival. All demand must already have been met on a valid prefix. Consequently outstanding accounts receivable, abbreviated AR, and next-week collections are deterministic functions of t and the original demand/revenue/opening calendar. Historical expense components and minimum cash are reporting variables, not additional future controls. Settled c retains the entire current financing constraint; prior minima are separately validated by full replay. Past inspection counts matter for the future only through k. End-of-horizon disposal is mandatory. The solver is intentionally specialized to the supplied two-supplier, capacity-4, lead-1, eight-week law; changed inputs are outside its contract.

## Finite Bellman recursion and rational optimum certificate

Let O(t,g,q,c,k) be the minimum remaining expense after the laboratory decision. Let L be the corresponding pre-laboratory value. Infeasible states have value infinity (represented by null in certificates). At operations enumerate every integer e from max(0,demand[t]-g) through 4-g, and order o in {none,A,B}, excluding occupied slots and orders arriving outside the horizon. There is no simultaneous second order. Let g'=g+e-demand[t], and q' include the new order for the next week. Immediate expense C is certified price times e, plus order pack cost, production cost times demand, and ordinary holding g' before week 7. In week 7 replace holding by good-unit and retained-pack disposal. All payments are nonnegative, with no within-stage income; checking post-payment c-C therefore checks every intermediate payment floor. The public-primitive checker also checks each individual payment.

For t<7: O=min_actions [C+L(t+1,g',q',c-C+I[t+1],k)], requiring c-C>=-15. I is only the scheduled next collection, never funds for the preceding operation. For t=7: O=min_actions C, requiring no incoming and c-C>=0 after disposal. Shipment creates sale AR due t+2 and does not create current cash.

L=min {O(t,g,q,c,k), 1+p_v*O(t,g+2,q-v,c-1,k_good)+(1-p_v)*O(t,g,q-v,c-1,k_reject)}, over available v, g+2<=4, and c-1>=-15. Each inspection candidate is admissible only when BOTH successor continuations are feasible, irrespective of their likelihood. This is pathwise risk feasibility, not an expected-stock or expected-cash relaxation. A skip contributes neither a sample nor a laboratory fee. The k updates are +1 for A-good/B-reject and -1 for A-reject/B-good.

There are finitely many weeks, bounded material and pack counts, finitely many integer cash amounts reachable through bounded costs and deterministic collections, and at most seven paid inspections from zero opening material. Phase/week strictly advances on every edge. Backward induction on this acyclic graph proves that the displayed minimum exhausts every admissible first action and all conditional continuations. Rational priors/likelihoods/costs imply rational values throughout; no optimizer tolerance, numeric status, sampling estimate or source hash is an optimum certificate. Minimum selection gives a deterministic policy; ties use enumeration order (skip first, A before B; certified quantities ascending and order none/A/B).

solver.py exports all visited feasible AND infeasible node values and chosen actions, not just the realized policy. verify_certificates.py independently enumerates even physically invalid action candidates, reconstructs operational states, uses the unmodified public advance primitive for each transition, checks every feasible successor is present, checks all Bellman minima exactly, and checks the selected action attains the value. Its temporary synthetic likelihood histories are algebraic certificate checks only, never observations supplied to the actor or receipts. The exact expected cost from all model-generated policy leaves equals the root value. The native audit subsequently recomputes costs and probabilities from actual source-produced decisions and original SQLite receipts.

## Exact results

The following decimals are rounded display values only; the fractions and exported ledgers are authoritative.

### base

Same-information optimum and delivered policy: 300834939/4000000 = 75.2087347500 currency units.

Advance-class-information lower bound: 79935238629/1280000000 = 62.4494051789 currency units.

No-inspection physical restriction optimum: 118 = 118.0000000000 currency units.

Intrinsic cost of lacking advance class information: 16331941851/1280000000 = 12.7593295711; policy regret: exactly 0 (0%), hence within the required 1%. Class-A optimum: 3796298817/64000000; class-B optimum: 41972250459/640000000.

Actual terminal histories: 67; distinct complete-prefix decision histories: 260; reduced reachable lookup states: 251; exact probability mass: 1. Minimum settled cash: -13; minimum final cash: 4; maximum actual good-material stage peak: 3 units.

Exact expected expense components (currency units): certified=27848009/800000, disposal=4572647/8000000, holding=80169651/32000000, laboratory=23112549/4000000, normal=625398521/32000000, production=12.


### cash-tight

Same-information optimum and delivered policy: 11287373277/128000000 = 88.1826037266 currency units.

Advance-class-information lower bound: 170951494509/2560000000 = 66.7779275426 currency units.

No-inspection physical restriction optimum: 119 = 119.0000000000 currency units.

Intrinsic cost of lacking advance class information: 54795971031/2560000000 = 21.4046761840; policy regret: exactly 0 (0%), hence within the required 1%. Class-A optimum: 80959253829/1280000000; class-B optimum: 2249806017/32000000.

Actual terminal histories: 49; distinct complete-prefix decision histories: 192; reduced reachable lookup states: 188; exact probability mass: 1. Minimum settled cash: -15; minimum final cash: 0; maximum actual good-material stage peak: 3 units.

Exact expected expense components (currency units): certified=846638457/16000000, disposal=74988917/128000000, holding=125888651/64000000, laboratory=316103039/64000000, normal=504823331/32000000, production=12.


### shifted-prior

Same-information optimum and delivered policy: 90125954529/1280000000 = 70.4109019758 currency units.

Advance-class-information lower bound: 155861214969/2560000000 = 60.8832870973 currency units.

No-inspection physical restriction optimum: 118 = 118.0000000000 currency units.

Intrinsic cost of lacking advance class information: 24390694089/2560000000 = 9.5276148785; policy regret: exactly 0 (0%), hence within the required 1%. Class-A optimum: 3796298817/64000000; class-B optimum: 41972250459/640000000.

Actual terminal histories: 81; distinct complete-prefix decision histories: 274; reduced reachable lookup states: 260; exact probability mass: 1. Minimum settled cash: -13; minimum final cash: 1; maximum actual good-material stage peak: 3 units.

Exact expected expense components (currency units): certified=4924705947/160000000, disposal=772546073/1280000000, holding=80897931/32000000, laboratory=186178809/32000000, normal=298908641/16000000, production=12.


Every terminal path retains sale AR of 24 at absolute due week 8 and 12 at due week 9. These 36 currency units are not collected inside the horizon and do not satisfy terminal cash. Actual good-unit peak is at most 3, below capacity 4; the inspection admission rule still reserves room for a successful result before production, including the reject branch's counterfactual admission check. Counts of reduced states differ from complete-prefix histories because equivalent states can merge in the lookup table while the actor keys still bind each full prefix.

## Advance information, physical restriction and causal interpretation

For the lower bound, reveal the equivalence class before week 0, not individual future results. Solve the same two-phase stochastic operational recursion for each class, retaining the actual 17/20 and 3/20 probabilities and requiring feasibility under both outcomes. Prior-weight the two class-conditioned optima. A policy with advance information can emulate any uninformed policy, so this is a valid lower bound. Aliases within a class cannot improve it. It is NOT a clairvoyant perfect-future-outcome solution.

The no-inspection figures solve a different PHYSICAL restriction: only skips are allowed. Normal packs then cannot produce certified usable material; the recursion still permits ordering but finds it wasteful. This restriction removes both the physical yield and learning. Its cost difference from the delivered policy is NOT pure information value. A pure information ablation would have to retain paid inspection/yield and all physical rules while restricting the decision information or permitted history dependence. Merely freezing a Bayesian probability in a fully observed physical-state controller is not that experiment: good stock, cash and retained-pack trajectories themselves encode quality history, and ignoring available evidence does not make the underlying latent law independent. No numeric pure-information-ablation optimum is asserted here. The clean information-only comparison reported is advance class revelation under identical physical rules.

Adaptive selection, cash constraints and outcome-dependent continuation explain why naive comparisons of tested suppliers' observed good fractions do not estimate uncontrolled supplier superiority. These are known synthetic conditional laws, not empirical causal estimates. The finite exercise proves behavior for the three supplied inputs, their row reorder, all induced supported paths and two specific controlled commit/acknowledgement losses. It does not establish arbitrary-failure or power-loss safety, same-user operating-system isolation, professional/statistical maturity, real procurement/financial approval, or useful candidate hours.

## Native execution, failure disclosure and receipt recovery

The first genuine run is retained in submission/native-original. It reached the row-order control but failed with PermissionError when exercise.py attempted to rewrite a copied CSV whose Windows read-only attribute had been preserved. Its source capsules, actual command exits, SQLite files, wires and failure records were not deleted or promoted to success. The failed driver receipt is submission/exports/exercise-process.json. No public code or original public attributes were altered.

prepare_inputs.py used shutil.copyfile to prepare all 21 original byte-identical inputs with writable destination attributes at submission/execution-public; direct byte comparisons are recorded in submission/execution-public-copy-record.json. The actual unchanged exercise then ran from that copy. The successful original run is submission/native-complete; public audit.analyze exported submission/exports-complete/audit.json, stage-ledger.csv and summary.json. Both genuine controller exits 73 occurred after a nonzero order and a paid inspection were respectively committed but before acknowledgement. New actors reproduced the original key/payload. The controller fetched the original stored receipt, including the original laboratory result, then continued the SAME SQLite prefix; it did not draw again, change keys, restore an older database or reassign AR. The public audit compared every original saved row and both new-process replay wires. Controller/actor PID, argv and terminal exits are retained under each native episode and actual-commands.json.

The all-positive-support native run has 197 complete episodes (67+49+81), plus one row-order control; the second source-rebuilt run independently exercises the rebuilt surface. Nonapplicable null fields export as empty CSV cells. Stage probability_exact is the full path probability repeated for each row, whereas node_probability_exact is the pre-action prefix probability; neither should be multiplied once per repeated ledger row. Operations post-state cash includes next-week collection after roll; closing_cash subtracts it and exposes the true former-week payment balance. The native policy-tree files retain conditional beliefs, reach probabilities, decisions and original public likelihood accounting.

## Full-prefix validation and operational handoff

The actor reconstructs the entire prefix through model.packet, checking stage/sequence, physical transitions and each original receipt post-state. It checks duplicate keys, validates each original key against its complete prior packet and original law, validates the current packet exactly, reloads original facts to detect a changed input, then computes full exact beliefs. Stable request IDs use SHA-256 only as a content-addressed idempotency identity over the canonical original law and full current packet; this is not a correctness or resource-completeness checksum assertion. Output is one flushed JSON line. Prefix errors fail closed with named diagnoses instead of fabricating a balance or future result. The actor has no online optimizer import.

Original-key recovery: stop at the journaled current prefix and restart through the same exercise controller/database. Replay the exact prior packet, retain its request ID and payload, and fetch its original stored receipt. For a paid inspection that means recovering the old result, never paying or sampling again. Use each cut's original-prefix.json and successor resume-receipt.json for comparison; they are evidence, not backups to restore over the journal. Do not clear an incoming order, retained pack or outstanding receivable. A different payload with an existing key is a conflict requiring diagnosis, not a new key workaround.

Credit infeasibility: no borrowing beyond -15, deferred payment, cancellation, raw-stock sale or retrospective action is supplied. Stop and report the unsupported/infeasible prefix to the operator; never issue a guessed feasible action. At final week cash must be nonnegative AFTER disposal without collecting due-8/9 AR. Changed public facts, unsupported policy states or corrupt/duplicate/truncated prefixes require named diagnosis and a new authorized model/recompute, not a hidden fallback policy. Keep original receipt rows, source capsules, wires and failure files intact.

## Reproduction and verification coordinates

All commands below run from the project root in Git Bash on native Windows. All newly created data stay under submission. Use a NEW output directory for each execution; the exercise intentionally refuses to overwrite a run. Set PYTHONDONTWRITEBYTECODE=1 and route TEMP/TMP under submission/tmp. source.zip excludes generated tables, includes the original 21 public inputs and declared actor entry, and rebuild.py recomputes the policy from that source. No Python environment outside submission is modified.

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/solver.py --public public --out submission/actor/tables --certificates submission/certificates

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/verify_certificates.py --public public --certificates submission/certificates --out submission/certificate-verification.json

PYTHONDONTWRITEBYTECODE=1 C:/Python314/python.exe -B submission/prepare_inputs.py --source public --out submission/execution-public

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/run_native.py --project submission/actor --public submission/execution-public --out submission/native-complete --export submission/exports-complete

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/test_actor.py --project submission/actor --public submission/execution-public --run submission/native-complete --out submission/actor-verification.json

PYTHONDONTWRITEBYTECODE=1 C:/Python314/python.exe -B submission/bundle_source.py

PYTHONDONTWRITEBYTECODE=1 C:/Python314/python.exe -X utf8 -u -B submission/rebuild.py --source submission/source.zip --out submission/rebuilt

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/run_native.py --project submission/rebuilt/actor --public submission/rebuilt/public --out submission/native-rebuilt --export submission/exports-rebuilt

PYTHONDONTWRITEBYTECODE=1 TEMP="$PWD/submission/tmp" TMP="$PWD/submission/tmp" C:/Python314/python.exe -X utf8 -u -B submission/test_actor.py --project submission/rebuilt/actor --public submission/rebuilt/public --run submission/native-rebuilt --out submission/rebuilt-actor-verification.json

Online Python has no third-party dependency. To regenerate scientific figures/PDF in an isolated environment, create submission/env with the supplied Python 3.12 base, then install submission/requirements-lock.txt from submission/wheels using pip --no-index --find-links submission/wheels. Set MPLCONFIGDIR to submission/mpl. Run submission/env/Scripts/python.exe -B submission/make_report.py. The declared top-level plot/PDF dependencies and transitive versions are retained along with offline wheels; no actor decision depends on them.

## Figures and original paths

submission/figures/decisions.png shows week-specific inspection and order reach-probability mass, not independent frequencies. submission/figures/cost-information.png compares costs under explicitly different information/physical conditions. submission/figures/cash.png shows every path plus exact-probability mean and min-max envelopes, with operations cash measured before next collection. submission/figures/material.png shows actual received good-material stage peaks, not expected yields or hypothetical successes. submission/figures/belief-information.png shows probability-weighted class entropy before each decision. All chart decimals are visual approximations; exact source data remain in the exports and policy trees.

The reusable entry declaration is submission/actor/submission.json and the original online source is submission/actor/actor.py. Offline source and verification scripts live directly in submission. Exact policy tables are submission/actor/tables/*.json and full value-graph certificates are submission/certificates/*.json.gz. The mathematical report source is submission/report.md and this readable PDF is submission/report.pdf. Original failed and successful evidence remains unmodified in its run directory; native-evidence.zip stores the same original project-relative paths for transport. Source reproduction is submission/source.zip; offline scientific dependencies are submission/dependencies.zip. No private evaluator or earlier candidate answer was used.

## Observed verification totals

All 12 rational certificate graphs passed, covering 217363 nodes and 2209033 candidate-action checks. Their individual roots and comparisons are in submission/certificate-verification.json. Full original-node replay and row reorder tested 260+192+274 decision packets, with 18 deliberate malformed/changed-fact inputs rejected under named diagnoses; these expected rejection fixtures are not hidden operational failures. The genuine first-run attribute failure remains separately disclosed above.

The source archive was extracted without policy tables and rebuilt from its raw original inputs. The rebuilt native run and public audit completed all 197 supported paths, both controlled losses and the row-order control; its complete summary equals the delivered original summary exactly. Full-node replay, restart and all-instance row reorder also passed on the rebuilt actor, with the same 18 named negative rejections. This verifies the delivered source-produced actor, not just a prebuilt artifact. The separate independent Tester review is not claimed here.
