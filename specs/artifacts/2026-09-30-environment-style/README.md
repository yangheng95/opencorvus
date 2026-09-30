# Project environment visual review

Real development `/ui`, 1440×960 desktop, September 30, 2026. The isolated presentation database contains actual Git/attachment data and explicitly labeled persisted child-conversation samples; no model request was made. Screenshots were inspected directly, without UI automated tests, image baselines or DOM assertions.

- [Dark overview and separate menu](dark-menu.jpg): project title, actual changes, branch/local control, full status, avatars/count, Sources, conditional Tools. The long attachment filename truncates within the panel. The menu opens beside the complete parent panel.
- [Light overview and separate menu](light-menu.jpg): same hierarchy and geometry using theme tokens.
- [Collapsed header](collapsed.jpg): project title and canonical additions/deletions remain visible beside the menu trigger.

Manual interaction also opened the existing environment editor and cancelled it, opened the canonical child-conversation Dock from Subagents, and dismissed the command menu and parent. Final read-only mount inspection found zero parent/menu nodes and focus on the Environment trigger. Native operating-system child-window behavior was not exercised by this browser-host review.

See the [implementation record](../../records/2026-09/2026-09-30-environment-reference-style.md) for data-preparation failures, checks, scope and limitations.
