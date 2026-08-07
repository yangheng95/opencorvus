export type BuiltinSkillFile =
  | string
  | {
      encoding: "utf8" | "base64"
      content: string
    }

export type BuiltinSkillSource = {
  name: string
  skill: string
  files: Readonly<Record<string, BuiltinSkillFile>>
}
