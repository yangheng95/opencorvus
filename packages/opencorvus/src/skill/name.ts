import z from "zod"

export const SkillNameSchema = z
  .string()
  .min(1, "skill name cannot be empty")
  .regex(/^[^/\\\r\n]+$/, "skill name cannot contain path separators or line breaks")
  .refine((name) => name === name.trim(), "skill name cannot contain leading or trailing whitespace")

export type SkillName = z.output<typeof SkillNameSchema>
