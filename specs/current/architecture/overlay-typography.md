# Overlay typography

`packages/overlay/src/styles/tokens/design-language.css` is the only font-size
and line-height scale owner for OpenCorvus application chrome. At
`--ui-scale: 1`, application chrome has five proportional roles and one
monospace role:

- `--ui-font-page` is 22px for prominent settings page headings and the usage
  identity heading. It is not a navigation, row, card or dialog-control role.
- `--ui-font-emphasis` is 15px for surface/group/dialog and empty-state
  headings, plus singular primary totals or product marks that carry the same
  visual emphasis.
- `--ui-font-body` is 13px for reading prose, section headings, item identities,
  navigation, and controls.
- `--ui-font-secondary` is 12px for subordinate settings navigation and
  secondary control/group descriptions. It separates secondary interface text
  from primary labels without shrinking transcript reading or using metadata
  typography for product prose.
- `--ui-font-code` is 13px for code blocks and trace bodies that need a
  code-specific reading size. Short monospace identifiers still choose body or
  caption by their semantic role.
- `--ui-font-caption` is 12px only for compact auxiliary information such as
  timestamps, status, counts, and technical metadata; paragraphs, summaries,
  empty-state copy, primary navigation, and primary controls stay body;
  subordinate settings navigation and descriptions use the secondary role.

Page headings are the sole 22px role; other application chrome stays between
12px and 15px at the default scale. Interactive Artifact content may own an internal type system, but the
surrounding OpenCorvus chrome remains on this scale.

Surface styles may own layout, colour, spacing, and context-specific weight,
but they consume one of the canonical size roles directly. They do not create
local font-size or line-height aliases, derive intermediate pixel values, or
infer a larger role merely because a selector contains `title`, `head`, or
`label`. Hierarchy among body-sized item identities and section labels comes
from the bounded 400/500/600 weight scale, colour, spacing, and containment.

Line-height has one functional and three typographic roles:
`--ui-line-height-flat` for single-line centring, `--ui-line-height-tight` for
application chrome, `--ui-line-height-normal` for compact prose and code, and
`--ui-line-height-reading` (1.6) for transcript and other sustained reading. The
CSS token checker enforces both role vocabularies, their single declaration
owner, and rejects retired size tiers, component-local or header-composite
aliases, literal application-chrome font sizes, and size-bearing `font`
shorthands that omit the exact canonical line-height/family tail. It also locks
the `:root` family authority to bundled Geist/Noto and JetBrains Mono/Noto,
rejects typography writes through direct JSX `style` objects or DOM style
APIs, and preserves the theme-palette, motion, spacing, and VS Code Dark
invariants in the same non-UI checker. Interactive Artifact internals remain
outside the application design-language checks.

Desktop density is also owned by `design-language.css`: 28px buttons/icon
actions, 30px form controls, 24px navigation rows/chips and 40px panel headers.
The spacing ladder retains its literal meanings. Surface owners select smaller
rungs rather than shrinking the entire application or adding density overrides.
Settings use 16px section gaps, 24px page insets and a 760px content column.
The existing SettingsGroup places its title above one inset content surface
with a quiet border, 12px radius and 12px inline inset. Untitled dataset groups
remain transparent; complex lists retain their own section owners. Rows remain
content-driven with a 40px floor and 8px vertical padding. Page/group/field titles
use 22/15/13px with 600/600/500 weights. Group headings align with page and panel
edges; field text is inset 12px. Sidebar category headings use 13px/600 at the
child icon axis, while subordinate row labels use 12px/400 and indent 24px
(500 when selected). Selection uses the theme's neutral highlight. Controls
retain natural wrapping and their existing focus/scroll owners.

General settings group the original authorization rows into Permissions and
notifications/Git/diagnostic rows into General. Existing control and feedback
owners remain unchanged; implementation-file boundaries do not create cards.
Settings navigation groups the existing page IDs into application, product,
shared resources and data. Mission/automation pages belong to product; squads
and memory belong to shared resources. Search, page IDs and persistence retain
their original owners. Group labels do not introduce alternate routes.
The sidebar owns scrolling; its tab list has content-driven height rather than
occupying a full sidebar height in addition to the back/search controls.

The primary navigation is 48px and the default project rail is 240px, with the
existing pane resize/minimum-width contract. Shared segmented controls use one
quiet track and a selected surface; switches retain a 24px input region around
their 34px by 20px visual track. Their native input and focus owners remain.

The homepage uses a 48px top inset and one shared inline column for heading,
input and equal-height shortcut cells. Title/description and utility actions
form one head region, stacking within narrow desktop panes. The existing Composer, draft and
selection owners retain all interaction behavior; layout does not create a
second input or a separate navigation state.

The Composer uses one reference/context selector for its mode, target and
capabilities. Creation-time mode/target selectors live inside that original
popover; active work shows its real context and assigned squad with read-only
reference details. Authorization and model remain their original controls.
The former separate mode/target badges are removed. Text, draft revisions,
selection callbacks, send/stop, target lifecycle and model authority are not
reimplemented by this presentation aggregation.

Transcript Tool runs use the existing disclosure and source identities, with
8px between runs and 2px source margins. Pending argument bytes remain fully
available in the expanded payload; the compact identity shows the original
tool name and receiving status until the parsed invocation detail is ready.
The file-change summary consumes the shared file-row grid, with file identity
at the start and change counts at the end, rather than replacing its grid
with a centered button layout.

Within one card, adjacent messages consisting only of execution and sources
share a compact overview: actual call count, latest invocation, all current
activity/error counts and the existing SourceParts controls. The view keeps
narrative, delegated-context, interaction, artifact and failure boundaries.
Expansion renders original Parts in order with their original message IDs.
Neither persistence nor participant/message ownership is regrouped.
The file summary presents up to five files before offering expansion. Its
count and recorded line statistics share one header; reliability details use
the existing accessible tooltip primitive instead of another paragraph.
