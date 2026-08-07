/**
 * BuildAgent runs an internal projected worker through a streaming SessionPrompt
 * with the worker's resolved tools, skills, model, and prompt overlays.
 *
 * Invocation:
 *   1. The Orchestrator dispatches one projected worker through an exact,
 *      immutable dispatch-lineage edge and child Session.
 *   2. Worktree.create under `<primary>/.opencorvus/.r/`. Ownership
 *      marker is written via Ownership.Worktree.record so OS-level restart
 *      cleanup can reclaim it.
 *   3. SessionPrompt.prompt runs the projected worker in a child session.
 *      The final assistant message remains visible narrative; durable facts
 *      are discovered independently through the Task Artifact Catalog.
 *   4. Managed-worktree lifetime is owned by the Task dispatch lineage. A
 *      failed physical dispatch can preserve the same directory so a later
 *      Task worker can continue from real files, commits, or MERGING state.
 *
 * BuildAgent owns no task-wide execution container. Every invocation is
 * anchored to the child Session for audit. Git, merge, diff, and command facts
 * are observed by the Host and returned independently of the agent's prose.
 */

import z from "zod"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import { Global } from "@/global"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { $ } from "bun"
import { hostGit as runGit, gitProcessArgs } from "@/util/git"
import { Process } from "@/util/process"
import { tool, type Tool as AITool, type ToolExecutionOptions, type ToolSet } from "ai"
import { Log } from "@/util/log"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { textSHA256 } from "@/expert-squad/projection-hash"
import { resolveAgentModel } from "@/agent/model"
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { sameProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { EffectiveConfig } from "@/config/effective"
import type { Config } from "@/config/config"
import { collectRuntimePathRefs } from "@/browser-preview/persist"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { SessionRuntimeContractStore, type SessionRuntimeContract } from "@/session/runtime-contract"
import { SessionStatus } from "@/session/status"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"
import { Worktree } from "@/worktree"
import { gitCeilingEnvForWorktree } from "@/worktree/git-ceiling"
import { Ownership } from "@/engine/ownership"
import { requireTask } from "@/engine/store"
import { recordTaskInfrastructureError, recordTaskLevelBuildHostObservation } from "@/engine/persist"
import { EngineConfig } from "@/engine/config"
import { Identifier } from "@/id/id"
import { Message } from "@/session/message"
import { BuildFileObservation, type BuildFileObservation as BuildFileObservationData } from "@/snapshot/types"
import { type BuildTarget } from "./types"
import { AttachmentStore } from "@/storage/attachment-store"
import { Database, eq } from "@/storage/db"
import { buildObservationRefName, deleteBuildObservationRefs } from "@/engine/build-observation-ref"
import { PartTable } from "@/session/session.sql"
import { renderUserRequestSection } from "@/intent/request-prompt"
import {
  artifactProvenanceFactHighWatermarkForSession,
  artifactProvenanceForSession,
} from "@/agent/artifact-read-facts"
import { abortableIterable, withStreamActivity } from "@/util/stream-activity"
import { PermissionNext } from "@/permission/next"
import { ToolRegistry } from "@/tool/registry"
import { SkillTool } from "@/tool/skill"
import {
  applyToolExecutionPolicy,
  createToolExecutionSurface,
  type ToolExecutionSurface,
} from "@/tool/execution-surface"
import { SkillMount } from "@/skill/mounts"
import { withTaskToolInvocation } from "@/tool/task-tool-invocation"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import type { EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { Tool } from "@/tool/tool"
import { Plugin } from "@/plugin"
import { InstructionPrompt } from "@/session/instruction"
import { renderBuildPromptOverlays } from "./prompt-context"

const log = Log.create({ service: "build-agent" })

function isFilePartData(
  value: unknown,
): value is Omit<Message.FilePart, "id" | "sessionID" | "messageID" | "orderKey"> {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.type === "file" && typeof record.url === "string" && typeof record.mime === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isCompletedToolPartData(value: unknown): value is Record<string, unknown> & {
  state: Record<string, unknown> & { status: "completed" }
} {
  if (!isRecord(value)) return false
  if (value.type !== "tool") return false
  const state = value.state
  return isRecord(state) && state.status === "completed"
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code
}

async function pathExists(absPath: string): Promise<boolean> {
  try {
    await fs.stat(absPath)
    return true
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) return false
    throw error
  }
}

async function fileSha256(absPath: string): Promise<string> {
  const bytes = await fs.readFile(absPath)
  return createHash("sha256").update(bytes).digest("hex")
}

function shaFromStoredAttachmentName(name: string): string | undefined {
  const stem = path.basename(name, path.extname(name))
  return /^[0-9a-f]{64}$/i.test(stem) ? stem.toLowerCase() : undefined
}

function contentAddressedStagedFilename(filename: string, sha: string): string {
  const ext = path.extname(filename)
  const stem = filename.slice(0, filename.length - ext.length)
  return `${stem}-${sha.slice(0, 8)}${ext}`
}

function repairCandidateFilenames(input: {
  storedName: string
  filename?: string
  mime: string
  sha?: string
}): string[] {
  const candidates: string[] = []
  const push = (name: string | undefined) => {
    if (!name) return
    const base = path.basename(name)
    if (!base || base === "." || base === "..") return
    if (!candidates.includes(base)) candidates.push(base)
  }
  push(input.filename)
  push(
    AttachmentStore.displayFilename({
      filename: input.filename,
      mime: input.mime,
      sha: input.sha,
      index: 0,
    }),
  )
  push(input.storedName)
  return candidates
}

function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function parseStructuredToolOutputForPathRefs(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined
  return JSON.parse(trimmed)
}

function collectToolArtifactPathCandidates(state: Record<string, unknown>): string[] {
  const candidates: string[] = []
  const pushAll = (refs: readonly string[]) => {
    for (const ref of refs) {
      if (!candidates.includes(ref)) candidates.push(ref)
    }
  }
  pushAll(collectRuntimePathRefs(state.metadata))
  pushAll(collectRuntimePathRefs(parseStructuredToolOutputForPathRefs(state.output)))
  return candidates
}

function resolveReplayArtifactCandidate(input: {
  projectRoot: string
  worktreeDir: string
  candidate: string
}): string | undefined {
  const raw = input.candidate.trim()
  if (!raw) return undefined
  const candidate = raw.startsWith("file://") ? fileURLToPath(raw) : raw
  const projectRoot = path.resolve(input.projectRoot)
  const worktreeDir = path.resolve(input.worktreeDir)
  const withinRoot = (root: string, abs: string) => abs === root || abs.startsWith(root + path.sep)
  if (path.isAbsolute(candidate)) {
    const abs = path.resolve(candidate)
    if (withinRoot(projectRoot, abs) || withinRoot(worktreeDir, abs)) return abs
    throw new Error(`managed build retry artifact path is outside project/worktree roots: ${input.candidate}`)
  }
  const normalized = candidate.replaceAll("\\", "/")
  if (normalized === ".opencorvus" || normalized.startsWith(".opencorvus/")) {
    const abs = path.resolve(projectRoot, ...normalized.split("/"))
    if (!withinRoot(projectRoot, abs)) {
      throw new Error(`managed build retry artifact path escapes project root: ${input.candidate}`)
    }
    return abs
  }
  const abs = path.resolve(worktreeDir, ...normalized.split("/"))
  if (!withinRoot(worktreeDir, abs)) {
    throw new Error(`managed build retry artifact path escapes build worktree: ${input.candidate}`)
  }
  return abs
}

async function resolveManagedRetryArtifactReference(input: {
  projectRoot: string
  worktreeDir: string
  storedName: string
  sha: string
  artifactCandidates: readonly string[]
}): Promise<string> {
  const tried: string[] = []
  for (const candidate of input.artifactCandidates) {
    const abs = resolveReplayArtifactCandidate({
      projectRoot: input.projectRoot,
      worktreeDir: input.worktreeDir,
      candidate,
    })
    if (!abs) continue
    tried.push(abs)
    if (!(await pathExists(abs))) continue
    if ((await fileSha256(abs)) !== input.sha) continue
    return abs
  }
  throw new Error(
    "managed build retry cannot repair persisted tool-result attachment: no persisted artifact path matched " +
      `${input.storedName}; tried ${tried.join(", ") || "<none>"}`,
  )
}

async function resolveManagedRetryStagedReference(input: {
  worktreeDir: string
  storedName: string
  filename?: string
  mime: string
  sha?: string
}): Promise<string> {
  const refsDir = path.join(input.worktreeDir, AttachmentStore.STAGED_REFERENCES_SUBDIR)
  const tried: string[] = []
  for (const filename of repairCandidateFilenames(input)) {
    const stagedNames = [filename]
    if (input.sha) stagedNames.push(contentAddressedStagedFilename(filename, input.sha))
    for (const stagedName of stagedNames) {
      const candidate = path.join(refsDir, stagedName)
      tried.push(path.relative(input.worktreeDir, candidate))
      if (!(await pathExists(candidate))) continue
      if (input.sha && (await fileSha256(candidate)) !== input.sha) continue
      return candidate
    }
  }
  throw new Error(
    "managed build retry cannot repair persisted file part: no staged reference matched " +
      `${input.storedName} in ${refsDir}; tried ${tried.join(", ") || "<none>"}`,
  )
}

export async function repairManagedBuildSessionStagedFileParts(input: {
  sessionID: string
  projectID: string
  worktreeDir: string
}): Promise<{ checked: number; repaired: number }> {
  const project = Project.get(input.projectID)
  if (!project) throw new Error(`managed build retry cannot repair attachments: project ${input.projectID} not found`)
  const rows = Database.use((db) =>
    db
      .select({
        id: PartTable.id,
        data: PartTable.data,
      })
      .from(PartTable)
      .where(eq(PartTable.session_id, input.sessionID))
      .all(),
  )
  let checked = 0
  let repaired = 0
  const repairAttachment = async (args: {
    rowID: string
    label: string
    attachment: { url: string; mime: string; filename?: string }
    artifactCandidates?: () => readonly string[]
    stagedReference: boolean
  }): Promise<{ attachment: { url: string; mime: string; filename?: string }; repaired: boolean }> => {
    const located = AttachmentStore.nameFromUrl(args.attachment.url)
    if (!located) return { attachment: args.attachment, repaired: false }
    checked++
    if (located.projectID !== input.projectID) {
      throw new Error(
        `managed build retry cannot repair ${args.label} ${args.rowID}: attachment belongs to project ` +
          `${located.projectID}, expected ${input.projectID}`,
      )
    }
    const canonicalAbs = AttachmentStore.resolveAbsolute(located.projectID, located.name)
    if (!canonicalAbs) {
      throw new Error(
        `managed build retry cannot repair ${args.label} ${args.rowID}: attachment ` +
          `${located.projectID}/${located.name} is not resolvable`,
      )
    }
    if (await pathExists(canonicalAbs)) return { attachment: args.attachment, repaired: false }

    const expectedSha = shaFromStoredAttachmentName(located.name)
    if (!expectedSha) {
      throw new Error(
        `managed build retry cannot repair ${args.label} ${args.rowID}: attachment name ${located.name} has no sha`,
      )
    }
    const sourceAbs = args.stagedReference
      ? await resolveManagedRetryStagedReference({
          worktreeDir: input.worktreeDir,
          storedName: located.name,
          filename: args.attachment.filename,
          mime: args.attachment.mime,
          sha: expectedSha,
        })
      : await resolveManagedRetryArtifactReference({
          projectRoot: project.worktree,
          worktreeDir: input.worktreeDir,
          storedName: located.name,
          sha: expectedSha,
          artifactCandidates: args.artifactCandidates?.() ?? [],
        })
    const reference = await AttachmentStore.writeFromPath(
      input.projectID,
      sourceAbs,
      args.attachment.mime,
      args.attachment.filename ?? path.basename(sourceAbs),
    )
    if (reference.sha !== expectedSha) {
      throw new Error(
        `managed build retry repaired ${args.label} ${args.rowID} from ${sourceAbs} but sha changed: ` +
          `${reference.sha}, expected ${expectedSha}`,
      )
    }
    return {
      attachment: {
        ...args.attachment,
        url: reference.url,
        mime: reference.mime,
        filename: args.attachment.filename ?? reference.filename,
      },
      repaired: true,
    }
  }

  for (const row of rows) {
    if (isFilePartData(row.data)) {
      const result = await repairAttachment({
        rowID: row.id,
        label: "persisted file part",
        attachment: row.data,
        stagedReference: true,
      })
      if (!result.repaired) continue
      const nextData = {
        ...row.data,
        url: result.attachment.url,
        mime: result.attachment.mime,
        filename: result.attachment.filename,
      }
      await Session.updatePartData({ partID: row.id, data: nextData })
      repaired++
      continue
    }

    if (!isCompletedToolPartData(row.data)) continue
    const nextData = cloneJsonObject(row.data)
    const state = nextData.state
    const artifactCandidates = () => collectToolArtifactPathCandidates(state)
    let rowRepaired = false
    if (Array.isArray(state.attachments)) {
      const attachments: unknown[] = []
      for (const item of state.attachments) {
        if (!isRecord(item) || typeof item.url !== "string" || typeof item.mime !== "string") {
          attachments.push(item)
          continue
        }
        const result = await repairAttachment({
          rowID: row.id,
          label: "tool-result attachment",
          attachment: {
            url: item.url,
            mime: item.mime,
            filename: typeof item.filename === "string" ? item.filename : undefined,
          },
          artifactCandidates,
          stagedReference: false,
        })
        attachments.push({ ...item, ...result.attachment })
        if (result.repaired) {
          rowRepaired = true
          repaired++
        }
      }
      state.attachments = attachments
    }

    const metadata = state.metadata
    const browser = isRecord(metadata) && isRecord(metadata.browser) ? metadata.browser : undefined
    const screenshot = isRecord(browser?.screenshot) ? browser.screenshot : undefined
    if (screenshot && typeof screenshot.attachmentUrl === "string") {
      const located = AttachmentStore.nameFromUrl(screenshot.attachmentUrl)
      const metadataAttachment = {
        url: screenshot.attachmentUrl,
        mime: typeof screenshot.mimeType === "string" ? screenshot.mimeType : "image/png",
        filename: located?.name,
      }
      const result = await repairAttachment({
        rowID: row.id,
        label: "browser screenshot metadata",
        attachment: metadataAttachment,
        artifactCandidates,
        stagedReference: false,
      })
      if (result.repaired) {
        screenshot.attachmentUrl = result.attachment.url
        const repairedLocated = AttachmentStore.nameFromUrl(result.attachment.url)
        const repairedSha = repairedLocated ? shaFromStoredAttachmentName(repairedLocated.name) : undefined
        if (repairedSha) screenshot.sha = repairedSha
        rowRepaired = true
        repaired++
      }
    }

    if (rowRepaired) {
      await Session.updatePartData({ partID: row.id, data: nextData })
    }
  }
  return { checked, repaired }
}

export function createMergeBackSingleFlight<T extends { status: string }>(execute: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined
  let merged: T | undefined
  return async () => {
    if (merged) return merged
    if (inFlight) return await inFlight
    inFlight = execute()
    try {
      const result = await inFlight
      if (result.status === "merged") merged = result
      return result
    } finally {
      if (!merged) inFlight = undefined
    }
  }
}

export function currentProjectCommitPublication(input: { baselineHead?: string; terminalHead?: string }): {
  contributionCommitRef?: string
  publishedCommitRef?: string
} {
  const baselineHead = input.baselineHead?.trim()
  const terminalHead = input.terminalHead?.trim()
  if (!baselineHead || !terminalHead || baselineHead === terminalHead) return {}
  return {
    contributionCommitRef: terminalHead,
    publishedCommitRef: terminalHead,
  }
}

export namespace BuildAgent {
  /** Call-local non-semantic prompt framing. Durable evidence is discovered
   * and read by the Build consumer through the Artifact Catalog. */
  export interface PromptProjectionSource {
    /** Current operator guidance and catalog-discovery instructions only. */
    contextSections?: string[]
    /** Primary project worktree directory. Build prompts use it to point
     *  worktree executors at canonical task runtime evidence without copying
     *  `.opencorvus/.r` into the managed worktree. */
    projectDir?: string
  }

  export interface RunInput {
    /** Exact durable Task identity. The Agent resolves the Task from the
     * producer store instead of receiving a copied row. */
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    /** One transient visible message plus exact canonical attachment refs.
     * No domain payload, Host observation, source/scope snapshot, or prompt
     * lifecycle aggregate crosses this boundary. */
    message: {
      text: string
      attachmentRefs: string[]
    }
    /** Parent session the child build session attaches under. Typically
     *  the orchestrator's own child session so overlay nesting stays
     *  intuitive. Optional: when absent the build session is top-level. */
    parentSessionID?: string
    /** Existing build session to continue for retry attempts. When set,
     *  BuildAgent appends the new user message to this session and replaces
     *  its runtime contract instead of creating a new build session. */
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    /** Explicit model override (provider / model). Skips `resolveAgentModel`. */
    model?: { providerID: string; modelID: string }
    /** False disables Model Context Protocol tools for bounded research-only callers. */
    includeMcpTools?: boolean
    /** True exposes only BuildAgent runtime tools for bounded special-purpose callers. */
    exactRuntimeTools?: boolean
    /** Additional per-run tool switches merged after the build defaults. */
    toolSwitches?: Record<string, boolean>
    signal?: AbortSignal
    /** Fires after the child build session exists, before model work starts. */
    onSessionCreated?: (
      sessionID: string,
      context: { worktreeDir?: string; worktreeBranch?: string; worktreeBaseRef?: string },
    ) => void | Promise<void>
    /** Publishes descriptor-backed logical dispatch authority atomically with
     * the first exact Turn descriptor. */
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    /** Fires once after this Build dispatch's first exact projected descriptor
     *  and runtime contract are installed, before model work starts. Internal
     *  continuation turns on the same session do not report another start. */
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
    /** Optional caller-owned working directory. When provided, the build agent
     *  uses it as-is, does not expose merge_back, and does not manage its
     *  lifecycle. When absent the agent creates a managed worktree under
     *  `<primary>/.opencorvus/.r/`. */
    workDir?: string
    /** Task-owned managed worktree. Unlike workDir, this still participates in
     *  the build agent's merge_back protocol; the orchestrator owns lifetime,
     *  while BuildAgent owns publication. */
    managedWorktree?: {
      directory: string
      branch: string
      baseRef?: string | null
    }
  }

  export interface RunOutput {
    /** The child build session and its visible final assistant message. */
    sessionID: string
    finalMessageID: string
    /** Exact Host infrastructure errors that prevented complete terminal-fact
     *  persistence. Ordinary successful domain facts are Catalog-discovered
     *  and never copied into the dispatch result. */
    infrastructureObservationLocators?: EngineArtifactLocator[]
  }

  /**
   * Run the build agent against a target. Normal stream termination returns
   * the physical session facts and stable Host-observation references.
   * Business acceptance is intentionally left to the Orchestrator.
   */
  export async function run(input: RunInput): Promise<RunOutput | AgentCoordinationHandoffResult> {
    const task = requireTask(input.taskID)
    {
      // ── Worktree acquisition ─────────────────────────────────────────────
      // Happens OUTSIDE runAgentSession because the worktree is the
      // session's working directory — the runner needs it resolved before
      // it calls Session.createNext. `workDir` means a caller-owned directory
      // that opts out of merge_back. `managedWorktree` is Task-owned state
      // supplied by the orchestrator and still uses merge_back.
      if (input.workDir && input.managedWorktree) {
        throw new Error("BuildAgent.run: workDir and managedWorktree are mutually exclusive")
      }
      if (!input.existingSessionID && Instance.project.id !== task.project_id) {
        throw new Error(
          `BuildAgent.run: active project ${Instance.project.id} does not match task project ${task.project_id}; ` +
            "fresh build dispatch must enter the task project before evidence materialization",
        )
      }
      const ownsWorktree = !input.workDir
      let worktreeDir = input.managedWorktree?.directory ?? input.workDir
      let worktreeBranch: string | undefined
      const buildSessionID = input.existingSessionID ?? Identifier.descending("session")
      // Worktree HEAD commit at creation time. Equals primary HEAD because
      // Worktree.create branches off it; we capture the SHA so post-build
      // diff extraction can compute baseRef..HEAD inside the worktree
      // without depending on git merge-base (which fails after merge-back
      // when ff-only collapses both refs to the same tip).
      let baseRef: string | undefined
      if (input.managedWorktree) {
        const managedDir = input.managedWorktree.directory
        worktreeDir = managedDir
        worktreeBranch = input.managedWorktree.branch
        await Ownership.Worktree.record({
          primaryWorktreeDir: Instance.worktree,
          worktreeDir: managedDir,
          taskID: task.id,
          sessionID: buildSessionID,
        })
        baseRef = input.managedWorktree.baseRef ?? undefined
        if (!baseRef) {
          baseRef = await resolveRequiredGitHead(managedDir)
        }
      } else if (ownsWorktree) {
        const targetLabel = task.id.slice(-12)
        // `reuseIfValid: true` lets a re-attempted build pick up a preserved
        // worktree when the prior session wrote commits but never completed
        // the merge_back contract. Invalid trees are reclaimed by
        // Worktree.create before a fresh tree is created, so corrupt git
        // state is never reused silently.
        const info = await Worktree.create({
          name: `build-${targetLabel}`,
          reuseIfValid: true,
          taskID: task.id,
          sessionID: buildSessionID,
        })
        worktreeDir = info.directory
        worktreeBranch = info.branch
        await Ownership.Worktree.record({
          primaryWorktreeDir: Instance.worktree,
          worktreeDir,
          taskID: task.id,
          sessionID: buildSessionID,
        })
        baseRef = await resolveRequiredGitHead(worktreeDir)
      }

      if (!worktreeDir) {
        throw new Error("BuildAgent.run: worktree directory was not resolved")
      }

      const existingBuildSession = input.existingSessionID ? await Session.get(input.existingSessionID) : undefined
      if (existingBuildSession && existingBuildSession.kind !== "build") {
        throw new Error(
          `BuildAgent.run: existing session ${existingBuildSession.id} has kind=${existingBuildSession.kind}, expected build`,
        )
      }
      if (existingBuildSession && existingBuildSession.projectID !== task.project_id) {
        throw new Error(
          `BuildAgent.run: existing session ${existingBuildSession.id} belongs to project ${existingBuildSession.projectID}, ` +
            `expected task project ${task.project_id}`,
        )
      }
      if (existingBuildSession && existingBuildSession.directory !== worktreeDir) {
        throw new Error(
          `BuildAgent.run: existing session ${existingBuildSession.id} has directory=${existingBuildSession.directory}, expected ${worktreeDir}`,
        )
      }
      const retryingExistingBuildSession = Boolean(input.existingSessionID)

      const buildPromptText = () => input.message.text
      const attachmentRefs = input.message.attachmentRefs.filter(
        (ref, index, all) => ref.trim().length > 0 && all.indexOf(ref) === index,
      )

      // Resolve exact canonical attachment refs at the physical consumer, then
      // stage them into `<worktree>/references/`
      // so the build agent can pass worktree-local relative paths to tools
      // whose sandbox checks reject paths outside the worktree. For managed
      // worktrees, the staged file is also the provider-bound byte source:
      // SessionPrompt materializes these file:// parts back through
      // AttachmentStore.writeFromPath, so Build no longer reads the original
      // content-addressed blob a second time after staging.
      let stagedAttachments: AttachmentStore.StagedAttachment[] = []
      const evidenceStagingObservations: string[] = []
      if (worktreeDir && attachmentRefs.length > 0) {
        for (const attachmentRef of attachmentRefs) {
          try {
            const located = AttachmentStore.nameFromUrl(attachmentRef)
            if (!located) throw new Error(`attachment ref is not canonical: ${attachmentRef}`)
            if (located.projectID !== task.project_id) {
              throw new Error(
                `attachment ${attachmentRef} belongs to project ${located.projectID}, expected ${task.project_id}`,
              )
            }
            const reference = await AttachmentStore.readReference(located.projectID, located.name)
            stagedAttachments.push(
              ...(await AttachmentStore.stageToWorktree(task.project_id, [reference], worktreeDir)),
            )
          } catch (err) {
            evidenceStagingObservations.push(
              `- attachment_ref=${attachmentRef}; staging_error=${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
        if (stagedAttachments.length > 0) {
          log.info("build agent: staged evidence into worktree references/", {
            taskID: task.id,
            count: stagedAttachments.length,
            worktreeDir,
          })
        }
        if (evidenceStagingObservations.length > 0) {
          log.warn("build agent: some evidence attachments could not be staged", {
            taskID: task.id,
            failures: evidenceStagingObservations.length,
            worktreeDir,
          })
        }
      }
      if (retryingExistingBuildSession && ownsWorktree && worktreeDir) {
        try {
          const repaired = await repairManagedBuildSessionStagedFileParts({
            sessionID: buildSessionID,
            projectID: task.project_id,
            worktreeDir,
          })
          if (repaired.repaired > 0) {
            log.info("build agent: repaired staged reference file parts for retry replay", {
              taskID: task.id,
              sessionID: buildSessionID,
              repaired: repaired.repaired,
              checked: repaired.checked,
              worktreeDir,
            })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          evidenceStagingObservations.push(`- retry_attachment_repair_error=${message}`)
          log.warn("build agent: retry attachment repair produced a visible staging observation", {
            taskID: task.id,
            sessionID: buildSessionID,
            worktreeDir,
            error: message,
          })
        }
      }
      const buildUserPartsFn =
        attachmentRefs.length > 0 || evidenceStagingObservations.length > 0
          ? async () => {
              const enrichedText =
                buildPromptText() +
                AttachmentStore.renderStagedList(stagedAttachments) +
                (evidenceStagingObservations.length > 0
                  ? `\n\n## Evidence staging observations\n${evidenceStagingObservations.join("\n")}\n`
                  : "")
              return [{ type: "text" as const, text: enrichedText }]
            }
          : undefined
      // Tracks the Host-observed primary HEAD returned by merge_back so it can
      // be attached to the single Build Host observation after the Turn.
      let mergedHead: string | undefined
      const executeMergeBack = createMergeBackSingleFlight(async () => {
        const outcome = await Worktree.mergeSafely({
          branch: worktreeBranch!,
          worktreeDir: worktreeDir!,
        })
        if (outcome.status === "merged") {
          mergedHead = outcome.primaryHead
          return {
            status: "merged" as const,
            primary_head: outcome.primaryHead,
            primary_branch: outcome.primaryBranch,
            ...(outcome.primaryRecoveryCommit ? { primary_recovery_commit: outcome.primaryRecoveryCommit } : {}),
          }
        }
        if (outcome.status === "conflict") {
          return {
            status: "conflict" as const,
            primary_branch: outcome.primaryBranch,
            primary_tip: outcome.primaryTip,
            conflict_paths: outcome.conflictPaths,
            hint:
              "Worktree is in MERGING state with conflict markers in " +
              "the listed paths. Edit each path to resolve the markers, " +
              "git add <path>, then `git commit` to finalize the merge. " +
              "Then call merge_back again to ff-publish into " +
              outcome.primaryBranch +
              ".",
          }
        }
        if (outcome.status === "blocked") {
          return {
            status: "blocked" as const,
            reason: outcome.reason,
            branch: outcome.branch,
            worktree_dir: outcome.worktreeDir,
            ...(outcome.dirtyPaths ? { dirty_paths: outcome.dirtyPaths } : {}),
            ...(outcome.mergeHead ? { merge_head: true } : {}),
          }
        }
        return {
          status: "infra_error" as const,
          reason: outcome.reason,
          branch: outcome.branch,
          ...(outcome.stderr ? { stderr: outcome.stderr } : {}),
        }
      })

      type BuildCollector = Record<string, never>
      const buildCollector: BuildCollector = {}
      const buildToolKit: {
        tools: ToolSet
        stageOwnedToolIDs: readonly string[]
        getCollector: () => BuildCollector
      } =
        ownsWorktree && worktreeBranch && worktreeDir
          ? (() => {
              const stageTools = {
                merge_back: tool({
                  description:
                    "Publish this Task execution Session's commits onto the project's primary " +
                    "worktree branch. Runs `git merge <primary>` inside this " +
                    "worktree, then `git merge --ff-only` on the primary worktree, " +
                    "atomically under a host-side lock so concurrent Task Sessions do not " +
                    "race each other.\n\n" +
                    "Call this after you have committed all changes and verification passed. It is the last git-affecting action of the session. " +
                    "After the tool result, summarize implementation semantics, limitations, and blockers in the final visible assistant message.\n\n" +
                    "Returns one of:\n" +
                    "  • {status:'merged', primary_head, primary_branch} — published.\n" +
                    "  • {status:'conflict', primary_branch, primary_tip, " +
                    "    conflict_paths[]} — the merge hit textual conflicts. Your " +
                    "    worktree is now IN MERGING state: each path in conflict_paths " +
                    "    has `<<<<<<<`/`=======`/`>>>>>>>` markers in place. Edit each " +
                    "    path to remove the markers (keep both intentions where " +
                    "    possible; respect owned_paths), `git add <path>`, then once " +
                    "    all paths are resolved `git commit` — that finalizes the " +
                    "    merge. Call merge_back again to ff-publish into primary.\n" +
                    "  • {status:'blocked', reason, dirty_paths?, merge_head?} — repository state " +
                    "    prevents merge from starting; fix that exact state in this worktree.\n" +
                    "  • {status:'infra_error', reason} — infrastructure problem; explain it in the final message.",
                  inputSchema: z.object({}),
                  execute: executeMergeBack,
                }),
              }
              return {
                tools: stageTools,
                stageOwnedToolIDs: Object.keys(stageTools),
                getCollector: () => buildCollector,
              }
            })()
          : {
              tools: {},
              stageOwnedToolIDs: [],
              getCollector: () => buildCollector,
            }

      const artifactReadHighWatermark = artifactProvenanceFactHighWatermarkForSession(buildSessionID)
      const observationID = Identifier.ascending("artifact")
      let out:
        | {
            session: { id: string }
            finalMessage: Message.WithParts
          }
        | undefined
      let diffs: BuildFileObservationData[] | undefined
      let contributionRefs: ExecutionContributionRefs | undefined
      let observationDiffBaseRef: string | undefined
      let observationDiffHeadRef: string | undefined
      const observationErrors: string[] = []
      let callerOwnedBaselineSnapshot: string | undefined
      let callerOwnedBaselineHead: string | undefined
      if (!ownsWorktree) {
        try {
          callerOwnedBaselineSnapshot = await pinBuildObservationTree({
            worktreeDir: worktreeDir!,
            refName: buildObservationRefName(observationID, "base"),
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          observationErrors.push(`caller-owned baseline snapshot observation failed: ${message}`)
          log.warn("build agent: caller-owned baseline snapshot observation failed", {
            taskID: task.id,
            error: message,
          })
        }
        try {
          callerOwnedBaselineHead = (await resolveRequiredGitHead(worktreeDir!)).slice(0, 12)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          observationErrors.push(`caller-owned baseline HEAD observation failed: ${message}`)
          log.warn("build agent: caller-owned baseline HEAD observation failed", {
            taskID: task.id,
            error: message,
          })
        }
      }
      let callerOwnedTerminalSnapshot: string | undefined
      let runError: unknown
      const reportRuntimeReady = createBuildRuntimeReadyObserver(input.onRuntimeReady)
      const runOpenCorvusBuildSession = async () =>
        await runAgentSession({
          agentID: input.agentID,
          packageRevision: input.packageRevision,
          sessionTitle: buildSessionTitle(input.agentID, task.title),
          sessionDirectory: worktreeDir!,
          existingSessionID: input.existingSessionID,
          continuationPrompt: input.continuationPrompt,
          dispatchTurn: input.dispatchTurn,
          newSessionID: input.existingSessionID ? undefined : buildSessionID,
          parentSessionID: input.parentSessionID,
          taskID: task.id,
          workScope: input.workScope,
          model: input.model,
          signal: input.signal,
          byteMaterializationProjectID: task.project_id,
          toolKit: buildToolKit,
          buildUserPrompt: buildPromptText,
          buildUserParts: buildUserPartsFn,
          runtimeContract: {
            includeMcpTools: input.includeMcpTools,
            exactTools: input.exactRuntimeTools,
          },
          toolSwitches: input.toolSwitches,
          onSessionCreated: input.existingSessionID
            ? undefined
            : async (session) => {
                await input.onSessionCreated?.(session.id, {
                  worktreeDir,
                  worktreeBranch,
                  worktreeBaseRef: baseRef,
                })
              },
          onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
            ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
            : undefined,
          onRuntimeReady: async (session) => {
            await reportRuntimeReady(session.id)
          },
        })
      try {
        out = await runOpenCorvusBuildSession()
      } catch (error) {
        runError = error
      } finally {
        // Managed worktrees always preserve until the orchestrator cleans
        // them up (rule 22 — orchestrator owns cleanup; build agent does
        // not unilaterally delete). The earlier preserveWorktreeForRetry
        // boolean gated by mergedHead/mergeBackBlockedReport was a
        // host-side state machine; deleted in favour of "always preserve
        // when the worktree is Task-managed".
        if (ownsWorktree && worktreeDir) {
          log.info("build agent: preserving worktree — orchestrator owns cleanup", {
            taskID: task.id,
            worktreeDir,
            worktreeBranch,
            mergedHead: mergedHead ? mergedHead.slice(0, 12) : null,
          })
        }
      }

      if (worktreeDir) {
        try {
          callerOwnedTerminalSnapshot = await pinBuildObservationTree({
            worktreeDir,
            refName: buildObservationRefName(observationID, "head"),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          observationErrors.push(`terminal Build observation failed: ${message}`)
          log.warn("build agent: terminal Build observation failed", {
            taskID: task.id,
            error: message,
          })
        }
      }

      if (ownsWorktree && worktreeDir && baseRef && callerOwnedTerminalSnapshot) {
        try {
          contributionRefs = await resolveExecutionContributionRefs(worktreeDir, baseRef)
          diffs = await collectExecutionDiffs(
            worktreeDir,
            contributionRefs.diffBaseRef,
            callerOwnedTerminalSnapshot,
          )
          observationDiffBaseRef = contributionRefs.diffBaseRef
          observationDiffHeadRef = callerOwnedTerminalSnapshot
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          observationErrors.push(`contribution diff observation failed: ${message}`)
          log.warn("build agent: contribution diagnostics failed", {
            taskID: task.id,
            error: message,
          })
        }
      } else if (callerOwnedBaselineSnapshot && callerOwnedTerminalSnapshot) {
        try {
          diffs = await collectExecutionDiffs(
            worktreeDir!,
            callerOwnedBaselineSnapshot,
            callerOwnedTerminalSnapshot,
          )
          observationDiffBaseRef = callerOwnedBaselineSnapshot
          observationDiffHeadRef = callerOwnedTerminalSnapshot
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          observationErrors.push(`caller-owned snapshot diff observation failed: ${message}`)
          log.warn("build agent: caller-owned snapshot diagnostics failed", {
            taskID: task.id,
            error: message,
          })
        }
      }

      let worktreeHead: string | undefined
      if (worktreeDir) {
        try {
          worktreeHead = (await resolveRequiredGitHead(worktreeDir)).slice(0, 12)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          observationErrors.push(`worktree HEAD observation failed: ${message}`)
          log.warn("build agent: HEAD diagnostic failed", {
            taskID: task.id,
            error: message,
          })
        }
      }
      const callerOwnedPublication = !ownsWorktree
        ? currentProjectCommitPublication({
            baselineHead: callerOwnedBaselineHead,
            terminalHead: worktreeHead,
          })
        : {}

      const sessionID = out?.session.id ?? buildSessionID
      const finalMessageID = out?.finalMessage.info.id
      const infrastructureObservationLocators: EngineArtifactLocator[] = []
      const recordInfrastructureFailure = (operation: string, reason: string, errorName?: string) => {
        try {
          const artifactID = recordTaskInfrastructureError({
            taskID: task.id,
            component: "build-host-observation",
            operation,
            reason,
            errorName,
            sessionID,
            now: Date.now(),
          })
          infrastructureObservationLocators.push(exactEngineArtifactLocator({ taskID: task.id, artifactID }))
        } catch (error) {
          log.error("build agent: infrastructure observation persistence failed", {
            taskID: task.id,
            sessionID,
            operation,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      for (const error of observationErrors) recordInfrastructureFailure("collect-git-workspace", error)

      try {
        const provenance = artifactProvenanceForSession(
          sessionID,
          artifactReadHighWatermark ? { after: artifactReadHighWatermark } : undefined,
        )
        recordTaskLevelBuildHostObservation({
          id: observationID,
          taskID: task.id,
          sessionID,
          finalMessageID,
          contributionCommitRef: ownsWorktree ? worktreeHead : callerOwnedPublication.contributionCommitRef,
          publishedCommitRef: ownsWorktree ? mergedHead?.slice(0, 12) : callerOwnedPublication.publishedCommitRef,
          executionMode: ownsWorktree ? "managed_worktree" : "current_project",
          primaryBaseCommitRef: callerOwnedBaselineHead,
          primaryTerminalCommitRef: !ownsWorktree ? worktreeHead : mergedHead?.slice(0, 12),
          diffBaseRef: observationDiffBaseRef,
          diffHeadRef: observationDiffHeadRef,
          diffs,
          observedArtifactLocators: provenance.observedArtifactLocators,
          sourceArtifactLocators: provenance.sourceArtifactLocators,
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        log.error("build agent: Host observation persistence failed", {
          taskID: task.id,
          sessionID,
          error: reason,
        })
        recordInfrastructureFailure("persist-git-workspace", reason, error instanceof Error ? error.name : undefined)
        if (worktreeDir) {
          try {
            await deleteBuildObservationRefs({ worktreeDir, observationIDs: [observationID] })
          } catch (cleanupError) {
            recordInfrastructureFailure(
              "cleanup-git-observation-refs",
              cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
              cleanupError instanceof Error ? cleanupError.name : undefined,
            )
          }
        }
      }

      if (runError) throw runError
      if (!out) throw new Error("Build Session ended without a physical Turn result")
      const coordinationHandoff = agentCoordinationHandoffResult(out)
      if (coordinationHandoff) return coordinationHandoff
      log.info("build agent finished", {
        taskID: task.id,
        sessionID,
        worktreeBranch,
        merged: Boolean(mergedHead),
      })
      return {
        sessionID,
        finalMessageID: out.finalMessage.info.id,
        infrastructureObservationLocators:
          infrastructureObservationLocators.length > 0 ? infrastructureObservationLocators : undefined,
      }
    }
  }
}

export function createBuildRuntimeReadyObserver(
  observer?: (sessionID: string) => void | Promise<void>,
): (sessionID: string) => Promise<void> {
  let runtimeReadySessionID: string | undefined
  return async (sessionID) => {
    if (runtimeReadySessionID) {
      if (runtimeReadySessionID !== sessionID) {
        throw new Error(
          `BuildAgent.run reported runtime-ready for multiple sessions: ${runtimeReadySessionID}, ${sessionID}`,
        )
      }
      return
    }
    runtimeReadySessionID = sessionID
    await observer?.(sessionID)
  }
}

// ---------------------------------------------------------------------------
// Diff collection
// ---------------------------------------------------------------------------

export interface ExecutionContributionRefs {
  contributionCommitRef: string
  diffBaseRef: string
  diffHeadRef: string
}

/**
 * Collect per-file diffs for one physical Build execution contribution.
 *
 * When merge_back reconciles a stale Task Session branch with an already-advanced
 * primary branch, git produces a merge commit whose second parent is the
 * primary tip that was merged in. Auditing `baseRef..HEAD` after that point
 * falsely attributes unrelated files to this Build Session. The correct
 * collaboration boundary is the contribution this execution adds on top of that
 * merged primary tip: `HEAD^2..HEAD` for merge commits produced by
 * Worktree.mergeSafely, and `baseRef..HEAD` when no integration merge was
 * needed.
 */
export async function collectBuildContributionDiffs(
  worktreeDir: string,
  baseRef: string,
): Promise<BuildFileObservationData[]> {
  const refs = await resolveExecutionContributionRefs(worktreeDir, baseRef)
  const observationID = Identifier.ascending("artifact")
  const terminalTree = await pinBuildObservationTree({
    worktreeDir,
    refName: buildObservationRefName(observationID, "head"),
  })
  try {
    return await collectExecutionDiffs(worktreeDir, refs.diffBaseRef, terminalTree)
  } finally {
    await deleteBuildObservationRefs({ worktreeDir, observationIDs: [observationID] })
  }
}

function requireExecutionContributionGitSuccess(
  result: { exitCode: number; stderr: Buffer },
  args: string[],
  worktreeDir: string,
): void {
  if (result.exitCode === 0) return
  const details = result.stderr.toString().trim()
  throw new Error(
    `git ${args.join(" ")} failed with exit code ${result.exitCode} in ${worktreeDir}${details ? `\n${details}` : ""}`,
  )
}

async function resolveRequiredGitHead(worktreeDir: string, env?: Record<string, string>): Promise<string> {
  const args = ["rev-parse", "--verify", "HEAD"]
  const result = await runGit(args, { cwd: worktreeDir, env, timeoutProfile: "fast" })
  requireExecutionContributionGitSuccess(result, args, worktreeDir)
  const head = result.text().trim()
  if (!head) throw new Error(`git ${args.join(" ")} returned empty output in ${worktreeDir}`)
  return head
}

export async function resolveExecutionContributionRefs(
  worktreeDir: string,
  baseRef: string,
): Promise<ExecutionContributionRefs> {
  const env = gitCeilingEnvForWorktree(worktreeDir)
  const diffHeadRef = await resolveRequiredGitHead(worktreeDir, env)
  const parentsArgs = ["show", "--no-patch", "--pretty=%P", "HEAD"]
  const parentsResult = await runGit(parentsArgs, {
    cwd: worktreeDir,
    env,
    timeoutProfile: "fast",
  })
  requireExecutionContributionGitSuccess(parentsResult, parentsArgs, worktreeDir)
  const parentsRaw = parentsResult.text().trim()
  const parents = parentsRaw.split(/\s+/).filter(Boolean)
  if (parents.length >= 2) {
    return {
      contributionCommitRef: parents[0]!,
      diffBaseRef: parents[1]!,
      diffHeadRef,
    }
  }
  return {
    contributionCommitRef: diffHeadRef,
    diffBaseRef: baseRef,
    diffHeadRef,
  }
}

export async function resolveExecutionContributionBaseRef(worktreeDir: string, baseRef: string): Promise<string> {
  return (await resolveExecutionContributionRefs(worktreeDir, baseRef)).diffBaseRef
}

/**
 * Pin the exact worktree tree in the repository object database without
 * touching the user's index or branch. The private ref keeps every observed
 * blob reachable for later exact-file reads.
 */
export async function pinBuildObservationTree(input: { worktreeDir: string; refName: string }): Promise<string> {
  const tempRoot = await Global.createTemporaryDirectory("build-observation-")
  const indexFile = path.join(tempRoot, "index")
  const env = {
    ...gitCeilingEnvForWorktree(input.worktreeDir),
    GIT_INDEX_FILE: indexFile,
  }
  try {
    for (const args of [
      ["read-tree", "HEAD"],
      ["add", "-A", "--", "."],
      [
        "rm",
        "-r",
        "--cached",
        "--quiet",
        "--ignore-unmatch",
        "--",
        ".opencorvus-meta.json",
        ".opencorvus/.r",
        ".opencorvus/runtime",
        ".opencorvus/worktrees",
        ".opencorvus-worktrees",
      ],
    ]) {
      const result = await runGit(args, {
        cwd: input.worktreeDir,
        env,
        timeoutProfile: "default",
      })
      requireExecutionContributionGitSuccess(result, args, input.worktreeDir)
    }
    const writeTreeArgs = ["write-tree"]
    const writeTree = await runGit(writeTreeArgs, {
      cwd: input.worktreeDir,
      env,
      timeoutProfile: "default",
    })
    requireExecutionContributionGitSuccess(writeTree, writeTreeArgs, input.worktreeDir)
    const tree = writeTree.text().trim()
    if (!/^[0-9a-f]{40,64}$/.test(tree)) {
      throw new Error(`git write-tree returned invalid object identity ${JSON.stringify(tree)} in ${input.worktreeDir}`)
    }
    const updateRefArgs = ["update-ref", input.refName, tree]
    const updateRef = await runGit(updateRefArgs, {
      cwd: input.worktreeDir,
      env: gitCeilingEnvForWorktree(input.worktreeDir),
      timeoutProfile: "fast",
    })
    requireExecutionContributionGitSuccess(updateRef, updateRefArgs, input.worktreeDir)
    return tree
  } finally {
    await fs.rm(tempRoot, { recursive: true })
  }
}

/**
 * Collect per-file diffs between the contribution base and the terminal execution
 * worktree.
 *
 * The terminal worktree, rather than only `HEAD`, is the observed delivery
 * surface. A worker can leave a tracked modification after its latest commit;
 * Review already sees that structured Tool/Patch row, so omitting it here
 * would leave the canonical full-body artifact incomplete. Untracked files are
 * part of the same isolated execution observation.
 *
 * Returns compact immutable Git object identities and statistics. The Build
 * Host observation never materializes file bodies; selected-file readers use
 * the exact object identities on demand.
 *
 * Filters out worktree scratch (`.opencorvus/`) so the panel doesn't list
 * worktree-internal files like ownership markers.
 */
async function collectExecutionDiffs(
  worktreeDir: string,
  baseRef: string,
  terminalRef: string,
): Promise<BuildFileObservationData[]> {
  const env = gitCeilingEnvForWorktree(worktreeDir)
  const rawArgs = [
    "-c",
    "core.quotepath=false",
    "diff",
    "--no-ext-diff",
    "--raw",
    "--no-abbrev",
    "--no-renames",
    baseRef,
    terminalRef,
    "--",
    ".",
  ]
  const rawResult = await runGit(rawArgs, { cwd: worktreeDir, env, timeoutProfile: "default" })
  requireExecutionContributionGitSuccess(rawResult, rawArgs, worktreeDir)
  const objects = new Map<
    string,
    {
      status: "added" | "deleted" | "modified"
      beforeOID: string | null
      afterOID: string | null
    }
  >()
  for (const line of rawResult.text().trim().split("\n")) {
    if (!line) continue
    const tab = line.indexOf("\t")
    if (tab < 0 || !line.startsWith(":")) {
      throw new Error(`git diff --raw returned an invalid row in ${worktreeDir}: ${line}`)
    }
    const header = line.slice(1, tab).trim().split(/\s+/)
    const file = line.slice(tab + 1)
    const beforeOID = header[2]
    const afterOID = header[3]
    const code = header[4]
    if (!beforeOID || !afterOID || !code || !file) {
      throw new Error(`git diff --raw returned an incomplete row in ${worktreeDir}: ${line}`)
    }
    const status =
      code === "A" ? "added" : code === "D" ? "deleted" : code === "M" || code === "T" ? "modified" : undefined
    if (!status) throw new Error(`git diff --raw returned unsupported status ${code} for ${file}`)
    if (ProjectRuntimePaths.isInternalRuntimeRelativePath(file)) continue
    const zeroObject = /^0+$/
    objects.set(file, {
      status,
      beforeOID: zeroObject.test(beforeOID) ? null : beforeOID,
      afterOID: zeroObject.test(afterOID) ? null : afterOID,
    })
  }

  const numstatArgs = [
    "-c",
    "core.quotepath=false",
    "diff",
    "--no-ext-diff",
    "--no-renames",
    "--numstat",
    baseRef,
    terminalRef,
    "--",
    ".",
  ]
  const numstatResult = await runGit(numstatArgs, { cwd: worktreeDir, env, timeoutProfile: "default" })
  requireExecutionContributionGitSuccess(numstatResult, numstatArgs, worktreeDir)
  const numstatOut = numstatResult.text().trim()

  const rows = new Map<string, { additions: string; deletions: string; isBinary: boolean }>()
  for (const line of numstatOut.split("\n")) {
    if (!line) continue
    const [additions, deletions, file] = line.split("\t")
    if (!additions || !deletions || !file) {
      throw new Error(`git diff --numstat returned an invalid row in ${worktreeDir}: ${line}`)
    }
    if (ProjectRuntimePaths.isInternalRuntimeRelativePath(file)) continue
    if (!objects.has(file)) throw new Error(`git diff --numstat returned ${file} without a matching raw row`)
    if ((additions === "-") !== (deletions === "-")) {
      throw new Error(`git diff --numstat returned inconsistent binary counts for ${file}`)
    }
    rows.set(file, { additions, deletions, isBinary: additions === "-" })
  }

  const objectIDs = new Set<string>()
  for (const entry of objects.values()) {
    if (entry.beforeOID) objectIDs.add(entry.beforeOID)
    if (entry.afterOID) objectIDs.add(entry.afterOID)
  }
  const sizes = await gitObjectSizes({ worktreeDir, objectIDs: [...objectIDs] })
  const result: BuildFileObservationData[] = []
  for (const [file, identity] of [...objects.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const row = rows.get(file)
    if (!row) throw new Error(`git diff inventory returned ${file} without diff statistics`)
    const added = row.isBinary ? 0 : Number.parseInt(row.additions, 10)
    const removed = row.isBinary ? 0 : Number.parseInt(row.deletions, 10)
    if (!Number.isInteger(added) || added < 0 || !Number.isInteger(removed) || removed < 0) {
      throw new Error(`git diff --numstat returned invalid counts for ${file}: ${row.additions}\t${row.deletions}`)
    }
    result.push(BuildFileObservation.parse({
      file,
      additions: Number.isFinite(added) ? added : 0,
      deletions: Number.isFinite(removed) ? removed : 0,
      status: identity.status,
      is_binary: row.isBinary,
      before: identity.beforeOID ? { oid: identity.beforeOID, bytes: sizes.get(identity.beforeOID) } : null,
      after: identity.afterOID ? { oid: identity.afterOID, bytes: sizes.get(identity.afterOID) } : null,
    }))
  }
  return result
}

async function gitObjectSizes(input: { worktreeDir: string; objectIDs: string[] }): Promise<Map<string, number>> {
  const sizes = new Map<string, number>()
  if (input.objectIDs.length === 0) return sizes
  const process = Process.spawnHost(
    gitProcessArgs(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"]),
    {
      cwd: input.worktreeDir,
      env: gitCeilingEnvForWorktree(input.worktreeDir),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  if (!process.stdin) throw new Error("git cat-file size batch has no stdin")
  process.stdin.write(`${input.objectIDs.join("\n")}\n`)
  process.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout as unknown as ReadableStream<Uint8Array>).text(),
    new Response(process.stderr as unknown as ReadableStream<Uint8Array>).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`git cat-file size batch failed in ${input.worktreeDir}: ${stderr.trim()}`)
  for (const line of stdout.trim().split("\n")) {
    if (!line) continue
    const [oid, type, rawSize] = line.split(" ")
    const size = Number.parseInt(rawSize ?? "", 10)
    if (!oid || type !== "blob" || !Number.isInteger(size) || size < 0) {
      throw new Error(`git cat-file size batch returned an invalid row in ${input.worktreeDir}: ${line}`)
    }
    sizes.set(oid, size)
  }
  for (const oid of input.objectIDs) {
    if (!sizes.has(oid)) throw new Error(`git cat-file size batch omitted ${oid} in ${input.worktreeDir}`)
  }
  return sizes
}

// ---------------------------------------------------------------------------
// Prompt / label helpers
// ---------------------------------------------------------------------------

function buildSessionTitle(agentID: string, title: string): string {
  const snippet = title.slice(0, 60).replace(/\s+/g, " ").trim()
  return `${agentID} (build): ${snippet}${title.length > 60 ? "…" : ""}`
}

function renderBuildFinalMessageContract(): string {
  return [
    "## Final Assistant Message",
    "",
    "End with a normal visible assistant message that explains implementation semantics, limitations, contradictions, and blockers.",
    "Do not copy changed files, commit refs, command results, tool calls, or consumed-evidence ledgers into a parallel structured payload; the Host records those observations.",
    "",
    "The Orchestrator reads this message together with domain artifacts, Session/tool trace, and Host observations.",
  ].join("\n")
}

export function buildUserPrompt(
  target: BuildTarget,
  context?: BuildAgent.PromptProjectionSource,
  taskID?: string,
): string {
  const contextLines: string[] = []
  const overlays = renderBuildPromptOverlays(context)
  if (overlays.sections.length > 0) {
    contextLines.push("## Task-Specific Build Overlays")
    contextLines.push("")
    contextLines.push(overlays.sections.join("\n\n"))
    contextLines.push("")
  }
  return [
    "# Delegation",
    "",
    "Implement this request, verify it, and finish with a visible assistant message.",
    "Use task-specific build overlays and supplied artifacts when present; do not import scenario policy that this request did not supply.",
    "If the request is a port, migration, rewrite, clone, parity restoration, or component translation, complete investigation of the named source surface and existing target conventions is required implementation work before writing.",
    "This direct request path is for implementation, rework, and concrete deliverables. If it does not match the requested work, explain the mismatch in the final message.",
    "",
    ...contextLines,
    renderUserRequestSection({ heading: "# Request", request: target.text, taskID }),
    "",
    renderBuildFinalMessageContract(),
  ].join("\n")
}
