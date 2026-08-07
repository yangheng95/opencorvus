/**
 * read_attachment tool — lets the frontend-design agent actually consume the
 * text/markdown/JSON references listed in the task's attachment manifest.
 *
 * Why this exists:
 *   Task attachments are surfaced as refs in
 *   `AttachmentStore.renderAttachmentInventory`. Text-family attachments
 *   (design tokens JSON, style-guide markdown, brand-voice docs) can be read
 *   through this tool; binary media refs remain evidence refs for tools that
 *   can actually inspect that MIME.
 *   `AttachmentStore.renderAttachmentInventory`'s textual ledger.
 *   Before this tool existed, the agent could see the URL but had no way to
 *   actually open it: `webfetch` requires http(s) and the attachment URLs
 *   are server-relative, and `read` only covers paths inside the
 *   project worktree — not the per-project attachment store.
 *
 *   Without a dedicated reader, "here's a reference, now analyze it" forced
 *   the agent to either hallucinate the contents or silently ignore them.
 */
import { tool } from "ai"
import z from "zod"
import { AttachmentStore } from "@/storage/attachment-store"
import { Log } from "@/util/log"

const log = Log.create({ service: "frontend-design-tools" })

const MAX_DECODE_BYTES = 200_000

/**
 * Read an attachment from the project's AttachmentStore.
 *
 * Accepts either a canonical reference URL (`/attachment/<projectID>/<sha>.<ext>`)
 * or the bare stored name (`<sha>.<ext>`). When the bare form is used, the
 * projectID must be provided via `projectID` so resolution stays unambiguous
 * — guessing a projectID would silently pick the wrong file if two projects
 * ever share the same sha, so we require it explicitly.
 */
export function createReadAttachmentTool(defaultProjectID: string) {
  return {
    read_attachment: tool({
      description:
        "Read a task attachment by its URL or stored name. " +
        "Use this for text / markdown / JSON / CSS reference material listed in the task's attachment manifest — " +
        "design tokens, style guides, brand docs, etc. " +
        "Binary image / PDF / audio / video refs are rejected here unless they decode as text; use visual/runtime evidence tooling for pixel-level inspection. " +
        "Returns a UTF-8 decoded string (binary files are rejected) truncated to 200 KB.",
      inputSchema: z.object({
        reference: z
          .string()
          .describe(
            "Either the full `/attachment/<projectID>/<sha>.<ext>` URL from the manifest " +
              "or the bare `<sha>.<ext>` name.",
          ),
        projectID: z
          .string()
          .optional()
          .describe("Required only when `reference` is a bare name (not a /attachment/… URL)."),
      }),
      execute: async ({ reference, projectID }) => {
        let resolved: { projectID: string; name: string } | undefined
        if (reference.startsWith("/attachment/") || reference.startsWith("attachment:")) {
          resolved = AttachmentStore.nameFromUrl(reference.replace(/^attachment:/, "/attachment/"))
        } else {
          const effectiveProjectID = projectID ?? defaultProjectID
          if (!effectiveProjectID) {
            return "Error: reference is a bare name but no projectID was provided. Pass the full /attachment/<projectID>/<sha>.<ext> URL or supply projectID."
          }
          if (reference.includes("/") || reference.includes("\\")) {
            return "Error: bare attachment name must not contain path separators."
          }
          resolved = { projectID: effectiveProjectID, name: reference }
        }
        if (!resolved) return `Error: could not parse attachment reference: ${reference}`

        let bytes: Buffer
        try {
          bytes = await AttachmentStore.read(resolved.projectID, resolved.name)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          log.warn("read_attachment failed", { reference, projectID: resolved.projectID, error: msg })
          return `Error: attachment not readable (${reference}): ${msg}`
        }

        // Binary guard — UTF-8 decoding a PNG/PDF yields garbage that wastes
        // context and encourages hallucination. Detect by leading NULs.
        const probe = bytes.subarray(0, Math.min(bytes.length, 4096))
        let nul = 0
        for (const b of probe) if (b === 0) nul++
        if (nul > 4) {
          return (
            `Error: ${resolved.name} looks binary (${nul} NUL bytes in first ${probe.length}). ` +
            "Images/PDFs/binary assets must be inspected through visual evidence tooling, not decoded as text."
          )
        }

        const truncated = bytes.length > MAX_DECODE_BYTES
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
          truncated ? bytes.subarray(0, MAX_DECODE_BYTES) : bytes,
        )
        const suffix = truncated ? `\n\n[truncated: ${bytes.length - MAX_DECODE_BYTES} more bytes not shown]` : ""
        return decoded + suffix
      },
    }),
  }
}
