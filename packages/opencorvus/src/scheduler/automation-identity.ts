import { createHash } from "node:crypto"

/** Immutable Automation occurrence identity shared by execution and data migration. */
export function deterministicAutomationID(prefix: "cal" | "atr" | "ses" | "msg" | "prt", ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex")
  return `${prefix}_automation_${digest.slice(0, 32)}`
}
