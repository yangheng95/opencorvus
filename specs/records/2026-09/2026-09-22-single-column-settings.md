# Single-column settings and compact capability details

## Recall

- User correction: “这么多工具，太冗余了。设置栏禁止设计双栏的”. The supplied screenshots reject repeated Chat/Work project paths, tall Mission tool chips, and the installed-Squad master/detail split. This supersedes the previous two-column settings decision.
- Acceptance: settings content has one reading column; resource lists open details in that same column with a clear return action; native tool references remain complete but secondary and compact; project scope is unambiguous without repeated full paths. Preserve existing assignments, exact installation identity, activation handlers and editable configuration.
- Constraints: no UI automated tests or fixtures, no new model requests or credentials, no subagents. Use the real development `/ui`, screenshots and manual review at desktop sizes. The earlier one-task Luna authorization was already exercised and blocked by upstream quota.
- Read: root AGENTS, prior primitive implementation Recall and delivery evidence, panel architecture, settings composites, ConversationCapabilityPanel, MissionSkillPanel, ExpertSquadPanel, settings/usage/automation styles, project-directory labeling helper and package build scripts.
- Searches: all definitions/callers of the affected selection, scope-label and layout classes; shared tool/reference presentation; settings grid rules and current architecture. Focused component-name search of overlay tests returned no matching UI tests. No automated UI tests will run.
- Current state: main is clean at 36753fce. Existing preview on 17881 is being used by the user; preserve it. Build with existing Vite configuration and emptyOutDir=false to retain its hashed assets, then use a separate source server on 17882 and a credential-free isolated runtime for review.

## Analysis

The prior implementation changed card chrome but retained the master/detail information architecture. CSS still assigns separate columns to Mission Skills and installed Squads, and a breakpoint only stacks them. That does not satisfy a single-column settings model. Replace the simultaneous panes with list/detail navigation using local presentation state; backend-selected installation identity remains authoritative and browsing must not activate a Squad.

Chat/Work currently prints the full project path in both a badge and a paragraph, then repeats model ownership and a read-only description on every tool row. Mission tool references inherit code-block padding and backgrounds and form fifteen separate vertical chips. A shared compact reference-list composite is justified by these two existing consumers. Keep all references readable and selectable under Disclosure, without changing runtime tool capabilities.

The horizontal audit also found side-by-side usage sections/official-source cards, Squad capability groups and automation form groups. Convert independent settings content sections to vertical flow; normal label/value and label/control rows remain one semantic form row. No routing, persistence, scheduling, API or model contract change is required. Main risks are losing detail navigation state on scope changes, obscuring active scope, and unintentional activation while browsing. Verify list/detail/back/filter interactions and scope disclosure on the actual page. Streaming and multi-agent acceptance from the previous task remain quota-blocked and are outside this correction's verification claim.

## Implementation and verification plan

1. Add a compact shared settings reference list, migrate Chat/Work and Mission tool references, and shorten the project introduction with an expandable exact path.
2. Replace Mission and installed-Squad split panes with single-column list/detail navigation. Remove obsolete grid/border/breakpoint rules; retain selected keys and current configuration handlers.
3. Converge the other independent settings content grids on single-column flow and update the current architecture contract.
4. Build the real renderer without removing the active preview's assets; serve a separate isolated `/ui` page, inspect dark/light and enlarged desktop screenshots, correct visual findings and repeat.
5. Run relevant type/i18n/CSS/docs/build checks, commit the scoped changes, fetch/merge upstream, audit outgoing commits and push with hooks.

## Evidence

The correction is implemented; evidence below records real-page inspection rather than automated UI tests.
- Implemented the shared compact reference list, single-column list/detail navigation and vertical independent settings groups. Source review corrected detail navigation so only a real scope-identity change returns to the list; ordinary catalog refresh keeps the user's current detail view.
- Real isolated Work Session ses_-zUU7Ozvizze2YiFhoXg was created through POST /global/work on port 17882, without any model or copied credentials. Manual dark 1440×900 review confirmed Chat's exact project path expands, all 39 declared native references remain available, Mission's 15 references wrap into a few text lines, and browsing Advanced still shows Base as the active project/session selection. The installed list and details never appear side by side.
- First visual pass exposed one remaining Mission detail left-border/inset rule and oversized capability Skill descriptions. Removed the obsolete split-pane border/inset, collapsed directory installation paths, reduced the Mission introduction to one line, and added two-line Skill previews with explicit full-description disclosures. These follow-ups require rebuilt screenshots before delivery.

- Final rebuilt-page review: dark 1440×900 / 100% and 1920×1080 / 150%, plus light 1280×800 / 100%. Mission detail has no residual split-pane border; all 15 tool names occupy four wrapping text rows at 150%. Installed Squads show either list or detail, and the active-only filter survives detail/back navigation. A real Work skill checkbox was enabled, remained enabled after switching pages, and was restored; Chat kept its separate unassigned value. No activation or model task was started.
- Validation: overlay typecheck, CSS token graph (8403 references / 264 globals), i18n (1852 keys), renderer build/public-surface check, docs:check and diff whitespace checks passed. Build keeps the existing vendor directive and bundle-size warnings. The source development preview is on port 17882; the earlier 17881 process was not restarted. The earlier streaming/agent-data quota blocker is unchanged and no new streaming acceptance is claimed.
- The final light Chat screenshot also confirms that the two-line Skill preview expands to the complete source description, with the independent assignment checkbox retained.
