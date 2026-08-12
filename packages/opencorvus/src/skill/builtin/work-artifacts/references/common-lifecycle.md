# Work Artifact lifecycle

- Treat the requested editable file as the primary deliverable.
- Use only profiles listed by the mounted typed tool schema. Do not infer
  support from a filename extension, installed viewer, or underlying binary.
- Keep authoring input complete, ordered, bounded, and tied to the intended
  audience, purpose, format, sources, and acceptance criteria.
- Use canonical attachments instead of local filesystem paths or remote URLs.
- Validate the exact authored attachment. Preserve the returned validation
  receipt with its source, runtime, and render digests.
- Review the actual fresh renders. A successful command, zero issue count,
  schema result, or file existence is not visual acceptance.
- Deliver only with the exact receipt for the final candidate. Never alter a
  receipt or reuse one after reauthoring.
