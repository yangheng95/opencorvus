# Skill mount cold-start latency evidence

- [Actual01 HTTP-only qualification and timing failure](actual-01/README.md): unchanged raw results plus independent missing-DEBUG diagnosis.
- [Actual02 qualified HTTP timings](actual-02/README.md): six real source occurrences, request/initializer ownership and balanced spans,27 HTTP200 plus one caller abort, independent physical cleanup. Original19.675s latency remains unresolved.
- `skill-read-log-tests-02.*.log`: final10 positive tests/45 assertions, including real DEBUG file/stderr and actual State ownership. `skill-read-log-typecheck-01.*.log` and `skill-read-log-explicit-02.*.log` both exit0. Earlier test/type failures and exact source-scoped fixes remain in the adjacent numbered logs.

See the [record](../../records/2026-10/2026-10-05-skill-mount-cold-start-latency.md) for current approved implementation/results. The following original plan-only evidence and limitations remain historical inputs.

- [Selected owned rows](selected-owned-rows.json): allowlisted fields from the settings review's existing owned pair02 server/client log projection. Filesystem-path rows and other raw fields are excluded; this is a selected projection, not complete logs or fresh requests.
- [Input notes](input-notes.md): provenance, precise timing and isolation limits.
- [Root screenshot11](../2026-10-05-connection-save-authority/11-after-unrelated-preference-with-applied-a.png): root-operated General view; this agent independently viewed it and confirmed the visible `extensions: skills: signal timed out` banner. No screenshot is relabeled as a new reproduction.
- [Root manual review](../2026-10-05-connection-save-authority/root-after-manual-review.json): connection action timestamps and actual UI authority.

No runtime, network, browser, model or test was executed for this plan. Existing input review files remain ignored; private compatibility paths are not copied here. The selected data cannot identify the exact directory/session query or attribute duration to an internal phase. The future checker matrix has not run. Documentation check `bun run docs:check` exited0 (345 operations,25 groups). The selection contains12 server rows from the rows input and one client error row from the stages input; it does not invent missing request correlation on the client row.
