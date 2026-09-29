import { builtinSkillSources } from "./builtin-payload"

/** Provider initialization and on-demand help serve the same artifact as the Skill loader. */
export function builtinGuidance(name: "browser-use" | "computer-use") {
  const source = builtinSkillSources.find((skill) => skill.name === name)
  if (!source) throw new Error(`Missing built-in guidance Skill ${name}`)
  return source.skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim()
}
