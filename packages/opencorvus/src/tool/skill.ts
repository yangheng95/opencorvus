import path from "path"
import * as fs from "node:fs/promises"
import { pathToFileURL } from "url"
import z from "zod"
import { Tool } from "./tool"
import { Skill } from "../skill"
import { Ripgrep } from "../file/ripgrep"
import type { SkillSurfaceFamily, SkillSurfaceToolID } from "@/skill/surface"
import { MissionSkillCatalog } from "@/mission-skill/catalog"
import { Filesystem } from "@/util/filesystem"
import { redactInlinePayloads } from "@/util/inline-base64"
import { DEFAULT_TEXT_FILE_LIMIT, isBinaryFile, readTextFilePage, renderTextFilePage } from "./text-file"
import { scoreDiscoveryFields, type DiscoverySearchField } from "@/capability/fuzzy"

const DEFAULT_SKILL_SEARCH_RESULT_LIMIT = 5
const SAMPLED_SKILL_FILE_LIMIT = 10

export async function sampledSkillSupportingFilePaths(dir: string, signal?: AbortSignal) {
  return Array.fromAsync(
    Ripgrep.filesForHost({
      cwd: dir,
      follow: false,
      hidden: true,
      signal,
    }),
  ).then((entries) =>
    entries
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => file.toLowerCase() !== "skill.md")
      .sort((a, b) => a.localeCompare(b))
      .slice(0, SAMPLED_SKILL_FILE_LIMIT),
  )
}

function filesystemSkillDirectory(location: string) {
  if (!path.isAbsolute(location)) return undefined
  if (path.basename(location).toLowerCase() !== "skill.md") {
    throw new Error(`Filesystem skill location must point to SKILL.md: ${location}`)
  }
  return path.dirname(location)
}

function renderSkillLocation(location: string) {
  return path.isAbsolute(location) ? pathToFileURL(location).href : location
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

async function resolveSupportingFile(dir: string, relativePath: string) {
  const segments = Skill.supportingFilePathSegments(relativePath)
  const target = path.join(dir, ...segments)
  let resolved: [string, string]
  try {
    resolved = await Promise.all([fs.realpath(dir), fs.realpath(target)])
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Skill supporting file not found: ${relativePath}`, { cause: error })
    }
    throw error
  }
  const [root, candidate] = resolved
  if (!Filesystem.contains(root, candidate)) {
    throw new Error(`Skill supporting file escapes its mounted Skill directory: ${relativePath}`)
  }
  const stat = await fs.stat(candidate)
  if (!stat.isFile()) {
    throw new Error(`Skill supporting resource is not a file: ${relativePath}`)
  }
  return { candidate, stat }
}

export function createSkillLoaderTool(input: { id: SkillSurfaceToolID; family: SkillSurfaceFamily; label: string }) {
  return Tool.define(input.id, async (ctx) => {
    const surface = ctx?.skillSurface
    if (!surface || surface.family !== input.family || surface.tool_id !== input.id) {
      throw new Error(`${input.label} tool initialization requires its exact turn-resolved skill surface.`)
    }
    const mounted = surface.skills
    const compatible = mounted.filter((skill) => skill.enabled).map((skill) => skill.skill)

    const description =
      compatible.length === 0
        ? `Search for or load a ${input.label} that provides domain-specific instructions and workflows. No skills are currently available.`
        : [
            `Search for or load a ${input.label} that provides domain-specific instructions and workflows.`,
            `Current agent: ${surface.agent}`,
            "Call without a name to search/list skill metadata. Call with an exact name to load the full skill instructions. Call with that name and a relative file path named by the instructions or sampled file list to load a supporting file.",
            "",
            "Use search before planning when the task may match a specialized workflow. Search is fuzzy across mounted skill names, declared aliases, titles, descriptions, required tool hints, and SKILL.md contents.",
            "",
            `Search output returns up to ${DEFAULT_SKILL_SEARCH_RESULT_LIMIT} names, descriptions, required tool hints, and locations only. Loading by name returns a \`<skill_content name="...">\` block with the full SKILL.md body and sampled bundled file paths. Read those paths through this tool's \`file\` parameter, never through the project \`read\` tool.`,
          ].join("\n")

    const parameters = z
      .object({
        query: z
          .string()
          .optional()
          .describe(
            "Fuzzy search terms for mounted skill title, description, required_tools, or SKILL.md content. Omit to list compatible skills.",
          ),
        name: z
          .string()
          .optional()
          .describe(
            "Exact skill name to load. To load the root SKILL.md, provide name alone and omit file, offset, and limit. Omit name to search/list skills instead of loading full instructions.",
          ),
        file: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Exact forward-slash relative supporting-file path named by the loaded instructions or <skill_files>. Requires name. Never pass an absolute materialized cache path.",
          ),
        offset: z.coerce
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Supporting text-file line to start from (1-indexed). Requires file."),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(DEFAULT_TEXT_FILE_LIMIT)
          .optional()
          .describe(`Maximum supporting text-file lines to return (up to ${DEFAULT_TEXT_FILE_LIMIT}). Requires file.`),
      })
      .superRefine((value, refinement) => {
        if (value.file && !value.name) {
          refinement.addIssue({ code: "custom", path: ["name"], message: "name is required when file is provided" })
        }
        if ((value.offset !== undefined || value.limit !== undefined) && !value.file) {
          refinement.addIssue({
            code: "custom",
            path: ["file"],
            message: "file is required when offset or limit is provided",
          })
        }
      })

    return {
      description,
      parameters,
      async execute(params: z.infer<typeof parameters>, ctx) {
        if (!params.name) {
          const matches = searchSkills(compatible, params.query).slice(0, DEFAULT_SKILL_SEARCH_RESULT_LIMIT)
          const query = params.query?.trim()
          return {
            title: query ? `Skill search: ${query}` : "Skill list",
            output: renderSkillSearch(matches, compatible.length, query),
            metadata: {
              query: query ?? "",
              count: matches.length,
              total: compatible.length,
              names: matches.map((skill) => skill.name),
              name: "",
              dir: "",
              agent: surface.agent,
              scope: surface.scope,
            },
          }
        }

        const skill = compatible.find((item) => item.name === params.name)

        if (!skill) {
          const available = compatible.map((x) => x.name).join(", ")
          throw new Error(`Skill "${params.name}" not found or not allowed. Compatible skills: ${available || "none"}`)
        }

        const location =
          surface.family === "mission" ? await MissionSkillCatalog.materialize(skill) : await Skill.materialize(skill)
        const dir = filesystemSkillDirectory(location)
        if (params.file) {
          if (!dir) {
            throw new Error(`${input.label} "${skill.name}" does not expose a supporting-file directory.`)
          }
          const supporting = await resolveSupportingFile(dir, params.file)
          const mime = Filesystem.mimeType(supporting.candidate)
          const isImage = mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"
          const isPdf = mime === "application/pdf"
          const metadata = {
            query: "",
            count: 1,
            total: compatible.length,
            names: [skill.name],
            name: skill.name,
            dir,
            file: params.file,
            agent: surface.agent,
            scope: surface.scope,
          }
          if (isImage || isPdf) {
            const message = `${isImage ? "Image" : "Portable Document Format"} Skill supporting file loaded successfully`
            return {
              title: `Loaded ${input.label} file: ${params.file}`,
              output: message,
              metadata: { ...metadata, preview: message, truncated: false, lines: 0, totalLines: 0 },
              attachments: [
                {
                  type: "file" as const,
                  mime,
                  url: `data:${mime};base64,${Buffer.from(await Filesystem.readBytes(supporting.candidate)).toString("base64")}`,
                },
              ],
            }
          }
          if (await isBinaryFile(supporting.candidate, Number(supporting.stat.size))) {
            throw new Error(`Cannot read binary Skill supporting file: ${params.file}`)
          }
          const page = await readTextFilePage(supporting.candidate, {
            offset: params.offset,
            limit: params.limit,
          })
          const preview = redactInlinePayloads(page.raw.slice(0, 20).join("\n"))
          return {
            title: `Loaded ${input.label} file: ${params.file}`,
            output: [
              `<skill_file name="${escapeXml(skill.name)}" path="${escapeXml(params.file)}">`,
              redactInlinePayloads(renderTextFilePage(page)),
              "</skill_file>",
            ].join("\n"),
            metadata: {
              ...metadata,
              preview,
              truncated: page.truncated,
              lines: page.lines,
              totalLines: page.totalLines,
            },
          }
        }

        const files =
          dir !== undefined
            ? await sampledSkillSupportingFilePaths(dir, ctx.abort).then((entries) =>
                entries.map((file) => `<file>${escapeXml(file)}</file>`).join("\n"),
              )
            : ""
        const bundledFileLines =
          dir !== undefined
            ? [
                `Base directory for this skill: ${pathToFileURL(dir).href}`,
                `Load a relative supporting file by calling \`${input.id}\` again with \`name: "${skill.name}"\` and the exact \`file\` path below. Do not pass the materialized base directory to the project \`read\` tool.`,
                "Note: file list is sampled.",
                "",
                "<skill_files>",
                files,
                "</skill_files>",
              ]
            : ["<skill_files>", "</skill_files>"]

        return {
          title: `Loaded ${input.label}: ${skill.name}`,
          output: [
            `<skill_content name="${skill.name}">`,
            `# Skill: ${skill.name}`,
            "",
            skill.content.trim(),
            "",
            ...bundledFileLines,
            "</skill_content>",
          ].join("\n"),
          metadata: {
            query: "",
            count: 1,
            total: compatible.length,
            names: [skill.name],
            name: skill.name,
            dir: dir === undefined ? "" : dir,
            agent: surface.agent,
            scope: surface.scope,
          },
        }
      },
    }
  })
}

export const SkillTool = createSkillLoaderTool({
  id: "skill",
  family: "production",
  label: "skill",
})

export const MissionSkillTool = createSkillLoaderTool({
  id: "mission_skill",
  family: "mission",
  label: "Mission Skill",
})

export const SKILL_FAMILY_TOOL_IDS: readonly SkillSurfaceToolID[] = ["skill", "mission_skill"]

export function isSkillFamilyToolID(toolID: string): toolID is SkillSurfaceToolID {
  return (SKILL_FAMILY_TOOL_IDS as readonly string[]).includes(toolID)
}

function searchSkills(skills: Skill.Info[], query: string | undefined): Skill.Info[] {
  const needle = query?.trim()
  if (!needle) return skills
  return skills
    .map((skill) => ({ skill, score: scoreDiscoveryFields(needle, skillSearchFields(skill)) }))
    .filter((entry): entry is { skill: Skill.Info; score: number } => entry.score !== undefined)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map((entry) => entry.skill)
}

function skillSearchTitle(skill: Skill.Info): string {
  const heading = skill.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+\S/.test(line))
  return heading?.replace(/^#{1,6}\s+/, "").trim() || skill.name
}

function skillSearchFields(skill: Skill.Info): DiscoverySearchField[] {
  return [
    { text: skill.name, weight: 1 },
    ...skill.aliases.map((alias) => ({ text: alias, weight: 0.94 })),
    ...(skill.aliases.length > 1 ? [{ text: skill.aliases.join(" "), weight: 0.92 }] : []),
    { text: skillSearchTitle(skill), weight: 0.9 },
    { text: skill.description, weight: 0.78 },
    ...(skill.required_tools ?? []).map((tool) => ({ text: tool, weight: 0.7 })),
    { text: skill.content, weight: 0.62 },
  ]
}

function renderSkillSearch(skills: Skill.Info[], total: number, query: string | undefined): string {
  const header = [
    "<skill_search>",
    query ? `<query>${query}</query>` : "<query></query>",
    `<matched>${skills.length}</matched>`,
    `<total_compatible>${total}</total_compatible>`,
    "Use the exact <name> value with this tool to load full instructions.",
    "<skills>",
  ]
  const rows = skills.flatMap((skill) => [
    "  <skill>",
    `    <name>${skill.name}</name>`,
    `    <title>${skillSearchTitle(skill)}</title>`,
    `    <description>${skill.description}</description>`,
    `    <aliases>${skill.aliases.join(",") || "none"}</aliases>`,
    `    <required_tools>${(skill.required_tools ?? []).join(",") || "none"}</required_tools>`,
    `    <platforms>${skill.platforms.length ? skill.platforms.join(",") : "all"}</platforms>`,
    `    <location>${renderSkillLocation(skill.location)}</location>`,
    "  </skill>",
  ])
  return [...header, ...rows, "</skills>", "</skill_search>"].join("\n")
}
