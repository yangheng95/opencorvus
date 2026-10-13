import { batch, createSignal } from "solid-js"
import type { FileContent as SdkFileContent, SourceFileRange } from "@opencorvus-ai/sdk"
import { uint8ToBase64 } from "@opencorvus-ai/transport-protocol"
import { apiJson, assertApiAuthorityCurrent, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "./api"
import { projectScopedPath } from "./project-directory"
import { isAbsoluteServerPath, normalizeProjectFilePath, pathWithForwardSeparators } from "../utils/server-path"
import { relativePathFrom } from "../utils/tool"

export interface FileNode {
  name: string
  path: string
  absolute: string
  type: "file" | "directory"
  ignored: boolean
}

export type FileContent = SdkFileContent

export interface FileUploadPayload {
  name: string
  contentBase64: string
  mimeType?: string
}

export interface FileUploadResult {
  name: string
  path: string
  bytes: number
}

export interface FileCreateRequest {
  path: string
  type: "file" | "directory"
  content?: string
}

export interface FileMoveResult {
  previousPath: string
  path: string
  node: FileNode
}

export interface FileCopyResult {
  sourcePath: string
  path: string
  node: FileNode
}

export interface FileDeleteResult {
  path: string
}

export interface FileOperationScope {
  directory: string
  authority?: ApiAuthority
}

export interface FileEditorTarget extends FileOperationScope {
  path: string
  range?: SourceFileRange
  sourceAbsolutePath?: string
  displayName?: string
}

const [selectedFileTarget, setSelectedFileTarget] = createSignal<FileEditorTarget | null>(null)
const [fileWorkbenchOpen, setFileWorkbenchOpen] = createSignal(false)
const [fileWorkbenchRevision, setFileWorkbenchRevision] = createSignal(0)
const [fileEditorRevealRevision, setFileEditorRevealRevision] = createSignal(0)
export interface FileEditorNavigationOwner {
  confirmLeave: () => Promise<number | null>
  getRevision: () => number
  isBusy: () => boolean
  isDirty: () => boolean
}
export interface FileEditorCommitBoundary {
  isCurrent: () => boolean
  commit: () => void
}
const [fileEditorOwner, setFileEditorOwner] = createSignal<FileEditorNavigationOwner>()
let fileEditorNavigationGeneration = 0
const [fileEditorReserved, setFileEditorReserved] = createSignal(false)
export { fileEditorReserved }

export interface FileEditorCloseHandle {
  isCurrent: () => boolean
  commit: () => void
  release: () => void
}
export type FileEditorClosePreparation =
  | { status: "ready"; handle: FileEditorCloseHandle }
  | { status: "cancelled" | "superseded" | "busy" }

export class FileEditorAdmissionError extends DOMException {
  constructor(readonly reason: "cancelled" | "superseded" | "busy") {
    super(`File editor admission ${reason}`, "AbortError")
  }
}

function assertFileEditorAvailable(): void {
  if (fileEditorReserved()) throw new FileEditorAdmissionError("busy")
}

export function hasUnsavedFileChanges(): boolean {
  return fileEditorOwner()?.isDirty() ?? false
}

const selectedFilePath = () => selectedFileTarget()?.path ?? ""

export { selectedFilePath, selectedFileTarget, fileWorkbenchOpen, fileWorkbenchRevision, fileEditorRevealRevision }

export function bumpFileWorkbenchRevision(): void {
  setFileWorkbenchRevision((current) => current + 1)
}

function joinWorkbenchPath(parent: string, child: string, directory: string): string {
  const normalizedParent = normalizeProjectFilePath(parent, directory)
  const normalizedChild = normalizeProjectFilePath(child, directory)
  return [normalizedParent, normalizedChild].filter(Boolean).join("/")
}

function descendantSuffix(path: string, base: string, directory: string): string | null {
  const normalizedPath = normalizeProjectFilePath(path, directory)
  const normalizedBase = normalizeProjectFilePath(base, directory)
  if (!normalizedBase) return normalizedPath ? normalizedPath : null
  if (normalizedPath === normalizedBase) return ""
  const prefix = `${normalizedBase}/`
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : null
}

function normalizeFileEditorRange(range?: SourceFileRange): SourceFileRange | undefined {
  if (!range) return undefined
  if (
    !Number.isInteger(range.startLine) ||
    !Number.isInteger(range.endLine) ||
    range.startLine < 1 ||
    range.endLine < range.startLine
  ) {
    throw new Error("openFileEditor: range must be a positive inclusive line range")
  }
  if (range.startColumn !== undefined && (
    !Number.isSafeInteger(range.startColumn) || range.startColumn < 1 || range.startLine !== range.endLine
  )) {
    throw new Error("openFileEditor: startColumn must be a positive safe integer within a single-line range")
  }
  return {
    startLine: range.startLine,
    endLine: range.endLine,
    ...(range.startColumn === undefined ? {} : { startColumn: range.startColumn }),
  }
}

function normalizeFileEditorTarget(
  path: string,
  scope: FileOperationScope,
  range?: SourceFileRange,
): FileEditorTarget {
  const next = String(path || "")
  const directory = scope.directory.trim()
  if (!next || !directory) throw new Error("openFileEditor: path and directory are required")
  return {
    path: normalizeProjectFilePath(next, directory),
    directory,
    ...(range ? { range: normalizeFileEditorRange(range) } : {}),
  }
}

function normalizeSourceFileEditorTarget(
  absolutePath: string,
  scope: FileOperationScope,
  range?: SourceFileRange,
  displayName?: string,
): FileEditorTarget {
  const sourceAbsolutePath = String(absolutePath || "")
  const directory = scope.directory.trim()
  if (!sourceAbsolutePath || !directory) {
    throw new Error("openSourceFileEditor: absolutePath and directory are required")
  }
  if (!isAbsoluteServerPath(sourceAbsolutePath)) {
    throw new Error("openSourceFileEditor: source path must be absolute")
  }
  return {
    path: sourceAbsolutePath,
    directory,
    sourceAbsolutePath,
    ...(displayName === undefined ? {} : { displayName }),
    ...(range ? { range: normalizeFileEditorRange(range) } : {}),
  }
}

function sameFileEditorResource(left: FileEditorTarget | null, right: FileEditorTarget | null): boolean {
  return (
    left?.path === right?.path &&
    left?.directory === right?.directory &&
    left?.sourceAbsolutePath === right?.sourceAbsolutePath
  )
}

function sameFileEditorTarget(left: FileEditorTarget | null, right: FileEditorTarget | null): boolean {
  return (
    sameFileEditorResource(left, right) &&
    left?.displayName === right?.displayName &&
    left?.range?.startLine === right?.range?.startLine &&
    left?.range?.endLine === right?.range?.endLine &&
    left?.range?.startColumn === right?.range?.startColumn
  )
}

function commitFileEditorTarget(target: FileEditorTarget | null): void {
  setSelectedFileTarget(target)
  setFileWorkbenchOpen(!!target)
  if (target) setFileEditorRevealRevision((current) => current + 1)
}

async function prepareFileEditorTarget(
  target: () => FileEditorTarget | null,
  needsDecision: boolean,
  authority: ApiAuthority,
  boundary?: FileEditorCommitBoundary,
): Promise<FileEditorClosePreparation> {
  assertApiAuthorityCurrent(authority)
  if (fileEditorReserved()) return { status: "busy" }
  const current = selectedFileTarget()
  const generation = ++fileEditorNavigationGeneration
  const owner = fileEditorOwner()
  if (owner?.isBusy()) return { status: "busy" }
  const revision = needsDecision && owner ? await owner.confirmLeave() : (owner?.getRevision() ?? 0)
  assertApiAuthorityCurrent(authority)
  if (revision === null) return { status: "cancelled" }
  if (
    generation !== fileEditorNavigationGeneration ||
    fileEditorReserved() ||
    fileEditorOwner() !== owner ||
    !sameFileEditorResource(current, selectedFileTarget()) ||
    (owner && revision !== owner.getRevision()) ||
    (boundary && !boundary.isCurrent())
  ) return { status: "superseded" }
  if (owner?.isBusy()) return { status: "busy" }
  let held = true
  setFileEditorReserved(true)
  const release = () => {
    if (!held) return
    held = false
    setFileEditorReserved(false)
  }
  return {
    status: "ready",
    handle: {
      isCurrent: () => held && generation === fileEditorNavigationGeneration &&
        sameFileEditorResource(current, selectedFileTarget()) &&
        fileEditorOwner() === owner && (!owner || owner.getRevision() === revision) &&
        isApiAuthorityCurrent(authority) && (!boundary || boundary.isCurrent()),
      commit: () => {
        if (!held) return
        batch(() => {
          const next = target()
          if (sameFileEditorTarget(current, next)) {
            if (next) setFileEditorRevealRevision((value) => value + 1)
          } else commitFileEditorTarget(next)
          try { boundary?.commit() } finally { release() }
        })
      },
      release,
    },
  }
}

export function prepareFileEditorClose(boundary?: FileEditorCommitBoundary): Promise<FileEditorClosePreparation> {
  return prepareFileEditorTarget(() => null, selectedFileTarget() !== null, captureApiAuthority(), boundary)
}

async function requestFileEditorTarget(
  target: FileEditorTarget | null,
  authority: ApiAuthority,
  boundary?: FileEditorCommitBoundary,
): Promise<boolean> {
  const result = await prepareFileEditorTarget(
    () => target, !sameFileEditorResource(selectedFileTarget(), target), authority, boundary,
  )
  if (result.status !== "ready") return false
  try {
    assertApiAuthorityCurrent(authority)
    if (!result.handle.isCurrent()) return false
    result.handle.commit()
    return true
  } finally {
    result.handle.release()
  }
}

export function registerFileEditorBeforeNavigate(owner: FileEditorNavigationOwner): () => void {
  if (fileEditorOwner() && fileEditorOwner() !== owner) {
    throw new Error("File editor already has a navigation decision owner")
  }
  setFileEditorOwner(owner)
  return () => {
    if (fileEditorOwner() === owner) setFileEditorOwner(undefined)
  }
}

export function openFileEditor(path: string, scope: FileOperationScope, range?: SourceFileRange): Promise<boolean> {
  const authority = scope.authority ?? captureApiAuthority()
  return requestFileEditorTarget(normalizeFileEditorTarget(path, scope, range), authority)
}

/** Ordinary citations share the project's editor resource, regardless of path spelling. */
export function openFileReference(path: string, scope: FileOperationScope, range?: SourceFileRange): Promise<boolean> {
  if (!isAbsoluteServerPath(path)) return openFileEditor(path, scope, range)
  const relative = relativePathFrom(scope.directory.trim(), path)
  return relative ? openFileEditor(relative, scope, range) : openSourceFileEditor(path, scope, range)
}

export function openSourceFileEditor(
  absolutePath: string,
  scope: FileOperationScope,
  range?: SourceFileRange,
  displayName?: string,
): Promise<boolean> {
  const authority = scope.authority ?? captureApiAuthority()
  return requestFileEditorTarget(normalizeSourceFileEditorTarget(absolutePath, scope, range, displayName), authority)
}

export function closeFileEditor(boundary?: FileEditorCommitBoundary): Promise<boolean> {
  return requestFileEditorTarget(null, captureApiAuthority(), boundary)
}

async function admitFileMutation(
  path: string,
  scope: FileOperationScope,
  destination: () => FileEditorTarget | null,
  authority: ApiAuthority,
): Promise<FileEditorCloseHandle | undefined> {
  assertApiAuthorityCurrent(authority)
  assertFileEditorAvailable()
  const target = selectedFileTarget()
  if (!target || target.sourceAbsolutePath || target.directory !== scope.directory.trim()) return
  if (descendantSuffix(target.path, path, scope.directory) === null) return
  const prepared = await prepareFileEditorTarget(destination, true, authority)
  if (prepared.status !== "ready") throw new FileEditorAdmissionError(prepared.status)
  return prepared.handle
}

export function shortWorkbenchPath(path: string, directory: string): string {
  const parts = pathWithForwardSeparators(path, directory)
    .split("/")
    .filter(Boolean)
  if (parts.length <= 2) return path
  return parts.slice(-2).join("/")
}

async function droppedFilePayload(file: File): Promise<FileUploadPayload> {
  return {
    name: file.name,
    contentBase64: uint8ToBase64(new Uint8Array(await file.arrayBuffer())),
    mimeType: file.type || undefined,
  }
}

function fileQueryPath(path: string, params: Record<string, string>, scope: FileOperationScope): string {
  const directory = scope.directory.trim()
  if (!directory) throw new Error("fileQueryPath: directory is required")
  const query = new URLSearchParams({ ...params, directory })
  return `${path}?${query.toString()}`
}

export async function loadFileDirectory(path: string, scope: FileOperationScope): Promise<FileNode[]> {
  const authority = scope.authority ?? captureApiAuthority()
  return (await apiJson(fileQueryPath("file", { path }, scope), { authority })) as FileNode[]
}

export async function uploadDroppedFiles(
  targetDir: string,
  files: File[],
  scope: FileOperationScope,
): Promise<FileUploadResult[]> {
  assertFileEditorAvailable()
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const payloads = await Promise.all(files.map(droppedFilePayload))
  assertFileEditorAvailable()
  const result = (await apiJson(projectScopedPath("file/upload", scope.directory), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDir, files: payloads }),
  })) as FileUploadResult[]
  bumpFileWorkbenchRevision()
  return result
}

export async function createFileItem(input: FileCreateRequest, scope: FileOperationScope): Promise<FileNode> {
  assertFileEditorAvailable()
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const result = (await apiJson(projectScopedPath("file/item", scope.directory), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })) as FileNode
  bumpFileWorkbenchRevision()
  return result
}

export async function moveFileItem(path: string, newPath: string, scope: FileOperationScope): Promise<FileMoveResult> {
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const target = selectedFileTarget()
  let result: FileMoveResult
  const admission = await admitFileMutation(path, scope, () => {
    const suffix = descendantSuffix(target!.path, result.previousPath, scope.directory)
    return { ...target!, path: suffix ? joinWorkbenchPath(result.path, suffix, scope.directory) : normalizeProjectFilePath(result.path, scope.directory) }
  }, authority)
  try {
    if (!admission) assertFileEditorAvailable()
    result = (await apiJson(projectScopedPath("file/item", scope.directory), {
      authority,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, newPath }),
    })) as FileMoveResult
    admission?.commit()
    bumpFileWorkbenchRevision()
    return result
  } finally { admission?.release() }
}

export async function copyFileItem(path: string, newPath: string, scope: FileOperationScope): Promise<FileCopyResult> {
  assertFileEditorAvailable()
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const result = (await apiJson(projectScopedPath("file/item/copy", scope.directory), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, newPath }),
  })) as FileCopyResult
  bumpFileWorkbenchRevision()
  return result
}

export async function deleteFileItem(path: string, scope: FileOperationScope): Promise<FileDeleteResult> {
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const admission = await admitFileMutation(path, scope, () => null, authority)
  try {
    if (!admission) assertFileEditorAvailable()
    const result = (await apiJson(fileQueryPath("file/item", { path }, scope), {
      authority,
      method: "DELETE",
    })) as FileDeleteResult
    admission?.commit()
    bumpFileWorkbenchRevision()
    return result
  } finally { admission?.release() }
}
