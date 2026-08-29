#!/usr/bin/env bun

import path from "node:path"

const repositoryRoot = path.join(import.meta.dir, "..")

export type ReleaseMutationFinding = {
  file: string
  authority: string
}

export class ReleaseMutationTopologyError extends Error {
  readonly code = "unexpected_release_mutation_topology"

  constructor(readonly findings: ReleaseMutationFinding[]) {
    super(
      `Release mutation authority differs from the canonical topology:\n${findings
        .map(({ file, authority }) => `- ${file}: ${authority}`)
        .join("\n")}`,
    )
    this.name = "ReleaseMutationTopologyError"
  }
}

function gitOutput(args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
  }
  return result.stdout.toString()
}

function operationalSource(file: string): boolean {
  if (
    file === "script/check-release-mutation-topology.ts" ||
    file.includes("node_modules/") ||
    file.includes("/test/") ||
    file.includes(".test.")
  )
    return false
  return (
    /\.(?:bash|cjs|js|json|mjs|ps1|sh|ts|yaml|yml)$/.test(file) ||
    file.startsWith("script/") ||
    file.startsWith(".github/")
  )
}

export function readReleaseMutationTree(treeish?: string): { tree: string; sources: Map<string, string> } {
  const tree = treeish
    ? gitOutput(["rev-parse", "--verify", `${treeish}^{tree}`]).trim()
    : gitOutput(["write-tree"]).trim()
  const indexedFiles = new Map<string, string>()
  for (const entry of gitOutput(["ls-tree", "-r", "-z", tree]).split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\t")
    const metadata = entry.slice(0, separator).split(" ")
    if (separator < 0 || metadata[1] !== "blob" || !metadata[2]) continue
    indexedFiles.set(entry.slice(separator + 1), metadata[2])
  }
  // The topology must not depend on a keyword prefilter: a wrapper invocation such as
  // `git_cmd tag ...` can be a writer even when the file never contains the words `git tag`
  // or `release`. Read every operational blob from this one frozen tree instead.
  const files = [...indexedFiles.keys()].filter(operationalSource)
  const sources = new Map<string, string>()
  const objects = files.map((file) => indexedFiles.get(file)!)
  const batch = Bun.spawnSync(["git", "cat-file", "--batch"], {
    cwd: repositoryRoot,
    stdin: new TextEncoder().encode(`${objects.join("\n")}\n`),
    stdout: "pipe",
    stderr: "pipe",
  })
  if (batch.exitCode !== 0) throw new Error(`git cat-file --batch failed: ${batch.stderr.toString().trim()}`)
  const output = Buffer.from(batch.stdout)
  let offset = 0
  for (let index = 0; index < files.length; index += 1) {
    const headerEnd = output.indexOf(0x0a, offset)
    if (headerEnd < 0) throw new Error(`git cat-file omitted the header for ${files[index]}`)
    const [object, type, rawSize] = output.subarray(offset, headerEnd).toString("utf8").split(" ")
    const size = Number(rawSize)
    if (object !== objects[index] || type !== "blob" || !Number.isSafeInteger(size) || size < 0) {
      throw new Error(`git cat-file returned an invalid blob header for ${files[index]}`)
    }
    const contentStart = headerEnd + 1
    const contentEnd = contentStart + size
    sources.set(files[index]!, output.subarray(contentStart, contentEnd).toString("utf8"))
    offset = contentEnd + 1
  }
  return { tree, sources }
}

function shellReleaseMutations(file: string, content: string): ReleaseMutationFinding[] {
  const normalized = content.replace(/\\\r?\n[ \t]*/g, " ")
  const ghTools = new Set(["gh"])
  const gitTools = new Set(["git"])
  for (const match of normalized.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{([^}]+)\}/g)) {
    if (/\bgh\b/.test(match[2]!)) ghTools.add(match[1]!)
    if (/\bgit\b/.test(match[2]!)) gitTools.add(match[1]!)
  }
  const escape = (tool: string) => tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const ghPattern = [...ghTools].map(escape).join("|")
  const gitPattern = [...gitTools].map(escape).join("|")
  const findings: ReleaseMutationFinding[] = []
  const ghCommand = new RegExp(
    `\\b(${ghPattern})\\s+(?:(?:-R|--repo|--hostname)(?:=|\\s+)[^\\s;]+\\s+)*release\\s+(create|upload|edit|delete)\\s+([^\\s;]+)`,
    "g",
  )
  for (const match of normalized.matchAll(ghCommand)) {
    findings.push({ file, authority: `cli:${match[1]}:release-${match[2]}:${match[3]}` })
  }

  // Programmatic command adapters are release writers just as shell invocations are. Capture
  // the authority from the literal command tuple while leaving its tag expression visible.
  for (const match of content.matchAll(
    /\bgh\s*\(\s*\[\s*["']release["']\s*,\s*["'](create|upload|edit|delete)["']\s*,\s*([^,\]\r\n]+)/g,
  )) {
    findings.push({ file, authority: `programmatic:gh:release-${match[1]}:${match[2]!.trim()}` })
  }

  const tagCommand = new RegExp(`\\b(${gitPattern})\\s+tag(?:\\s|$)`, "g")
  for (const _match of normalized.matchAll(tagCommand)) findings.push({ file, authority: "git:tag-write" })

  const pushCommand = new RegExp(`\\b(${gitPattern})\\s+push\\s+([^;\\r\\n]+)`, "g")
  for (const match of normalized.matchAll(pushCommand)) {
    const args = match[2]!
    if (
      /(?:^|\s)--tags(?:\s|$)/.test(args) ||
      /refs\/tags\//.test(args) ||
      /(?:^|\s)tag\s+[^\s]+/.test(args) ||
      /(?:^|\s)v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\s|$)/.test(args)
    ) {
      findings.push({ file, authority: "git:tag-push" })
    }
  }
  return findings
}

export function analyzeReleaseMutations(sources: Map<string, string>): ReleaseMutationFinding[] {
  const findings: ReleaseMutationFinding[] = []
  const writeMethod = /["'](?:POST|PATCH|DELETE)["']|--method\s+(?:POST|PATCH|DELETE)\b|-X\s+(?:POST|PATCH|DELETE)\b/i
  for (const [file, content] of sources) {
    findings.push(...shellReleaseMutations(file, content))
    if (writeMethod.test(content) && /\/git\/refs(?:\/|[`"'\s]|$)/.test(content)) {
      findings.push({ file, authority: "rest:git-ref-write" })
    }
    if (writeMethod.test(content) && /\/releases(?:\/|[`"'\s]|$)/.test(content)) {
      findings.push({ file, authority: "rest:release-write" })
    }
  }
  return findings.sort((left, right) =>
    `${left.file}:${left.authority}`.localeCompare(`${right.file}:${right.authority}`),
  )
}

const canonicalReleaseMutationTopology: ReleaseMutationFinding[] = [
  { file: ".github/workflows/build.yml", authority: 'cli:gh:release-upload:"v${VERSION}"' },
  { file: "script/settle-desktop-update-channel.ts", authority: "programmatic:gh:release-upload:this.tag" },
  { file: "script/settle-desktop-update-channel.ts", authority: "rest:release-write" },
  { file: "script/verify-release-identity.ts", authority: "rest:git-ref-write" },
  { file: "script/verify-release-identity.ts", authority: "rest:release-write" },
]

export function assertReleaseMutationTopology(sources: Map<string, string>): ReleaseMutationFinding[] {
  const actual = analyzeReleaseMutations(sources)
  if (JSON.stringify(actual) !== JSON.stringify(canonicalReleaseMutationTopology)) {
    throw new ReleaseMutationTopologyError(actual)
  }
  return actual
}

export function checkReleaseMutationTopology(treeish?: string): { tree: string; findings: ReleaseMutationFinding[] } {
  const { tree, sources } = readReleaseMutationTree(treeish)
  return { tree, findings: assertReleaseMutationTopology(sources) }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (!(args.length === 0 || (args.length === 2 && args[0] === "--treeish"))) {
    console.error("usage: bun run script/check-release-mutation-topology.ts [--treeish <commit-or-tree>]")
    process.exit(1)
  }
  try {
    const result = checkReleaseMutationTopology(args[1])
    console.log(
      `release-mutation-topology ok (${result.tree.slice(0, 12)}) — ${result.findings.length} canonical authorities`,
    )
  } catch (error) {
    if (error instanceof ReleaseMutationTopologyError) console.error(`${error.code}: ${error.message}`)
    else console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
