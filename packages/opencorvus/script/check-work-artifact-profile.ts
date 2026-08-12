#!/usr/bin/env bun

import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import z from "zod"
import { parseFrontmatter } from "../src/util/frontmatter"
import { Skill } from "../src/skill/skill"
import {
  WORK_ARTIFACT_TOOL_IDS,
  WorkArtifactProfileRegistry,
  type WorkArtifactProfileID,
} from "../src/work-artifact/profile-registry"
import { WorkArtifactQualificationRegistry } from "../src/work-artifact/qualification-registry"
import { GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX } from "../src/work-artifact/qualification-matrix.generated"
import {
  assertZeroWorkArtifactRuntimeIssueCount,
  assertWorkArtifactRenderPng,
  inspectPptxPackage,
  parseWorkArtifactRuntimeJson,
  prepareWorkArtifactRuntimeEnvironment,
} from "../src/work-artifact/presentation"
import { createWorkArtifactTools } from "../src/tool/work-artifact"
import {
  WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST,
  WorkArtifactTargetPackageManifestSchema,
  verifyWorkArtifactTargetPackageManifest,
  writeWorkArtifactTargetPackageManifest,
} from "../src/work-artifact/runtime/package-manifest"
import {
  officeCliRuntime,
  parseWorkArtifactRuntimeLock,
  WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH,
  type WorkArtifactRuntimeLock,
} from "../src/work-artifact/runtime/runtime-lock"
import { WORK_ARTIFACT_RUNTIME_LOCK } from "./work-artifact-runtime-lock"
import { copyOfficeCliRuntime } from "./build-runtime-binaries"

const execFileAsync = promisify(execFile)

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function checkCatalog(profileID: WorkArtifactProfileID): Promise<{
  profile: WorkArtifactProfileID
  qualification: string
  runtime: string
  tools: readonly string[]
  toolSchemaRevision: string
  toolSchemas: readonly Readonly<{ id: string; sha256: string }>[]
  skill: string
}> {
  const profile = WorkArtifactProfileRegistry.require(profileID)
  const qualification = WorkArtifactQualificationRegistry.require(profile.qualification)
  if (qualification.profile !== profile.id) throw new Error("Work Artifact qualification/profile linkage mismatch")
  const runtime = officeCliRuntime(WORK_ARTIFACT_RUNTIME_LOCK)
  if (!profile.runtimes.includes(runtime.id) || !runtime.profiles.includes(profile.id)) {
    throw new Error("Work Artifact profile/runtime lock linkage mismatch")
  }
  if (runtime.execution_policy.network !== profile.networkIsolation) {
    throw new Error("Work Artifact profile/runtime isolation linkage mismatch")
  }

  const skillRoot = path.resolve(import.meta.dir, "../src/skill/builtin", profile.skillName)
  const skillPath = path.join(skillRoot, "SKILL.md")
  const parsed = parseFrontmatter(await fs.readFile(skillPath, "utf8"))
  const definition = Skill.parseDefinition(parsed.data, skillPath)
  const workerTools = WORK_ARTIFACT_TOOL_IDS.filter((tool) => tool !== "work_artifact_deliver")
  if (definition.name !== profile.skillName || JSON.stringify(definition.required_tools) !== JSON.stringify(workerTools)) {
    throw new Error("Work Artifact Skill/tool schema linkage mismatch")
  }
  if (definition.metadata?.["opencorvus.profile-set"] !== "work-artifacts@1") {
    throw new Error("Work Artifact Skill profile-set metadata mismatch")
  }
  const actualTools = Object.values(createWorkArtifactTools())
  if (JSON.stringify(actualTools.map((tool) => tool.id)) !== JSON.stringify(WORK_ARTIFACT_TOOL_IDS)) {
    throw new Error("Work Artifact actual Tool definitions do not match the profile registry")
  }
  const toolSchemas = await Promise.all(
    actualTools.map(async (tool) => {
      const initialized = await tool.init()
      const schema = z.toJSONSchema(initialized.parameters) as {
        properties?: Record<string, { const?: unknown; enum?: unknown[] }>
      }
      const profileSchema = schema.properties?.profile
      if (profileSchema?.const !== profile.id && !profileSchema?.enum?.includes(profile.id)) {
        throw new Error(`${tool.id} does not expose the qualified profile discriminator`)
      }
      if (tool.id === "work_artifact_deliver") {
        for (const field of ["validation_receipt_url", "validation_receipt_sha"]) {
          if (!schema.properties?.[field]) throw new Error(`${tool.id} omits ${field}`)
        }
      }
      return {
        id: tool.id,
        sha256: createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
      }
    }),
  )
  for (const schema of toolSchemas) {
    const generated = GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.tools.find((tool) => tool.id === schema.id)
    if (!generated || schema.sha256 !== generated.schema_sha256) {
      throw new Error(`${schema.id} schema SHA does not match ${profile.toolSchemaRevision}`)
    }
  }
  if (
    GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.runtime.lock_revision !==
      createHash("sha256").update(JSON.stringify(WORK_ARTIFACT_RUNTIME_LOCK)).digest("hex") ||
    JSON.stringify(
      GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.targets.map(({ os, arch }) => ({ os, arch })),
    ) !== JSON.stringify(profile.releaseTargets)
  ) {
    throw new Error("Generated Work Artifact qualification matrix does not match the runtime lock")
  }
  await Promise.all(
    profile.skillResources.map(async (resource) => {
      const info = await fs.stat(path.join(skillRoot, ...resource.split("/")))
      if (!info.isFile()) throw new Error(`Work Artifact Skill resource is not a file: ${resource}`)
    }),
  )
  return {
    profile: profile.id,
    qualification: qualification.id,
    runtime: runtime.id,
    tools: WORK_ARTIFACT_TOOL_IDS,
    toolSchemaRevision: profile.toolSchemaRevision,
    toolSchemas,
    skill: definition.name,
  }
}

async function runRuntime(executable: string, args: string[], cwd: string, lock: WorkArtifactRuntimeLock) {
  const runtime = officeCliRuntime(lock)
  const result = await execFileAsync(executable, args, {
    cwd,
    env: {
      ...process.env,
      ...(await prepareWorkArtifactRuntimeEnvironment(cwd)),
      ...runtime.execution_policy.environment,
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 45_000,
    windowsHide: true,
  })
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

async function checkPackagedLifecycle(packageRoot: string, pptx?: string) {
  const manifest = WorkArtifactTargetPackageManifestSchema.parse(
    JSON.parse(await fs.readFile(path.join(packageRoot, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST), "utf8")),
  )
  const lockPath = path.join(packageRoot, ...WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH.split("/"))
  const lock = parseWorkArtifactRuntimeLock(JSON.parse(await fs.readFile(lockPath, "utf8")))
  await verifyWorkArtifactTargetPackageManifest({ root: packageRoot, target: manifest.target, lock })
  const runtime = officeCliRuntime(lock)
  const executableEntry = manifest.files.find((file) => file.kind === "executable")
  if (!executableEntry) throw new Error("Work Artifact target package manifest has no runtime executable")
  const executable = path.join(packageRoot, ...executableEntry.path.split("/"))
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "work-artifact-check-"))
  if (process.platform !== "win32") await fs.chmod(workspace, 0o700)
  try {
    const smoke = await runRuntime(executable, runtime.smoke_argv, workspace, lock)
    if (!smoke.stdout && !smoke.stderr) throw new Error(`${runtime.id} smoke command returned no version output`)
    const source = path.join(workspace, "candidate.pptx")
    if (pptx) {
      await fs.writeFile(source, await fs.readFile(pptx), { flag: "wx", mode: 0o600 })
    } else {
      const created = await runRuntime(
        executable,
        ["create", source, "--type", "pptx", "--locale", "en-US", "--json"],
        workspace,
        lock,
      )
      parseWorkArtifactRuntimeJson(Buffer.from(created.stdout), `${runtime.id} create`)
      const batch = path.join(workspace, "qualification.json")
      await fs.writeFile(
        batch,
        JSON.stringify([
          { command: "add", parent: "/", type: "slide", props: { layout: "Blank", background: "FFFFFF" } },
        ]),
        { flag: "wx", mode: 0o600 },
      )
      if (process.platform !== "win32") await fs.chmod(batch, 0o600)
      const batched = await runRuntime(
        executable,
        ["batch", source, "--input", batch, "--stop-on-error", "--json"],
        workspace,
        lock,
      )
      parseWorkArtifactRuntimeJson(Buffer.from(batched.stdout), `${runtime.id} batch`)
    }
    if (process.platform !== "win32") await fs.chmod(source, 0o600)
    const inspection = await inspectPptxPackage(await fs.readFile(source))
    const validation = await runRuntime(executable, ["validate", source, "--json"], workspace, lock)
    assertZeroWorkArtifactRuntimeIssueCount(
      parseWorkArtifactRuntimeJson(Buffer.from(validation.stdout), `${runtime.id} validate`),
      `${runtime.id} validate`,
    )
    const issues = await runRuntime(executable, ["view", source, "issues", "--json"], workspace, lock)
    assertZeroWorkArtifactRuntimeIssueCount(
      parseWorkArtifactRuntimeJson(Buffer.from(issues.stdout), `${runtime.id} issues`),
      `${runtime.id} issues`,
    )
    for (let slide = 1; slide <= inspection.slideCount; slide++) {
      const render = path.join(workspace, `slide-${slide}.png`)
      await runRuntime(
        executable,
        [
          "view",
          source,
          "screenshot",
          "--out",
          render,
          "--page",
          String(slide),
          "--render",
          "html",
          "--screenshot-width",
          "1280",
          "--screenshot-height",
          "720",
        ],
        workspace,
        lock,
      )
      const rendered = await fs.readFile(render)
      await assertWorkArtifactRenderPng(rendered, `${runtime.id} rendered slide ${slide}`)
    }
    return { target: manifest.target, runtime: runtime.id, slides: inspection.slideCount }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })
  }
}

async function checkPackagedTypedLifecycle(packageRoot: string) {
  const executable = path.join(packageRoot, process.platform === "win32" ? "opencorvus.exe" : "opencorvus")
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "work-artifact-compiled-check-"))
  const home = path.join(workspace, "home")
  const gitHome = path.join(home, "git")
  const gitTemplate = path.join(gitHome, "template")
  const gitGlobalConfig = path.join(gitHome, "global.gitconfig")
  const managedConfig = path.join(home, "managed-config")
  await fs.mkdir(gitTemplate, { recursive: true, mode: 0o700 })
  await fs.mkdir(managedConfig, { recursive: true, mode: 0o700 })
  await fs.writeFile(gitGlobalConfig, "", { flag: "wx", mode: 0o600 })
  const gitEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    Path: process.env.Path,
    PATHEXT: process.env.PATHEXT,
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    COMSPEC: process.env.COMSPEC,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: gitHome,
    USERPROFILE: gitHome,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: gitGlobalConfig,
    GIT_TEMPLATE_DIR: gitTemplate,
  }
  const runGit = async (args: string[]) => {
    await execFileAsync("git", args, { cwd: workspace, env: gitEnv, timeout: 30_000, windowsHide: true })
  }
  await runGit(["init", `--template=${gitTemplate}`])
  await runGit(["config", "user.name", "OpenCorvus Work Artifact Checker"])
  await runGit(["config", "user.email", "work-artifact-checker@example.invalid"])
  await runGit(["commit", "--allow-empty", "-m", "qualification root"])
  try {
    const acceptanceEnv: NodeJS.ProcessEnv = { ...process.env }
    for (const key of [
      "OPENCORVUS_CONFIG",
      "OPENCORVUS_CONFIG_DIR",
      "OPENCORVUS_CONFIG_CONTENT",
      "OPENCORVUS_DISABLE_PROJECT_CONFIG",
      "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
    ]) delete acceptanceEnv[key]
    Object.assign(acceptanceEnv, {
      OPENCORVUS_HOME: path.join(home, "opencorvus"),
      HOME: home,
      USERPROFILE: home,
      APPDATA: path.join(home, "AppData", "Roaming"),
      LOCALAPPDATA: path.join(home, "AppData", "Local"),
      XDG_CONFIG_HOME: path.join(home, ".config"),
      XDG_CACHE_HOME: path.join(home, ".cache"),
      XDG_DATA_HOME: path.join(home, ".local", "share"),
      OPENCORVUS_TEST_MANAGED_CONFIG_DIR: managedConfig,
      OPENCORVUS_INTERNAL_WORK_ARTIFACT_ACCEPTANCE: "1",
    })
    const result = await execFileAsync(executable, ["debug", "work-artifact-lifecycle"], {
      cwd: workspace,
      env: acceptanceEnv,
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    const line = result.stdout.split(/\r?\n/).find((candidate) => candidate.startsWith("OPENCORVUS_WORK_ARTIFACT_ACCEPTANCE="))
    if (!line) throw new Error(`Packaged OpenCorvus omitted Work Artifact acceptance evidence: ${result.stdout}`)
    const evidence = JSON.parse(line.slice("OPENCORVUS_WORK_ARTIFACT_ACCEPTANCE=".length)) as Record<string, unknown>
    if (evidence.source_sha !== evidence.delivered_sha || evidence.display !== "interactive-artifact") {
      throw new Error(`Packaged OpenCorvus returned inconsistent Work Artifact evidence: ${JSON.stringify(evidence)}`)
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })
  }
  return ["compiled_opencorvus_typed_lifecycle", "canonical_validation_receipt", "fresh_delivery_revalidation"] as const
}

async function checkSourceTypedLifecycle(packageRoot: string) {
  await execFileAsync(
    process.execPath,
    ["test", "test/work-artifact/packaged-lifecycle.test.ts", "--timeout", "180000"],
    {
      cwd: path.resolve(import.meta.dir, ".."),
      env: { ...process.env, OPENCORVUS_WORK_ARTIFACT_PACKAGE_ROOT: packageRoot },
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  )
  return ["canonical_validation_receipt", "fresh_delivery_revalidation"] as const
}

const rawProfile = flag("--profile")
if (rawProfile !== "office.presentation@1") {
  throw new Error("Usage: check-work-artifact-profile.ts --profile office.presentation@1 [--package-root DIR | --host-runtime-smoke] [--pptx FILE]")
}
const catalog = await checkCatalog(rawProfile)
const packageRoot = flag("--package-root")
const pptx = flag("--pptx")
if (!packageRoot && pptx) throw new Error("--pptx requires --package-root")
const hostRuntimeSmoke = process.argv.includes("--host-runtime-smoke")
let packaged
if (hostRuntimeSmoke) {
  if (packageRoot) throw new Error("--host-runtime-smoke cannot be combined with --package-root")
  const target = { os: process.platform as "darwin" | "linux" | "win32", arch: process.arch as "arm64" | "x64" }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-work-artifact-host-package-"))
  try {
    await copyOfficeCliRuntime({ target, outdir: root })
    await writeWorkArtifactTargetPackageManifest({ root, target, lock: WORK_ARTIFACT_RUNTIME_LOCK, phase: "final" })
    const lifecycle = await checkPackagedLifecycle(root, pptx ? path.resolve(pptx) : undefined)
    packaged = { ...lifecycle, evidence: await checkSourceTypedLifecycle(root) }
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
} else if (packageRoot) {
  packaged = await checkPackagedLifecycle(path.resolve(packageRoot), pptx ? path.resolve(pptx) : undefined)
  const typedEvidence = await checkPackagedTypedLifecycle(path.resolve(packageRoot))
  packaged = { ...packaged, evidence: typedEvidence }
}
console.log(JSON.stringify({ catalog, packaged }, undefined, 2))
