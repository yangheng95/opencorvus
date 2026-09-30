# Tool disclosure manual visual evidence

- [Collapsed desktop, dark](desktop-dark.png): actual tool identity and summary, compact chronological rows and preserved source links.
- [Expanded desktop, dark](expanded-dark.png): four direct result bodies with static identities after one disclosure click; no per-tool disclosure layer.
- [Side panel, dark](side-panel-dark.png): the same renderer in the narrow reference-history panel, with bounded summaries and visible status/chevron.
- [Collapsed desktop, light](desktop-light.png): theme-neutral typography, spacing and status treatment.

Manually captured and inspected on the repository development server at
`http://127.0.0.1:4219/ui/`, using an isolated runtime/project and a 1440 × 960
desktop viewport. These are visual evidence, not screenshot test baselines.

The conversation is explicitly labelled **corrected visual sample**. Its
presentation inputs were persisted through Session APIs in the isolated
runtime; they do not claim model generation or release execution. No Provider
credentials or actual model calls were used. The initial sample mixed path
separators and was replaced by a separate corrected sample with the canonical
Windows project path spelling.

Manual interactions: single `read package.json` opens its highlighted result
directly; Enter closes it; the run labelled by its final `bash` opens all four
results in source order; close/open works independently; open side chat and
reference history; inspect long-summary ellipsis in the narrow panel; switch
to Light and inspect again. The initial screenshot review led to fixing the
chat-specific directory scope for relative tool summaries, followed by a fresh
production build and the final screenshots above.
