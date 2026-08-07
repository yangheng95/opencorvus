import fs from "fs/promises"
import path from "path"
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js"
import { EngineService } from "@/task-api"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Filesystem } from "@/util/filesystem"
import { hostGit as git } from "@/util/git"
import { requireTask } from "./store"

export type ProjectArchive = {
  bytes: Uint8Array
  filename: string
  fileCount: number
}

export class ProjectArchiveUnsupportedProjectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProjectArchiveUnsupportedProjectError"
  }
}

type TaskExecutionFlow = {
  manifest: Record<string, unknown>
  task: Awaited<ReturnType<typeof EngineService.getTask>>
  board: Awaited<ReturnType<typeof EngineService.getBoard>>
  interactions: unknown
  protocolEvents: unknown
  trace: unknown
  transcript: unknown
}

const ARCHIVE_MAX_STRING_CHARS = 16_384
const ARCHIVE_MAX_ARRAY_ITEMS = 500
const ARCHIVE_MAX_DEPTH = 12

function safeArchiveSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!cleaned) throw new Error("Project archive filename subject has no safe characters")
  return cleaned
}

function zipPath(...parts: string[]): string {
  return parts.join("/").replace(/\\/g, "/")
}

function parseGitNulList(output: string): string[] {
  return output
    .split("\0")
    .filter((item) => item.length > 0)
    .filter(ProjectRuntimePaths.isSourceArchiveAllowed)
    .toSorted()
}

function assertRelativeProjectFile(relativePath: string): void {
  if (!relativePath) throw new Error("Empty project archive path")
  if (path.isAbsolute(relativePath)) throw new Error(`Absolute project archive path: ${relativePath}`)
  const normalized = path.normalize(relativePath)
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`Project archive path escapes worktree: ${relativePath}`)
  }
}

async function listGitIncludedFiles(projectDir: string): Promise<string[]> {
  const result = await git(
    [
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.quotepath=false",
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".",
    ],
    { cwd: projectDir, timeoutProfile: "default" },
  )
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString().trim() || result.stdout.toString().trim() || "git ls-files failed"
    throw new Error(`Project archive file listing failed: ${detail}`)
  }
  return parseGitNulList(result.text())
}

async function addJson(zip: ZipWriter<Blob>, name: string, value: unknown): Promise<void> {
  await zip.add(name, new TextReader(`${JSON.stringify(value, null, 2)}\n`))
}

function boundArchiveValue(value: unknown, depth = 0): unknown {
  if (depth > ARCHIVE_MAX_DEPTH) return { truncated: true, reason: "max_depth" }
  if (typeof value === "string") {
    if (value.length <= ARCHIVE_MAX_STRING_CHARS) return value
    return {
      truncated: true,
      reason: "string_limit",
      chars: value.length,
      preview: value.slice(0, ARCHIVE_MAX_STRING_CHARS),
    }
  }
  if (!value || typeof value !== "object") return value
  if (Array.isArray(value)) {
    const items = value.slice(0, ARCHIVE_MAX_ARRAY_ITEMS).map((item) => boundArchiveValue(item, depth + 1))
    if (value.length <= ARCHIVE_MAX_ARRAY_ITEMS) return items
    return [
      ...items,
      {
        truncated: true,
        reason: "array_limit",
        originalLength: value.length,
        kept: ARCHIVE_MAX_ARRAY_ITEMS,
      },
    ]
  }
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value)) out[key] = boundArchiveValue(val, depth + 1)
  return out
}

async function addProjectFile(zip: ZipWriter<Blob>, projectDir: string, relativePath: string): Promise<void> {
  assertRelativeProjectFile(relativePath)
  const absolute = path.join(projectDir, relativePath)
  const stat = await fs.lstat(absolute)
  if (stat.isSymbolicLink()) return
  if (!stat.isFile()) return
  const data = new Uint8Array(await Filesystem.readArrayBuffer(absolute))
  await zip.add(zipPath("project", ...relativePath.split(/[\\/]+/)), new Uint8ArrayReader(data))
}

async function collectTaskExecutionFlow(input: {
  taskID: string
  project: Project.Info
  fileCount: number
  transcript: unknown[]
}): Promise<TaskExecutionFlow> {
  const task = await EngineService.getTask(input.taskID)
  const board = await EngineService.getBoard(input.taskID)
  const [interactions, protocolEvents, trace] = await Promise.all([
    EngineService.listTaskInteractions(input.taskID),
    EngineService.listProtocolEvents(input.taskID),
    EngineService.getTaskTrace(input.taskID),
  ])
  const executionFiles = [
    "manifest.json",
    "task.json",
    "board.json",
    "interactions.json",
    "protocol-events.json",
    "trace.json",
    "transcript.json",
  ]
  const manifest = {
    schema: "opencorvus.task-project-archive.v1",
    exportedAt: new Date().toISOString(),
    taskID: input.taskID,
    project: {
      id: input.project.id,
      name: input.project.name,
      worktree: input.project.worktree,
    },
    projectFileRoot: "project/",
    projectFileSelection: "git ls-files --cached --others --exclude-standard -z -- . + OpenCorvus runtime filter",
    projectFileCount: input.fileCount,
    executionFlowRoot: "opencorvus-task-execution-flow/",
    executionFiles,
    executionFlowBounds: {
      maxStringChars: ARCHIVE_MAX_STRING_CHARS,
      maxArrayItems: ARCHIVE_MAX_ARRAY_ITEMS,
      maxDepth: ARCHIVE_MAX_DEPTH,
    },
  }
  return {
    manifest,
    task,
    board,
    interactions: boundArchiveValue(interactions),
    protocolEvents: boundArchiveValue(protocolEvents),
    trace: boundArchiveValue(trace),
    transcript: boundArchiveValue(input.transcript),
  }
}

async function addTaskExecutionFlow(
  zip: ZipWriter<Blob>,
  input: {
    taskID: string
    project: Project.Info
    fileCount: number
    transcript: unknown[]
  },
): Promise<void> {
  const flow = await collectTaskExecutionFlow(input)
  const flowRoot = "opencorvus-task-execution-flow"
  await addJson(zip, zipPath(flowRoot, "manifest.json"), flow.manifest)
  await addJson(zip, zipPath(flowRoot, "task.json"), flow.task)
  await addJson(zip, zipPath(flowRoot, "board.json"), flow.board)
  await addJson(zip, zipPath(flowRoot, "interactions.json"), flow.interactions)
  await addJson(zip, zipPath(flowRoot, "protocol-events.json"), flow.protocolEvents)
  await addJson(zip, zipPath(flowRoot, "trace.json"), flow.trace)
  await addJson(zip, zipPath(flowRoot, "transcript.json"), flow.transcript)
}

async function addMissionExecutionFlow(
  zip: ZipWriter<Blob>,
  input: {
    missionID: string
    sessionID: string
    title: string
    directory: string
    project: Project.Info
    fileCount: number
    record: unknown
    status: unknown
    tasks: unknown
    transcript: unknown[]
  },
): Promise<void> {
  const executionFiles = ["manifest.json", "mission.json", "status.json", "tasks.json", "transcript.json"]
  const flowRoot = "opencorvus-mission-execution-flow"
  const manifest = {
    schema: "opencorvus.mission-project-archive.v1",
    exportedAt: new Date().toISOString(),
    missionID: input.missionID,
    sessionID: input.sessionID,
    title: input.title,
    directory: input.directory,
    project: {
      id: input.project.id,
      name: input.project.name,
      worktree: input.project.worktree,
    },
    projectFileRoot: "project/",
    projectFileSelection: "git ls-files --cached --others --exclude-standard -z -- . + OpenCorvus runtime filter",
    projectFileCount: input.fileCount,
    executionFlowRoot: `${flowRoot}/`,
    executionFiles,
    executionFlowBounds: {
      maxStringChars: ARCHIVE_MAX_STRING_CHARS,
      maxArrayItems: ARCHIVE_MAX_ARRAY_ITEMS,
      maxDepth: ARCHIVE_MAX_DEPTH,
    },
  }
  await addJson(zip, zipPath(flowRoot, "manifest.json"), manifest)
  await addJson(zip, zipPath(flowRoot, "mission.json"), boundArchiveValue(input.record))
  await addJson(zip, zipPath(flowRoot, "status.json"), boundArchiveValue(input.status))
  await addJson(zip, zipPath(flowRoot, "tasks.json"), boundArchiveValue(input.tasks))
  await addJson(zip, zipPath(flowRoot, "transcript.json"), boundArchiveValue(input.transcript))
}

async function buildProjectArchive(input: {
  project: Project.Info
  filenameSubject: string
  unsupportedProjectMessage: string
  addExecutionFlow: (zip: ZipWriter<Blob>, fileCount: number) => Promise<void>
}): Promise<ProjectArchive> {
  if (!Project.isGitRepo(input.project.worktree)) {
    throw new ProjectArchiveUnsupportedProjectError(input.unsupportedProjectMessage)
  }
  const files = await listGitIncludedFiles(input.project.worktree)
  const zip = new ZipWriter(new BlobWriter("application/zip"))
  for (const file of files) {
    await addProjectFile(zip, input.project.worktree, file)
  }
  await input.addExecutionFlow(zip, files.length)
  const blob = await zip.close()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return {
    bytes,
    filename: `${safeArchiveSegment(input.filenameSubject)}-project.zip`,
    fileCount: files.length,
  }
}

export async function buildTaskProjectArchive(input: {
  taskID: string
  transcript: unknown[]
}): Promise<ProjectArchive> {
  const task = requireTask(input.taskID)
  const project = Project.get(task.project_id)
  if (!project) throw new Error(`Project not found for task ${input.taskID}: ${task.project_id}`)
  return buildProjectArchive({
    project,
    filenameSubject: input.taskID,
    unsupportedProjectMessage: `Task ${input.taskID} project is not a Git worktree and cannot be archived with gitignore semantics`,
    addExecutionFlow: (zip, fileCount) =>
      addTaskExecutionFlow(zip, {
        taskID: input.taskID,
        project,
        fileCount,
        transcript: input.transcript,
      }),
  })
}

export async function buildMissionProjectArchive(input: {
  missionID: string
  sessionID: string
  projectID: string
  title: string
  directory: string
  record: unknown
  status: unknown
  tasks: unknown
  transcript: unknown[]
}): Promise<ProjectArchive> {
  const project = Project.get(input.projectID)
  if (!project) throw new Error(`Project not found for mission ${input.missionID}: ${input.projectID}`)
  return buildProjectArchive({
    project,
    filenameSubject: input.missionID,
    unsupportedProjectMessage: `Mission ${input.missionID} project is not a Git worktree and cannot be archived with gitignore semantics`,
    addExecutionFlow: (zip, fileCount) =>
      addMissionExecutionFlow(zip, {
        missionID: input.missionID,
        sessionID: input.sessionID,
        title: input.title,
        directory: input.directory,
        project,
        fileCount,
        record: input.record,
        status: input.status,
        tasks: input.tasks,
        transcript: input.transcript,
      }),
  })
}
