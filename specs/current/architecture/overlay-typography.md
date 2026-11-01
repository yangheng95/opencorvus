# Overlay typography

`packages/overlay/src/styles/tokens/design-language.css` is the only font-size
and line-height scale owner for OpenCorvus application chrome. At
`--ui-scale: 1`, application chrome has four proportional roles and one
monospace role:

- `--ui-font-page` is 24px for prominent settings page headings and the usage
  identity heading. It is not a navigation, row, card or dialog-control role.
- `--ui-font-emphasis` is 16px for rare page, surface, dialog, and empty-state
  headings, plus singular primary totals or product marks that carry the same
  visual emphasis.
- `--ui-font-body` is 14px for prose, section headings, item identities,
  navigation, and controls.
- `--ui-font-code` is 13px for code blocks and trace bodies that need a
  code-specific reading size. Short monospace identifiers still choose body or
  caption by their semantic role.
- `--ui-font-caption` is 12px only for compact auxiliary information such as
  timestamps, status, counts, and technical metadata; paragraphs, summaries,
  descriptions, empty-state copy, navigation, and primary controls stay body.

Page headings are the sole 24px role; other application chrome stays between
12px and 16px at the default scale. Interactive Artifact content may own an internal type system, but the
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

Desktop density is also owned by `design-language.css`: 30px buttons/icon
actions/navigation rows, 32px form controls, 24px chips and 44px panel headers.
The spacing ladder retains its literal meanings. Surface owners select smaller
rungs rather than shrinking the entire application or adding density overrides.
Settings use 16px section gaps, 24px page insets and an 800px content column.
The existing SettingsGroup owns one surface with a quiet border, 12px radius,
and aligned 16px header/body insets. Rows remain content-driven with a 44px
floor and 8px vertical padding. Auxiliary navigation groups use caption type
and align with row text; selection uses the existing theme accent. Controls
retain natural wrapping and their existing focus/scroll owners.

The homepage uses a 64px top inset and one shared inline column for heading,
input and equal-height shortcut cells. Title/description and utility actions
form one head region, stacking within narrow desktop panes. The existing Composer, draft and
selection owners retain all interaction behavior; layout does not create a
second input or a separate navigation state.

Transcript Tool runs use the existing disclosure and source identities, with
8px between runs and 2px source margins. Pending argument bytes remain fully
available in the expanded payload; the compact identity shows the original
tool name and receiving status until the parsed invocation detail is ready.
The file-change summary consumes the shared file-row grid, with file identity
at the start and change counts at the end, rather than replacing its grid
with a centered button layout.
