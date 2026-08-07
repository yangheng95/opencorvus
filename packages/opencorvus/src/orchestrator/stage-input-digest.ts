import { createHash } from "node:crypto"

export function stageInputDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex")
}
