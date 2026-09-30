# Handoff context visual acceptance

Actual isolated development `/ui`, 1440×960 desktop, manually inspected through browser interaction. The Session messages are explicitly labelled local presentation samples; they are not model answers or evidence of a release. Every screenshot is an unmodified browser capture.

- [New message, dark](current-dark.jpg): subject and body first, separated exact delivery references, natural-height reading and expansion anchored at the beginning.
- [New message, light](current-light.jpg): same content and hierarchy under the light theme.
- [Existing persisted format](existing-dark.jpg): original line-oriented fields retain their authored boundaries without text parsing or stored-history rewriting.
- [Short context](short-dark.jpg): keyboard expansion shows two lines at natural height rather than a fixed 224px body.
- [Narrow conversation](narrow-dark.jpg): opening the Side chat panel narrows the main conversation; long handoff identifiers wrap while the same canonical message remains readable in reference history. Side chat's ordinary code viewer retains its existing horizontal scrolling.

No UI automation assertions, screenshot baselines, model calls or user-window restarts were used. See the [plan and verification record](../../records/2026-09/2026-09-30-handoff-context-readability.md).
