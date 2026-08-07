import { inferFamily } from "@/check/policy"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { CheckConfig, NamedCheckConfig, NamedCheckFamily } from "@/engine"
import { Filesystem } from "@/util/filesystem"
import fs from "fs/promises"
import path from "path"
import z from "zod"
import type { ProjectCheckCommand, CommandGroup } from "./types"

export async function resolveConfig(metadata?: Record<string, unknown>) {
  return CheckConfig.parse(metadata?.checks ?? {})
}

/** Auto-enable judge check — always active at standard+ tier. */
export function autoJudge(): Record<string, unknown> {
  return { judge: { enabled: true, mode: "strict" } }
}

/** Auto-enable code review — always active at standard+ tier. */
export function autoCodeReview(): Record<string, unknown> {
  return { code_review: { enabled: true, mode: "strict" } }
}

/** Auto-enable artifact check — always active at standard+ tier. */
export function autoArtifact(): Record<string, unknown> {
  return { artifact: { require_changed_files: true, require_diff: true, mode: "strict" } }
}

export function resolvedChecks(
  config: z.infer<typeof CheckConfig>,
  discovered: Awaited<ReturnType<typeof discoverChecks>>,
) {
  const next = {
    ...(config.build !== undefined
      ? { build: config.build }
      : discovered.build.length > 0
        ? { build: discovered.build.map((item) => item.command) }
        : {}),
    ...(config.test !== undefined
      ? { test: config.test }
      : discovered.test.length > 0
        ? { test: discovered.test.map((item) => item.command) }
        : {}),
    ...(config.lint !== undefined ? { lint: config.lint } : {}),
    ...(config.verify_cmd !== undefined ? { verify_cmd: config.verify_cmd } : {}),
    ...(config.startup ? { startup: config.startup } : {}),
    ...(config.artifact ? { artifact: config.artifact } : autoArtifact()),
    ...(config.visual ? { visual: config.visual } : {}),
    ...(config.playwright ? { playwright: config.playwright } : {}),
    ...(config.ui_review ? { ui_review: config.ui_review } : {}),
    ...(config.code_quality ? { code_quality: config.code_quality } : {}),
    ...(config.code_review ? { code_review: config.code_review } : {}),
    ...(config.dead_code_review ? { dead_code_review: config.dead_code_review } : {}),
    ...(config.judge ? { judge: config.judge } : autoJudge()),
    ...(config.spec_check ? { spec_check: config.spec_check } : {}),
    ...(config.timeout_ms ? { timeout_ms: config.timeout_ms } : {}),
  } as Record<string, unknown>
  const named = {
    ...Object.fromEntries(
      Object.entries(discovered.named).map(([key, value]) => [
        key,
        {
          label: value.label ?? checkLabel(key),
          family: value.family,
          commands: value.commands.map((item) => item.command),
          enabled: true,
        },
      ]),
    ),
    ...(config.named ?? {}),
  }
  if (Object.keys(named).length > 0) next.named = named
  return CheckConfig.parse(next)
}

export async function discoverChecks(changedFiles?: unknown) {
  const cwd = await discoverPackageRoot(changedFiles)
  const pkgPath = path.join(cwd, "package.json")
  const json = await readPackageJson(pkgPath)
  const scripts = json?.scripts ?? {}
  const run = packageScriptRunner(json, cwd)
  const files = Array.isArray(changedFiles)
    ? changedFiles
        .filter((item): item is string => typeof item === "string" && /\.(spec|test)\.[cm]?[jt]sx?$/.test(item))
        .map((item) => path.resolve(Instance.directory, item))
        .filter((item) => Filesystem.contains(cwd, item))
        .map((item) => path.relative(cwd, item).replaceAll("\\", "/"))
    : []
  const named = {
    ...(run && scripts.typecheck
      ? {
          typecheck: {
            name: "typecheck",
            label: "Type Check",
            family: "lint" as const,
            commands: run("typecheck"),
          },
        }
      : {}),
    ...(run && scripts.pycompile
      ? {
          py_compile: {
            name: "py_compile",
            label: "Python Compile",
            family: "build" as const,
            commands: run("pycompile"),
          },
        }
      : {}),
    ...(run && scripts.pytest
      ? {
          pytest: {
            name: "pytest",
            label: "Pytest",
            family: "test" as const,
            commands: run("pytest"),
          },
        }
      : {}),
  }
  return {
    build: run && scripts.build ? run("build") : [],
    test: run && scripts.test ? run("test") : [],
    lint: run && scripts.lint ? run("lint") : [],
    named,
  }
}

async function readPackageJson(
  pkgPath: string,
): Promise<{ scripts?: Record<string, string>; packageManager?: string } | undefined> {
  try {
    return JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
      scripts?: Record<string, string>
      packageManager?: string
    }
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : undefined
    if (code === "ENOENT") return undefined
    throw err
  }
}

function packageScriptRunner(
  pkg: { packageManager?: string } | undefined,
  cwd: string,
): ((name: string) => ProjectCheckCommand[]) | undefined {
  const manager = packageManagerName(pkg)
  if (!manager) return undefined
  if (!/^[a-z0-9._-]+$/i.test(manager)) return undefined
  return (name) => [{ command: `${manager} run ${name}`, cwd }]
}

function packageManagerName(pkg: { packageManager?: string } | undefined) {
  const raw = pkg?.packageManager?.trim()
  if (!raw) return undefined
  return raw.split("@", 1)[0]
}

export function commandGroups(
  config: z.infer<typeof CheckConfig>,
  discovered: Awaited<ReturnType<typeof discoverChecks>>,
) {
  return [
    ...(
      [
        { name: "build", label: "Build", family: "build" },
        { name: "test", label: "Unit Tests", family: "test" },
        { name: "lint", label: "Lint", family: "lint" },
        { name: "verify_cmd", label: "Verify Command", family: "verify_cmd" },
      ] as const
    ).map((item) =>
      group(
        item.name,
        config[item.name],
        item.name === "build"
          ? discovered.build
          : item.name === "test"
            ? discovered.test
            : item.name === "lint"
              ? config.lint === undefined
                ? []
                : discovered.lint
              : [],
        item.label,
        item.family,
      ),
    ),
    ...namedGroups(config.named, discovered.named),
  ].flatMap((item) => item ?? [])
}

function commandSpecs(configured?: string[] | false, discovered: ProjectCheckCommand[] = []) {
  if (configured === false) return []
  if (configured && configured.length > 0) {
    return configured.map((command) => ({ command }))
  }
  return discovered
}

function group(
  name: "build" | "test" | "lint" | "verify_cmd",
  configured: string[] | false | undefined,
  discovered: ProjectCheckCommand[],
  label: string,
  family: z.infer<typeof NamedCheckFamily>,
) {
  const commands = commandSpecs(configured, discovered)
  if (commands.length === 0) return
  return {
    name,
    label,
    family,
    commands,
  } satisfies CommandGroup
}

function namedGroups(
  configured: Record<string, z.infer<typeof NamedCheckConfig>> | undefined,
  discovered: Record<string, CommandGroup>,
) {
  const keys = new Set([...Object.keys(discovered), ...Object.keys(configured ?? {})])
  return [...keys].flatMap((key) => {
    const current = configured?.[key]
    if (current?.enabled === false) return []
    if (current) {
      return [
        {
          name: key,
          label: current.label ?? discovered[key]?.label ?? checkLabel(key),
          family: current.family ?? discovered[key]?.family ?? inferFamily(key),
          commands: current.commands.map((command) => ({
            command,
            cwd: current.cwd,
          })),
        } satisfies CommandGroup,
      ]
    }
    const discoveredGroup = discovered[key]
    if (!discoveredGroup) return []
    return [discoveredGroup]
  })
}

function checkLabel(key: string) {
  const known = {
    build: "Build",
    test: "Unit Tests",
    lint: "Lint",
    verify_cmd: "Verify Command",
    py_compile: "Python Compile",
    pytest: "Pytest",
    typecheck: "Type Check",
  } as Record<string, string>
  if (known[key]) return known[key]
  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((item) => item[0]?.toUpperCase() + item.slice(1))
    .join(" ")
}

export async function discoverPackageRoot(changedFiles?: unknown) {
  const root = Instance.directory
  const candidates = new Map<string, number>()
  const items = Array.isArray(changedFiles)
    ? changedFiles
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .filter(ProjectRuntimePaths.isSourceEnumerationAllowed)
    : []

  for (const file of items) {
    let current = path.dirname(path.resolve(root, file))
    while (Filesystem.contains(root, current)) {
      if (await Filesystem.exists(path.join(current, "package.json"))) {
        candidates.set(current, (candidates.get(current) ?? 0) + 1)
        break
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  if (candidates.size === 0) return root
  return [...candidates.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]![0]
}
