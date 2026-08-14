# Permission two-mode visual evidence

These screenshots were captured from an isolated real OpenCorvus server and Overlay on 2026-08-12. They are manual visual-acceptance evidence, not UI test fixtures or baselines.

- `full-access-en.png`, `full-access-zh-cn.png`: default `Full access` mode and warning.
- `ask-mode-en.png`: `Ask me`, active exact grant, revoke action, and history.
- `ask-revoked-en.png`, `ask-revoked-zh-cn.png`: revoked grant state and durable history.
- `ask-prompt-pending-en.png`, `ask-prompt-pending-zh-cn.png`: real Task-owned permission prompt with typed network scope, redacted query digest, all decisions, long-value wrapping, and keyboard focus.
- `ask-prompt-resolved-zh-cn.png`: the same real interaction after a successful `Allow once` decision.

The acceptance record and implementation decision are in [`2026-08-12-permission-two-mode-calibration-plan.md`](../../records/2026-08/2026-08-12-permission-two-mode-calibration-plan.md).
