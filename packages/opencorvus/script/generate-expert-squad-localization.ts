#!/usr/bin/env bun

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { discoverExpertSquadPayloadPackages } from "./generate-expert-squad-payload"
import { EMBEDDED_EXPERT_SQUAD_IDS } from "../src/expert-squad/builtin/ids"
import { BUILTIN_EXPERT_SQUAD_NAMESPACE } from "../src/expert-squad/id"
import { builtInPackageSources } from "../src/expert-squad/builtin"
import { parse, type ParseError } from "jsonc-parser"

// The published website already carries a reviewed Chinese projection of every bundled Expert Squad.
// Market and catalog discovery are byte-identical English package sources, so a Chinese request scores
// zero against them. This entry produces bounded search data and the interface's description data
// from that same authoring source. Neither projection enters a package payload.

const PRIMARY_LIMIT = 1_000
const DETAIL_ENTRY_LIMIT = 240
const DETAIL_ENTRY_COUNT = 32

interface SquadTranslation {
  label: string
  description: string
  selectorSummary: string
  agents: Record<string, { label: string; description?: string }>
  workflows: Record<string, { label: string; description: string; nodes: Record<string, string> }>
}

function searchLocalizationModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "generated", "expert-squad-search-localization.ts")
}

function descriptionLocalizationModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "overlay", "src", "generated", "expert-squad-descriptions.ts")
}

function sourceDescription(text: string, namespace: string, id: string): string {
  const errors: ParseError[] = []
  const manifest = parse(text, errors, { allowTrailingComma: true })
  if (errors.length || manifest?.namespace !== namespace || manifest?.id !== id) {
    throw new Error(`Expert squad localization requires the exact manifest for ${namespace}/${id}`)
  }
  if (typeof manifest.description !== "string" || !manifest.description.trim()) {
    throw new Error(`Expert squad localization requires a description for ${namespace}/${id}`)
  }
  return manifest.description
}

function localizationSourceDirectory(repoRoot: string): string {
  return path.join(repoRoot, "packages", "web", "src", "content")
}

async function loadTranslations(repoRoot: string): Promise<Map<string, SquadTranslation>> {
  const directory = localizationSourceDirectory(repoRoot)
  const files = fs
    .readdirSync(directory)
    .filter((entry) => /^public-market-zh-.+\.ts$/u.test(entry) && entry !== "public-market-zh-types.ts")
    .sort()
  if (files.length === 0) {
    throw new Error(`Expert squad search localization found no translation modules in ${directory}`)
  }
  const translations = new Map<string, SquadTranslation>()
  for (const file of files) {
    const module = (await import(pathToFileURL(path.join(directory, file)).href)) as Record<string, unknown>
    for (const value of Object.values(module)) {
      if (!value || typeof value !== "object") continue
      for (const [key, translation] of Object.entries(value as Record<string, SquadTranslation>)) {
        if (!key.includes("/")) continue
        if (translations.has(key)) {
          throw new Error(`Expert squad search localization received duplicate translation key ${key}`)
        }
        translations.set(key, translation)
      }
    }
  }
  return translations
}

function bounded(value: string | undefined, limit: number): string {
  return (value ?? "").replace(/\s+/gu, " ").trim().slice(0, limit)
}

function detailEntries(translation: SquadTranslation): string[] {
  const entries: string[] = []
  for (const agent of Object.values(translation.agents)) {
    entries.push(bounded(`${agent.label} ${agent.description ?? ""}`, DETAIL_ENTRY_LIMIT))
  }
  for (const workflow of Object.values(translation.workflows)) {
    entries.push(bounded(`${workflow.label} ${workflow.description}`, DETAIL_ENTRY_LIMIT))
    for (const node of Object.values(workflow.nodes)) entries.push(bounded(node, DETAIL_ENTRY_LIMIT))
  }
  return [...new Set(entries.filter(Boolean))].slice(0, DETAIL_ENTRY_COUNT)
}

async function renderExpertSquadLocalizationModules(
  repoRoot: string,
): Promise<Array<{ file: string; content: string }>> {
  const payloadPackages = await discoverExpertSquadPayloadPackages(repoRoot)
  const packageIdentities = new Map<string, { namespace: string; id: string; description: string }>()
  for (const pkg of payloadPackages) {
    packageIdentities.set(`${pkg.namespace}/${pkg.id}`, {
      namespace: pkg.namespace,
      id: pkg.id,
      description: sourceDescription(
        fs.readFileSync(path.join(pkg.root, "expert-squad.jsonc"), "utf8"),
        pkg.namespace,
        pkg.id,
      ),
    })
  }
  for (const id of EMBEDDED_EXPERT_SQUAD_IDS) {
    const pkg = builtInPackageSources.find(
      (source) => source.namespace === BUILTIN_EXPERT_SQUAD_NAMESPACE && source.id === id,
    )
    if (!pkg) throw new Error(`Expert squad localization requires the embedded source for ${id}`)
    packageIdentities.set(`${pkg.namespace}/${pkg.id}`, {
      namespace: pkg.namespace,
      id: pkg.id,
      description: sourceDescription(pkg.files["expert-squad.jsonc"], pkg.namespace, pkg.id),
    })
  }
  const packages = [...packageIdentities.values()].sort((a, b) =>
    `${a.namespace}/${a.id}`.localeCompare(`${b.namespace}/${b.id}`),
  )
  const translations = await loadTranslations(repoRoot)
  const blocks: string[] = []
  const descriptions: string[] = []

  for (const pkg of packages) {
    const key = `${pkg.namespace}/${pkg.id}`
    const translation = translations.get(key)
    if (!translation) {
      throw new Error(`Expert squad search localization has no reviewed translation for ${key}`)
    }
    const primary = [
      bounded(translation.label, PRIMARY_LIMIT),
      bounded(translation.description, PRIMARY_LIMIT),
      bounded(translation.selectorSummary, PRIMARY_LIMIT),
    ].filter(Boolean)
    if (primary.length !== 3) {
      throw new Error(`Expert squad search localization received an incomplete translation for ${key}`)
    }
    const detail = detailEntries(translation)
    descriptions.push(
      `  ${JSON.stringify(key)}: ${JSON.stringify({ source: pkg.description, "zh-CN": translation.description })},`,
    )
    blocks.push(
      [
        `  ${JSON.stringify(key)}: {`,
        `    primary: [${primary.map((entry) => JSON.stringify(entry)).join(", ")}],`,
        `    detail: [${detail.map((entry) => JSON.stringify(entry)).join(", ")}],`,
        "  },",
      ].join("\n"),
    )
  }

  const header = "// Auto-generated by packages/opencorvus/script/generate-expert-squad-localization.ts. Do not edit."
  const search = [
    header,
    "// Search-only localized projection of the bundled Expert Squads, lifted from the reviewed public",
    "// market translations. These strings never enter a package payload and never change a package digest.",
    "",
    "export interface ExpertSquadSearchLocalization {",
    "  readonly primary: readonly string[]",
    "  readonly detail: readonly string[]",
    "}",
    "",
    "export const expertSquadSearchLocalizations: Readonly<Record<string, ExpertSquadSearchLocalization>> = {",
    ...blocks,
    "}",
    "",
  ].join("\n")
  const display = [
    header,
    "// The reviewed website translations are the only authoring source. Complete original descriptions",
    "// bind each translation to its exact namespace/id and field, preserving user-authored changes.",
    "",
    'export const expertSquadDescriptions: Readonly<Record<string, { readonly source: string; readonly "zh-CN": string }>> = {',
    ...descriptions,
    "}",
    "",
  ].join("\n")
  console.log(
    `Expert squad localization: ${packages.length} canonical descriptions, longest original ${Math.max(...packages.map((pkg) => pkg.description.length))} characters`,
  )
  return [
    { file: searchLocalizationModulePath(repoRoot), content: search },
    { file: descriptionLocalizationModulePath(repoRoot), content: display },
  ]
}

export async function generateExpertSquadLocalizationModules(repoRoot: string): Promise<string[]> {
  const modules = await renderExpertSquadLocalizationModules(repoRoot)
  for (const { file, content } of modules) {
    const current = await fs.promises.readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (current === content) continue
    await fs.promises.mkdir(path.dirname(file), { recursive: true })
    await fs.promises.writeFile(file, content)
  }
  return modules.map(({ file }) => file)
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  for (const modulePath of await generateExpertSquadLocalizationModules(repoRoot)) {
    console.log(`Generated ${path.relative(repoRoot, modulePath).replaceAll(path.sep, "/")}`)
  }
}

if (import.meta.main) {
  await main()
}
