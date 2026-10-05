import { batch, createSignal } from "solid-js"
import type { FileContent as SdkFileContent } from "@opencorvus-ai/sdk"
import { uint8ToBase64 } from "@opencorvus-ai/transport-protocol"
import { apiJson } from "./api"
import { projectScopedPath } from "./project-directory"

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
}

export interface FileEditorLineRange {
  startLine: number
  endLine: number
}

export interface FileEditorTarget extends FileOperationScope {
  path: string
  range?: FileEditorLineRange
  sourceAbsolutePath?: string
}

const [selectedFileTarget, setSelectedFileTarget] = createSignal<FileEditorTarget | null>(null)
const [fileWorkbenchOpen, setFileWorkbenchOpen] = createSignal(false)
const [fileWorkbenchRevision, setFileWorkbenchRevision] = createSignal(0)
const [fileEditorRevealRevision, setFileEditorRevealRevision] = createSignal(0)
export interface FileEditorNavigationOwner {
  confirmLeave: () => Promise<boolean>
  isDirty: () => boolean
}
export interface FileEditorCommitBoundary {
  isCurrent: () => boolean
  commit: () => void
}
const [fileEditorOwner, setFileEditorOwner] = createSignal<FileEditorNavigationOwner>()
let fileEditorNavigationGeneration = 0

export function hasUnsavedFileChanges(): boolean {
  return fileEditorOwner()?.isDirty() ?? false
}

const selectedFilePath = () => selectedFileTarget()?.path ?? ""

export { selectedFilePath, selectedFileTarget, fileWorkbenchOpen, fileWorkbenchRevision, fileEditorRevealRevision }

export function bumpFileWorkbenchRevision(): void {
  setFileWorkbenchRevision((current) => current + 1)
}

function normalizeWorkbenchPath(path: string): string {
  return String(path || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/")
}

function joinWorkbenchPath(parent: string, child: string): string {
  const normalizedParent = normalizeWorkbenchPath(parent)
  const normalizedChild = normalizeWorkbenchPath(child)
  return [normalizedParent, normalizedChild].filter(Boolean).join("/")
}

function descendantSuffix(path: string, base: string): string | null {
  const normalizedPath = normalizeWorkbenchPath(path)
  const normalizedBase = normalizeWorkbenchPath(base)
  if (!normalizedBase) return normalizedPath ? normalizedPath : null
  if (normalizedPath === normalizedBase) return ""
  const prefix = `${normalizedBase}/`
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : null
}

function normalizeFileEditorRange(range?: FileEditorLineRange): FileEditorLineRange | undefined {
  if (!range) return undefined
  if (
    !Number.isInteger(range.startLine) ||
    !Number.isInteger(range.endLine) ||
    range.startLine < 1 ||
    range.endLine < range.startLine
  ) {
    throw new Error("openFileEditor: range must be a positive inclusive line range")
  }
  return { startLine: range.startLine, endLine: range.endLine }
}

function normalizeFileEditorTarget(
  path: string,
  scope: FileOperationScope,
  range?: FileEditorLineRange,
): FileEditorTarget {
  const next = String(path || "").trim()
  const directory = scope.directory.trim()
  if (!next || !directory) throw new Error("openFileEditor: path and directory are required")
  return {
    path: normalizeWorkbenchPath(next),
    directory,
    ...(range ? { range: normalizeFileEditorRange(range) } : {}),
  }
}

function normalizeSourceFileEditorTarget(
  absolutePath: string,
  scope: FileOperationScope,
  range?: FileEditorLineRange,
): FileEditorTarget {
  const sourceAbsolutePath = String(absolutePath || "").trim()
  const directory = scope.directory.trim()
  if (!sourceAbsolutePath || !directory) {
    throw new Error("openSourceFileEditor: absolutePath and directory are required")
  }
  if (!/^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(sourceAbsolutePath)) {
    throw new Error("openSourceFileEditor: source path must be absolute")
  }
  return {
    path: sourceAbsolutePath,
    directory,
    sourceAbsolutePath,
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
    left?.range?.startLine === right?.range?.startLine &&
    left?.range?.endLine === right?.range?.endLine
  )
}

function commitFileEditorTarget(target: FileEditorTarget | null): void {
  setSelectedFileTarget(target)
  setFileWorkbenchOpen(!!target)
  if (target) setFileEditorRevealRevision((current) => current + 1)
}

async function requestFileEditorTarget(
  target: FileEditorTarget | null,
  boundary?: FileEditorCommitBoundary,
): Promise<boolean> {
  const current = selectedFileTarget()
  const generation = ++fileEditorNavigationGeneration
  const owner = fileEditorOwner()
  if (!sameFileEditorResource(current, target) && owner && !(await owner.confirmLeave())) return false
  if (
    generation !== fileEditorNavigationGeneration ||
    !sameFileEditorResource(current, selectedFileTarget()) ||
    (boundary && !boundary.isCurrent())
  )
    return false
  batch(() => {
    if (sameFileEditorTarget(current, target)) {
      if (target) setFileEditorRevealRevision((revision) => revision + 1)
    } else {
      commitFileEditorTarget(target)
    }
    boundary?.commit()
  })
  return true
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

export function openFileEditor(path: string, scope: FileOperationScope, range?: FileEditorLineRange): Promise<boolean> {
  return requestFileEditorTarget(normalizeFileEditorTarget(path, scope, range))
}

export function openSourceFileEditor(
  absolutePath: string,
  scope: FileOperationScope,
  range?: FileEditorLineRange,
): Promise<boolean> {
  return requestFileEditorTarget(normalizeSourceFileEditorTarget(absolutePath, scope, range))
}

export function closeFileEditor(boundary?: FileEditorCommitBoundary): Promise<boolean> {
  return requestFileEditorTarget(null, boundary)
}

async function admitFileMutation(path: string, scope: FileOperationScope): Promise<void> {
  const target = selectedFileTarget()
  if (!target || target.sourceAbsolutePath || target.directory !== scope.directory.trim()) return
  if (descendantSuffix(target.path, path) === null) return
  const generation = ++fileEditorNavigationGeneration
  const owner = fileEditorOwner()
  const allowed = owner ? await owner.confirmLeave() : true
  if (
    !allowed ||
    generation !== fileEditorNavigationGeneration ||
    !sameFileEditorResource(target, selectedFileTarget())
  ) {
    throw new DOMException("File mutation cancelled or superseded", "AbortError")
  }
}

function updateOpenFilePathAfterMove(previousPath: string, nextPath: string, scope: FileOperationScope): void {
  const target = selectedFileTarget()
  if (!target || target.sourceAbsolutePath || target.directory !== scope.directory.trim()) return
  const suffix = descendantSuffix(target.path, previousPath)
  if (suffix === null) return
  setSelectedFileTarget({
    ...target,
    path: suffix ? joinWorkbenchPath(nextPath, suffix) : normalizeWorkbenchPath(nextPath),
  })
  setFileWorkbenchOpen(true)
}

function closeFileEditorIfDeleted(path: string, scope: FileOperationScope): void {
  const target = selectedFileTarget()
  if (!target || target.sourceAbsolutePath || target.directory !== scope.directory.trim()) return
  if (descendantSuffix(target.path, path) === null) return
  fileEditorNavigationGeneration += 1
  commitFileEditorTarget(null)
}

export function shortWorkbenchPath(path: string): string {
  const parts = String(path || "")
    .split(/[\\/]/)
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
  return (await apiJson(fileQueryPath("file", { path }, scope))) as FileNode[]
}

export async function uploadDroppedFiles(
  targetDir: string,
  files: File[],
  scope: FileOperationScope,
): Promise<FileUploadResult[]> {
  const payloads = await Promise.all(files.map(droppedFilePayload))
  const result = (await apiJson(projectScopedPath("file/upload", scope.directory), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDir, files: payloads }),
  })) as FileUploadResult[]
  bumpFileWorkbenchRevision()
  return result
}

export async function createFileItem(input: FileCreateRequest, scope: FileOperationScope): Promise<FileNode> {
  const result = (await apiJson(projectScopedPath("file/item", scope.directory), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })) as FileNode
  bumpFileWorkbenchRevision()
  return result
}

export async function moveFileItem(path: string, newPath: string, scope: FileOperationScope): Promise<FileMoveResult> {
  await admitFileMutation(path, scope)
  const result = (await apiJson(projectScopedPath("file/item", scope.directory), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, newPath }),
  })) as FileMoveResult
  updateOpenFilePathAfterMove(result.previousPath, result.path, scope)
  bumpFileWorkbenchRevision()
  return result
}

export async function copyFileItem(path: string, newPath: string, scope: FileOperationScope): Promise<FileCopyResult> {
  const result = (await apiJson(projectScopedPath("file/item/copy", scope.directory), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, newPath }),
  })) as FileCopyResult
  bumpFileWorkbenchRevision()
  return result
}

export async function deleteFileItem(path: string, scope: FileOperationScope): Promise<FileDeleteResult> {
  await admitFileMutation(path, scope)
  const result = (await apiJson(fileQueryPath("file/item", { path }, scope), {
    method: "DELETE",
  })) as FileDeleteResult
  closeFileEditorIfDeleted(result.path, scope)
  bumpFileWorkbenchRevision()
  return result
}
