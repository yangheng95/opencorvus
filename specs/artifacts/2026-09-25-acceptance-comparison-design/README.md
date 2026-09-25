# Acceptance comparison design probe

The original schema/probe/vectors below are operator-authored offline design artifacts,
**not production Tools or replacement benchmark scorers**. Later preregistration and
real behavior results are separately linked and retain their distinct evidence levels.

The [investigation record](../../records/2026-09/2026-09-25-supervision-causal-iteration.md)
defines the hypotheses and constraints. The immutable Cycle 3 evidence remains in
`.tmp/supervision-causal-20260925/global-audit/cycle03-final-evidence.json` and its
original database/eval log.

## Contract and boundary

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
