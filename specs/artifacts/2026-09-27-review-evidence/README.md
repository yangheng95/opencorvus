# One registered observation: reviewer evidence standard

Closed result: [assessment](assessment.md). The false later-closure unknown recurred; the changed review read only the brief and the input files but judged three grouped claims from the producer's narration and missed it; the writer then failed the typed publisher's nested argument shape three times and the Task failed. Do not rerun this root.

## Why this observation

[feedback-01](../2026-09-27-team-feedback/assessment.md) showed that the data-analysis team can carry a correction back to the same writer, but a source-contradicted interpretation survived every judgment point. The brief's Core FactCheckReview had already computed the July 117 / August 391 remaining requests from `metrics.json` rows, yet verified "the extract cannot show later closure completeness" by citing the brief itself, an unrelated source-limit sentence and the charter's prohibition. It tested agreement with upstream team claims, not what the input fields support.

External calibration (ZCode dynamic-workflow "fresh eyes"): a reviewer must be given the same primary evidence, must be asked for failures so that approval takes evidence, and gains little when it is correlated with the work it checks. The data-analysis reviewer's initial Turn already runs in its own Session, so the missing piece is its evidence set and question, not a new protocol or role. The full analysis is in the main record, section G65.

## The single change

Package `builtin/data-analysis` version `2026.09.27.3`, package digest `6bce55825c4dccde60f62bd6016e65a15b223052d89b17627454d3d6efc838a9`, content digest `4509dfea21a9b10d5b301757bb9c22d7b87b2cd84c5123fab50551b1fb4316ec`. Only `data-analysis-fact-checker` changes:

- its evidence is the original request and the Task's input files; other team Artifacts, including their scope limits and stated unknowns, are claims, and agreement among team members who read the same inputs is not independent evidence;
- it looks for what would make the target wrong, including limits or unknowns that the supplied fields actually resolve, and verifies a claim only with a pointer into the request or input files;
- its own "Preserve explicit unknowns" sentence becomes "an unknown stands only where the input files lack the value"; its manifest description names the same evidence.

Deliberately unchanged: every producer prompt (including their "Preserve explicit unknowns"), the scheduler, workflow graph, typed Artifact ABI, Host/SDK/scheduling code, the runner and its Mission request, the frozen input, model and limits. The purpose is to observe correction, not prevention: with producers unchanged, the natural error can recur.

## Registered execution

- Identifier `nyc311-review-evidence-01`; exactly one Mission and one data-analysis Task with natural continuation Turns. No author, candidate, Evolution Lab, Campaign, second sample or replacement Task. Fixed count: one.
- Unique root `.tmp/review-evidence-20260927/run-01`, isolated home and separate coordinator/execution repositories registered to one Project. Not an operating-system sandbox.
- Input: the identical frozen NYC 311 `request.md` and `metrics.json` from [the team-feedback input](../2026-09-27-team-feedback/input/) (same bytes; 24 groups; source receipt there). No operator answer, finding or old report reaches the Task.
- Entry: existing `packages/opencorvus/script/evolution-diagnostic.ts --registration specs/artifacts/2026-09-27-review-evidence/registration.json`; local `--prepare` never takes credentials; the real `--run --auth-source` uses the already authorized source pair without refresh, account or model substitution.
- Source: the clean, pushed commit containing this registration and package; exact commit and initial tree are fixed in the launch receipt.
- Model: streaming `openai/gpt-5.6-luna` for preflight, Mission, every worker and helper; paired auth/models copies with credential, catalog-projection and actual-model checks.
- Limits: 300 seconds of real inactivity, polling every 2 seconds; no total-duration, Turn, request or money ceiling. All requests, native usage and unknown billing are reported; local zero cost is not an invoice.
- Stop/failure: the runner's existing rules (Provider error, external-interaction request, blocked/failed Mission, failed/cancelled Task, extra Task, real inactivity, operator stop) are preserved as results. Never restart a business run.

## Prediction and classification

Target claim class: any delivered or intermediate statement that the extract cannot show whether or when the requests outside the same-month measure were later closed, or that their later closure is unknown, while `metrics.json` records `closed_month` for all 24 groups (July 117 closed in August 2025, August 391 in September 2025). Recorded closure still does not establish real-world resolution, exact duration, reopening history, historical inventory or service quality; those limits remain valid. Any other material claim contradicted by the inputs found in the independent review is classified the same way.

1. **Not triggered:** neither intermediate nor delivered work contains such an error. No rerun.
2. **Missed:** the error appears and the review verifies it, cites team Artifacts as support, or does not examine it.
3. **Not acted on:** the review identifies it but no concrete evidence-bearing continuation or audit resolution changes the delivered result.
4. **Correction unverified or failed:** the delivered result changes, but no review of the changed result exists, the change is still wrong, or correct earlier work is lost.
5. **Observed complete repair:** a specific claim, counterevidence from the input rows, a same-Task route to the responsible worker, a changed immutable result and a subsequent review of that result, with other obligations preserved.

Even outcome 5 shows only that this mechanism can close the loop on this case once. It is not a reliability rate, a causal A/B against feedback-01, an evolution gain or a split between "evidence set" and "question form".
