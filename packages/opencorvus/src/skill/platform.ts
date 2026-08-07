import z from "zod"

export namespace SkillPlatform {
  const byNodePlatform = {
    win32: "windows",
    darwin: "macos",
    linux: "linux",
  } as const satisfies Partial<Record<NodeJS.Platform, string>>

  export const Schema = z.enum(byNodePlatform)
  export type Value = z.infer<typeof Schema>

  /** Node.js platform identifiers stay internal; portable Skill metadata uses ecosystem operating-system names. */
  export function fromNode(platform: NodeJS.Platform = process.platform): Value {
    return Schema.parse(byNodePlatform[platform as keyof typeof byNodePlatform])
  }

  export function supports(declared: readonly Value[], platform: NodeJS.Platform = process.platform): boolean {
    return declared.length === 0 || declared.includes(fromNode(platform))
  }
}
