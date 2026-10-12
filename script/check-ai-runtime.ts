import path from "path"

type PackageJson = {
  workspaces?: { catalog?: Record<string, string> }
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  patchedDependencies?: Record<string, string>
}

const root = path.resolve(import.meta.dir, "..")
const rootPackage = await readPackage(path.join(root, "package.json"))
const opencorvusPackage = await readPackage(path.join(root, "packages", "opencorvus", "package.json"))
const lock = await Bun.file(path.join(root, "bun.lock")).text()
const issues: string[] = []

const catalogAI = rootPackage.workspaces?.catalog?.ai
if (!catalogAI) {
  issues.push("root workspace catalog must own the ai version")
} else if (major(catalogAI) !== 7) {
  issues.push(`root workspace catalog ai must stay on major 7 for this runtime, got ${catalogAI}`)
}

if (opencorvusPackage.dependencies?.ai !== "catalog:") {
  issues.push(`packages/opencorvus must use ai from catalog:, got ${opencorvusPackage.dependencies?.ai ?? "<missing>"}`)
}

const openRouterVersion = opencorvusPackage.dependencies?.["@openrouter/ai-sdk-provider"]
if (!openRouterVersion) {
  issues.push("packages/opencorvus must declare @openrouter/ai-sdk-provider")
} else if (major(openRouterVersion) !== 3) {
  issues.push(`@openrouter/ai-sdk-provider must stay on major 3 while the runtime is ai v7, got ${openRouterVersion}`)
}

const openRouterPatch = Object.keys(rootPackage.patchedDependencies ?? {}).find((item) =>
  item.startsWith("@openrouter/ai-sdk-provider@"),
)
if (openRouterVersion && openRouterPatch && openRouterPatch !== `@openrouter/ai-sdk-provider@${openRouterVersion}`) {
  issues.push(
    `patched @openrouter/ai-sdk-provider must match package dependency ${openRouterVersion}, got ${
      openRouterPatch ?? "<missing>"
    }`,
  )
}

for (const version of matchVersions(lock, /"ai": \["ai@([^"]+)"/g)) {
  if (major(version) !== 7) issues.push(`bun.lock contains ai major ${major(version)} (${version})`)
}

for (const version of matchVersions(lock, /"@ai-sdk\/provider": \["@ai-sdk\/provider@([^"]+)"/g)) {
  if (major(version) !== 4) issues.push(`bun.lock contains @ai-sdk/provider major ${major(version)} (${version})`)
}

for (const version of matchVersions(lock, /"@ai-sdk\/provider-utils": \["@ai-sdk\/provider-utils@([^"]+)"/g)) {
  if (major(version) !== 5) {
    issues.push(`bun.lock contains @ai-sdk/provider-utils major ${major(version)} (${version})`)
  }
}

if (!lock.includes(`"@openrouter/ai-sdk-provider": ["@openrouter/ai-sdk-provider@${openRouterVersion}"`)) {
  issues.push("bun.lock must resolve @openrouter/ai-sdk-provider to its declared ai v7-compatible package")
}

if (issues.length > 0) {
  console.error("AI runtime dependency check failed:")
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}

console.log("ai runtime check passed (ai v7, provider v4, provider-utils v5, OpenRouter v3)")

async function readPackage(file: string): Promise<PackageJson> {
  return JSON.parse(await Bun.file(file).text()) as PackageJson
}

function major(version: string): number {
  const match = version.match(/^(\d+)/)
  return match ? Number(match[1]) : Number.NaN
}

function matchVersions(input: string, pattern: RegExp): string[] {
  return [...input.matchAll(pattern)].map((match) => match[1])
}
