import z from "zod"
import { SkillNameSchema } from "./name"

const PREFIX = "default/skill/"

export const DefaultSkillRefSchema = z.string().superRefine((ref, context) => {
  if (!ref.startsWith(PREFIX)) {
    context.addIssue({ code: "custom", message: "Default skill ref must match default/skill/<name>" })
    return
  }
  const parsed = SkillNameSchema.safeParse(ref.slice(PREFIX.length))
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    context.addIssue({ code: "custom", message: `Default skill ref has invalid name: ${issue.message}` })
  }
})

export type DefaultSkillRef = z.infer<typeof DefaultSkillRefSchema>

export function defaultSkillNameFromRef(ref: string): string {
  return DefaultSkillRefSchema.parse(ref).slice(PREFIX.length)
}

export function defaultSkillRefFromName(name: string): DefaultSkillRef {
  return DefaultSkillRefSchema.parse(`${PREFIX}${SkillNameSchema.parse(name)}`)
}
