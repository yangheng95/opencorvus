# Persistent navigation rail — visual and mount evidence

Actual isolated development `/ui`, 1440×960 desktop, with real empty local catalogs and no model calls. Screenshots were captured and personally inspected after manual browser interactions; no UI automation assertion or mock HTTP fixture was used.

- [Scheduled, light](scheduled-light.jpg): navigation rail remains separate from the settings page.
- [Scheduled, dark](scheduled-dark.jpg): final build after searching for About and selecting Scheduled again; correct target, cleared query, project list remains collapsed.
- [Expert Squads, dark](expert-squads-dark.jpg): the same rail opens the Squad Market directly.
- [About, dark](about-dark.jpg): bottom rail entry opens the same parent-owned settings region.
- [Mission Board, light](mission-board-light.jpg): selecting Mission Board from Scheduled closes settings and activates the board through the existing navigation callback.
- [Open-page mount inspection](mount-inspection.json): actual DOM parent chains show the rail under panelBody and settings/primary pages under workspacePageStack; the mounted primary page is hidden and inert. Rail and page bounds are adjacent, not overlapping.
- [Return inspection](return-inspection.json): after keyboard navigation to Chats, the primary page is visible, its inert attribute is cleared, and Chats retains active state and keyboard focus.

The JSON files are read-only browser inspector observations, not UI automated tests or assertions. See the [plan and verification](../../records/2026-09/2026-09-30-persistent-navigation-rail.md).
