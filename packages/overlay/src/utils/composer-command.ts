export type ComposerCommand = { kind: "goal" | "side" | "message"; text: string }

/** Explicit composer commands open local controls before message submission. */
export function parseComposerCommand(input: string): ComposerCommand {
  const text = input.trim()
  const match = /^\/(goal|side)(?:\s+([\s\S]*))?$/.exec(text)
  if (!match) return { kind: "message", text }
  return { kind: match[1] as "goal" | "side", text: (match[2] || "").trim() }
}
