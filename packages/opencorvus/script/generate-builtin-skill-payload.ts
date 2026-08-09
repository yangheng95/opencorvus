#!/usr/bin/env bun

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Skill } from "../src/skill/skill"
import { parseFrontmatter } from "../src/util/frontmatter"

type BuiltinSkillInput = {
  name: string
  root: string
  skillPath: string
  files: Array<{
    sourcePath: string
    installedPath: string
  }>
}

type CollectionManifest = {
  shared_files: string[]
}

const COLLECTION_MANIFEST = "collection.json"
const SKILL_FILE = "SKILL.md"

export function resolveBuiltinSkillSourceRoot(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "src", "skill", "builtin")
}

export function resolveBuiltinSkillPayloadModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "src", "skill", "builtin-payload.ts")
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right)
}

async function isFile(file: string): Promise<boolean> {
  return fs.promises.stat(file).then(
    (entry) => entry.isFile(),
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
}

async function readCanonicalText(file: string): Promise<string> {
  return fs.promises.readFile(file, "utf8").then((text) => text.replace(/\r\n?/g, "\n"))
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = []
  async function walk(current: string): Promise<void> {
    const entries = (await fs.promises.readdir(current, { withFileTypes: true })).sort((left, right) =>
      comparePath(left.name, right.name),
    )
    for (const entry of entries) {
      if (entry.isSymbolicLink())
        throw new Error(`Built-in Skill source rejects symbolic link: ${path.join(current, entry.name)}`)
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"))
    }
  }
  await walk(root)
  return files.sort(comparePath)
}

async function skillName(skillPath: string): Promise<string> {
  const parsed = parseFrontmatter(await readCanonicalText(skillPath))
  return Skill.parseDefinition(parsed.data, skillPath).name
}

function assertContained(root: string, target: string, label: string): void {
  const relative = path.relative(root, target)
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return
  throw new Error(`${label} must stay inside ${root}`)
}

function assertSafeInstalledPath(value: string, label: string): void {
  const segments = value.split("/")
  if (
    !value ||
    value !== value.trim() ||
    value.includes("\\") ||
    value.includes(":") ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`${label} has unsafe installed path: ${value}`)
  }
  if (value.toLowerCase() === SKILL_FILE.toLowerCase()) {
    throw new Error(`${label} cannot replace ${SKILL_FILE}`)
  }
}

async function directSkill(root: string): Promise<BuiltinSkillInput> {
  const skillPath = path.join(root, SKILL_FILE)
  if (!(await isFile(skillPath))) throw new Error(`Built-in Skill directory is missing ${SKILL_FILE}: ${root}`)
  return {
    name: await skillName(skillPath),
    root,
    skillPath,
    files: (await collectFiles(root))
      .filter((file) => file !== SKILL_FILE)
      .map((file) => {
        assertSafeInstalledPath(file, `Built-in Skill ${root}`)
        return { sourcePath: path.join(root, ...file.split("/")), installedPath: file }
      }),
  }
}

async function collectionSkills(root: string): Promise<BuiltinSkillInput[]> {
  const manifestPath = path.join(root, COLLECTION_MANIFEST)
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8")) as CollectionManifest
  if (
    !Array.isArray(manifest.shared_files) ||
    manifest.shared_files.some((file) => typeof file !== "string" || !file)
  ) {
    throw new Error(`Built-in Skill collection has invalid shared_files: ${manifestPath}`)
  }
  const shared = manifest.shared_files.map((file) => {
    assertSafeInstalledPath(file, `Built-in Skill collection shared file ${file}`)
    const sourcePath = path.resolve(root, file)
    assertContained(root, sourcePath, `Built-in Skill collection shared file ${file}`)
    return { sourcePath, installedPath: file }
  })
  for (const file of shared) {
    if (!(await isFile(file.sourcePath)))
      throw new Error(`Built-in Skill collection shared file is missing: ${file.sourcePath}`)
  }
  const entries = (await fs.promises.readdir(root, { withFileTypes: true })).sort((left, right) =>
    comparePath(left.name, right.name),
  )
  const skills: BuiltinSkillInput[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw new Error(`Built-in Skill collection rejects symbolic link: ${path.join(root, entry.name)}`)
    if (!entry.isDirectory()) continue
    const skillRoot = path.join(root, entry.name)
    const skillPath = path.join(skillRoot, SKILL_FILE)
    if (!(await isFile(skillPath)))
      throw new Error(`Built-in Skill collection member is missing ${SKILL_FILE}: ${skillRoot}`)
    const member = await directSkill(skillRoot)
    member.files.push(...shared)
    member.files.sort((left, right) => comparePath(left.installedPath, right.installedPath))
    skills.push(member)
  }
  return skills
}

export async function discoverBuiltinSkills(
  repoRoot: string,
  options?: { sourceRoot?: string },
): Promise<BuiltinSkillInput[]> {
  const sourceRoot = options?.sourceRoot ?? resolveBuiltinSkillSourceRoot(repoRoot)
  const entries = (await fs.promises.readdir(sourceRoot, { withFileTypes: true })).sort((left, right) =>
    comparePath(left.name, right.name),
  )
  const skills: BuiltinSkillInput[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw new Error(`Built-in Skill source rejects symbolic link: ${path.join(sourceRoot, entry.name)}`)
    const absolute = path.join(sourceRoot, entry.name)
    if (entry.isFile() && entry.name.endsWith(".md")) {
      skills.push({ name: await skillName(absolute), root: sourceRoot, skillPath: absolute, files: [] })
      continue
    }
    if (!entry.isDirectory()) continue
    if (await isFile(path.join(absolute, COLLECTION_MANIFEST))) skills.push(...(await collectionSkills(absolute)))
    else skills.push(await directSkill(absolute))
  }
  const names = new Set<string>()
  for (const skill of skills) {
    if (names.has(skill.name)) throw new Error(`Built-in Skill source repeats identity: ${skill.name}`)
    names.add(skill.name)
  }
  return skills.sort((left, right) => comparePath(left.name, right.name))
}

export async function renderBuiltinSkillPayloadModule(
  repoRoot: string,
  options?: {
    sourceRoot?: string
    generatedBy?: string
    typeImport?: string
    typeName?: string
    constantName?: string
  },
): Promise<string> {
  const skills = await discoverBuiltinSkills(repoRoot, { sourceRoot: options?.sourceRoot })
  const blocks: string[] = []
  for (const skill of skills) {
    const files = new Map<string, string>()
    for (const file of skill.files) {
      if (files.has(file.installedPath))
        throw new Error(`Built-in Skill ${skill.name} repeats file ${file.installedPath}`)
      files.set(file.installedPath, JSON.stringify(await readCanonicalText(file.sourcePath)))
    }
    blocks.push(
      [
        "  {",
        `    name: ${JSON.stringify(skill.name)},`,
        `    skill: ${JSON.stringify(await readCanonicalText(skill.skillPath))},`,
        "    files: {",
        ...[...files]
          .sort(([left], [right]) => comparePath(left, right))
          .map(([file, expression]) => `      ${JSON.stringify(file)}: ${expression},`),
        "    },",
        "  },",
      ].join("\n"),
    )
  }
  return [
    `// Auto-generated by ${options?.generatedBy ?? "packages/opencorvus/script/generate-builtin-skill-payload.ts"}. Do not edit.`,
    `import type { ${options?.typeName ?? "BuiltinSkillSource"} } from ${JSON.stringify(options?.typeImport ?? "./builtin-source")}`,
    "",
    `export const ${options?.constantName ?? "builtinSkillSources"}: readonly ${options?.typeName ?? "BuiltinSkillSource"}[] = [`,
    ...blocks,
    "]",
    "",
  ].join("\n")
}

export async function generateBuiltinSkillPayloadModule(repoRoot: string): Promise<string> {
  const modulePath = resolveBuiltinSkillPayloadModulePath(repoRoot)
  const content = await renderBuiltinSkillPayloadModule(repoRoot)
  const current = await fs.promises.readFile(modulePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (current !== content) await fs.promises.writeFile(modulePath, content)
  return modulePath
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  const modulePath = await generateBuiltinSkillPayloadModule(repoRoot)
  console.log(`Generated ${path.relative(repoRoot, modulePath).replaceAll(path.sep, "/")}`)
}

if (import.meta.main) await main()
