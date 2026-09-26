# Acceptance comparison design probe

The original schema/probe/vectors below are operator-authored offline design artifacts,
**not production Tools or replacement benchmark scorers**. Later preregistration and
real behavior results are separately linked and retain their distinct evidence levels.

The [investigation record](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)
defines the hypotheses and constraints. The immutable Cycle 3 evidence remains in
`.tmp/supervision-causal-20260925/global-audit/cycle03-final-evidence.json` and its
original database/eval log.

## Contract and boundary

- [G31 incomplete comparator patch](comparison-evidence-in-progress.patch) preserves
  interrupted work for supervisor review. It is unapplied, lacks its planned helper
  and publisher integration, and is not a runnable or accepted implementation.
- [Schema](comparison.schema.json) separates a declared expectation from an observation.
- [Probe](probe.py) checks that schema and evaluates only a supplied arithmetic tree
  or literal equality. Decimal arithmetic avoids binary floating-point surprises.
- [Vectors](vectors.json) are explicit design controls, not model-authored outputs.
- [Results](results.json) retain every control, including the counterexample.
- [Handoff design](handoff-design.md) maps the proposed information flow to current
  production primitives and states what still needs to be demonstrated.
- [Input observation](input-observation.md) separates relational acceptance from
  source presence and documents exact, non-content-retaining Provider evidence.
  Its [registered text probes](input-probes.json) are audit configuration, never model input.
- [Method handoff preregistration](method-handoff.md) fixes one verifier section
  patch, two episodes, competing explanations and stop rules. G13 applies it in
  source version .14; implementation does not establish behavior improvement.
- [H-E two-episode results](he-01-results.md): original scores, participant/source
  chronology, costs and closure; normal delivery is observed but correction benefit
  remains unidentified because the executor starting results differ.
- [Archived review ingress audit](archive-review-ingress.md) and its
  [fixed historical input](archive-review-input.json) separate neutral copied
  material from current Task authority. Local storage works; unchanged verifier
  projection still requires the real declared MCP service. No model run was made.
- [Fixed-state business repair design](fixed-state-repair-design.md) separates a
  reproducible business starting state from identical verifier input, records the
  four-to-48-service seed conversion hazard, and bounds a proposed real-API repair
  diagnostic. No new world or model was created.
- [Repair 01 preregistration](repair-01-preregistration.md) fixes one attributed
  archived-state business diagnosis, external obligations, real Mission entry,
  all costs and stop rules. Its [preparer](prepare-repair-input.py) preserves source
  values and its [controller](run-repair-01.py) reuses the existing host/cleanup.
  Preregistration and entry construction do not establish model behavior.
- [Repair 01 results](repair-01-results.md): the real same-Task evidence continuation
  ended blocked with the original wrong amount and explanation unchanged; method
  publication did not establish method correctness. Includes the retained startup failure.
- [Cross-trajectory mechanism decision](mechanism-decision.md): separates established
  protocol repairs from unresolved semantic judgment and bounds a possible change to
  when expectations are formed. Its G22 wording is historical; H-T was subsequently
  designed and tested once with the result recorded separately below.
- [Expectation-first exact design](expectation-first-design.md), its
  [unapplied patch](expectation-first.patch) and [local checker](check-expectation-first.ts)
  define the three-node proposal using the original two roles and API grants. Loader,
  binding and renderer checks are local contracts, not model behavior.
- [H-T 01 preregistration](ht-01-preregistration.md) fixes one new method-before-execution
  occurrence on the unchanged attributed repair input. Temporal evidence, business effects,
  uncertainty and all costs remain separate; it is not a historical score comparison.
- [H-T 01 results](ht-01-results.md): real expectation-first chronology, original source
  and Tool lineage, unchanged wrong business value, false acceptance, cleanup and full costs.
- [H-B 01 preregistration](hb-01-preregistration.md) fixes one run in which the expectation
  node publishes its method before reading the destination record, with its
  [patch](blind-expectation.patch) and [local checker](check-blind-expectation.ts); it tests
  existing-value anchoring against source selection and claims no correction result.
- [Source dependency and judgment boundary](source-dependency-boundary.md): current
  API catalog/search reachability, observed ranking noise and the separate failure of
  business relation judgment, with explicit limits on possible local fixes.

Source pointers are labels in this prototype. It does not resolve them, verify
complete reads, infer missing terms, choose a formula, or determine business truth.
Those obligations remain unresolved for any production design. The result is a
relationship between **declared** expected and observed values, never permission to
complete a Task or Mission.

Arithmetic has 50 significant digits and traps inexact operations. Without an
authoritative rounding rule, a non-terminating result is unresolved; this is not a
general financial calculator. Inputs here are small, trusted design controls, not
an exposed execution service.

Run from the repository root:

```powershell
packages/inspect-benchmark/.venv/Scripts/python.exe specs/artifacts/2026-09-25-acceptance-comparison-design/probe.py
```

The runner reads the vectors, asserts their preregistered outputs, and prints the
complete result. It performs no network calls or filesystem mutations.

## Required falsification control

`wrong_method_same_value` deliberately supplies the wrong method: use the unit fee
as the total. It must return `matched` for that declared method and report the unused
base, count and discount. Calling this a genuine business pass would reproduce the
very error under investigation. A successful probe therefore **disproves** the
strong claim that adding a schema or calculator alone fixes independent judgment.

`wrong_method_omitted_inputs` strengthens that control: the author also omits the
other inputs, and the prototype returns `matched` with no unused inputs. Source
coverage cannot be recovered from the author's selected subset. Literal comparison
uses exact JSON identity, including list order; it is not a general set/meaning checker.

The usable result is narrower: when an independently justified expectation is
supplied, a comparison can expose a discrepancy that prose concealed. How to obtain
that expectation reliably, and how new evidence invalidates dependent judgments,
still require a separate production design and real verification.
