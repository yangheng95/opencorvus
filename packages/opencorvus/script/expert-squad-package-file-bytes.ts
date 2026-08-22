import { isUtf8 } from "node:buffer"

export type CanonicalExpertSquadPackageFile =
  | { readonly encoding: "utf8"; readonly bytes: Buffer }
  | { readonly encoding: "binary"; readonly bytes: Buffer }

/** The exact file bytes embedded in an Expert Squad package payload and used by its revision digest. */
export function canonicalExpertSquadPackageFileBytes(bytes: Uint8Array): CanonicalExpertSquadPackageFile {
  if (!isUtf8(bytes)) return { encoding: "binary", bytes: Buffer.from(bytes) }
  return {
    encoding: "utf8",
    bytes: Buffer.from(Buffer.from(bytes).toString("utf8").replace(/\r\n?/g, "\n"), "utf8"),
  }
}
