# Sub-agent dock session switching

## Recall

- User reports that selecting different sub-agent tabs in the Side Dock changes the selected tab but continues showing the same child conversation. The supplied screenshot shows the Expert Squad agent tab strip and one selected `solution-architect` transcript.
- Acceptance: each agent tab selects its exact child Session; the old Session transcript disappears immediately on selection; loading, failure and loaded content all belong to the selected Session; live events and refreshes cannot repopulate another Session; actual desktop interaction visibly switches between at least two distinct child transcripts.
- Hard constraints: no UI automation tests, DOM assertions, snapshots or screenshot baselines. Validate the UI only through a real served page, actual interaction, screenshots and manual review. Preserve the backend's exact child-Session route and visible transcript messages.
- Read/search: `SubagentConversationPanel`, the selected Session signal in `main.tsx`, Kobalte-backed shared Tabs, `subagent-conversation.ts`, the exact backend child-Session route and its existing route tests.
- Observed facts: the controlled Tabs value and request key both include the selected Session ID; the backend route loads and validates the requested Session. Solid's installed `createResource` implementation retains the previous resolved value while a changed source is in `refreshing` state. `displayedConversation` projects `conversation()` without requiring its `targetKey` to equal the current request key, so a newly selected tab intentionally renders the previous Session until the replacement request settles. A slow, aborted or repeatedly superseded request makes the switch appear ineffective even though the tab selection changed.
- Direct trigger: selecting another agent changes `requestKey`, starting an asynchronous transcript load while `conversation()` still returns the previous Session value.
- Root cause: the render boundary does not bind resource data to the current selected-Session identity. Fetch and live projection are identity-aware, but the rendered value is not.
- Impact: every Task/Mission Side Dock sub-agent tab, including overflow-menu selection and active/terminal child Sessions. Backend persistence, scheduling, agent execution and the main conversation are unchanged.
- Plan: require exact `targetKey === requestKey` before rendering a transcript, so selection immediately enters the existing loading state and only the exact selected Session can render. Keep the live projection reset already bound to request key. Run Overlay typecheck/build and service contracts; then verify with actual desktop tabs and screenshots. Independent review follows the rendered verification.
- Independent agent feedback: final read-only review reported no findings. It confirmed that the `targetKey` guard binds rendered data to the current request, request changes use the existing loading state, live events remain Session-filtered, and live projection resets prevent cross-Session content from returning.

## Status

Implemented an exact render-identity boundary in `SubagentConversationPanel`: a resource value is renderable only when its `targetKey` equals the current request key. A changed selection therefore enters the existing loading state immediately instead of retaining another Session's transcript.

Validation completed against the production build served from an isolated current-schema runtime at `http://127.0.0.1:7894/ui/`:

- `bun run --cwd packages/overlay build:overlay --skip-dist-copy` completed and included the changed UI bundle.
- The real Side Dock opened a persisted Task with two distinct child Sessions. Selecting `work` showed only `REQUIREMENTS CHILD TRANSCRIPT`; selecting `chat` showed only `ARCHITECT CHILD TRANSCRIPT`; selecting `work` again restored only the first transcript. In each screenshot the selected tab, tab content identity and visible transcript agreed.
- No UI automation test, DOM assertion, snapshot or screenshot baseline was added or run. The evidence came from actual clicks, accessibility state and manual screenshot review.

Overlay and OpenCorvus typechecks, documentation generation checks and diff whitespace checks passed. Final independent read-only review reported no findings.
