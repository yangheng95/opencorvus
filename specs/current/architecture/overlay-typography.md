# Overlay typography

`packages/overlay/src/styles/tokens/design-language.css` is the only font-size
and line-height scale owner for OpenCorvus application chrome. At
`--ui-scale: 1`, application chrome has three proportional roles and one
monospace role:

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

Application chrome has no visible text above 16px or below 12px at the default
scale. Interactive Artifact content may own an internal type system, but the
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
`--ui-line-height-reading` for transcript and other sustained reading. The
CSS token checker enforces both role vocabularies, their single declaration
owner, and rejects retired size tiers, component-local or header-composite
aliases, literal application-chrome font sizes, and size-bearing `font`
shorthands that omit the exact canonical line-height/family tail. It also locks
the `:root` family authority to bundled Geist/Noto and JetBrains Mono/Noto,
rejects typography writes through direct JSX `style` objects or DOM style
APIs, and preserves the theme-palette, motion, spacing, and VS Code Dark
invariants in the same non-UI checker. Interactive Artifact internals remain
outside the application design-language checks.
