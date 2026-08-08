import path from "node:path"
import z from "zod"
import { isBrowserPreviewTargetVisible } from "./liveness"
import {
  latestBrowserPreviewEvidenceIDs,
  findRecentBrowserPreviewTargets,
  type PersistedBrowserPreviewTarget,
} from "./persist"
import { BrowserPreviewViewport, BrowserPreviewViewportID, normalizeBrowserPreviewViewports } from "./viewport"

export const BrowserPreviewCandidate = z.object({
  id: z.string(),
  url: z.string(),
  source: z.literal("engine-artifact"),
  selected: z.boolean(),
  timeUpdated: z.number(),
})

export type BrowserPreviewCandidate = z.infer<typeof BrowserPreviewCandidate>

export const BrowserPreviewTarget = z.object({
  id: z.string().optional(),
  taskID: z.string().optional(),
  latestEvidenceIDs: z
    .object({
      desktop: z.string().optional(),
      tablet: z.string().optional(),
      mobile: z.string().optional(),
    })
    .optional(),
  kind: z.enum(["task-url", "missing", "failed"]),
  status: z.enum(["ready", "missing", "failed"]),
  projectRoot: z.string(),
  url: z.string().optional(),
  viewports: BrowserPreviewViewport.array(),
  diagnostics: z.string().array(),
  candidates: BrowserPreviewCandidate.array(),
  source: z.enum(["engine-artifact", "none"]),
})

export type BrowserPreviewTarget = z.infer<typeof BrowserPreviewTarget>

export async function resolveBrowserPreviewTarget(input: {
  projectRoot: string
  taskID: string
  isVisible?: (url: string) => Promise<boolean>
}): Promise<BrowserPreviewTarget> {
  const projectRoot = path.resolve(input.projectRoot)
  const taskID = input.taskID.trim()
  const persistedTargets = findRecentBrowserPreviewTargets(taskID)
  if (persistedTargets.length === 0) return missingBrowserPreviewTarget({ projectRoot, taskID })
  const selected = persistedTargets[0]!
  const selectedVisible = await isSelectedBrowserPreviewTargetVisible(selected, projectRoot, input.isVisible)
  if (!selectedVisible) {
    return failedBrowserPreviewTarget({
      projectRoot,
      taskID,
      id: selected.id,
      url: selected.url,
      viewports: selected.viewports,
      source: selected.source,
      diagnostics: [`Saved browser preview target is unreachable: ${selected.url}`],
      candidates: browserPreviewCandidates(persistedTargets, selected.id),
    })
  }
  return taskBrowserPreviewTarget({
    projectRoot,
    taskID,
    id: selected.id,
    url: selected.url,
    viewports: selected.viewports,
    candidates: browserPreviewCandidates(persistedTargets, selected.id),
    diagnostics: [`Using task browser preview target ${selected.id}.`],
    latestEvidenceIDs: await latestBrowserPreviewEvidenceIDs({ projectRoot, taskID, targetID: selected.id }),
  })
}

export function taskBrowserPreviewTarget(input: {
  projectRoot: string
  taskID: string
  id: string
  url: string
  viewports: BrowserPreviewViewport[]
  latestEvidenceIDs?: Partial<Record<BrowserPreviewViewportID, string>>
  diagnostics: string[]
  candidates?: BrowserPreviewCandidate[]
}): BrowserPreviewTarget {
  return {
    id: input.id,
    taskID: input.taskID,
    latestEvidenceIDs: input.latestEvidenceIDs,
    kind: "task-url",
    status: "ready",
    projectRoot: path.resolve(input.projectRoot),
    url: input.url,
    viewports: normalizeBrowserPreviewViewports(input.viewports),
    diagnostics: input.diagnostics,
    candidates: input.candidates ?? [],
    source: "engine-artifact",
  }
}

export function missingBrowserPreviewTarget(input: {
  projectRoot: string
  taskID: string
  diagnostics?: string[]
}): BrowserPreviewTarget {
  return {
    kind: "missing",
    status: "missing",
    projectRoot: path.resolve(input.projectRoot),
    taskID: input.taskID,
    viewports: [],
    diagnostics: input.diagnostics ?? ["No browser preview target saved for this task."],
    candidates: [],
    source: "none",
  }
}

export function failedBrowserPreviewTarget(input: {
  projectRoot: string
  taskID: string
  id?: string
  url?: string
  viewports?: BrowserPreviewViewport[]
  source?: "engine-artifact"
  candidates?: BrowserPreviewCandidate[]
  diagnostics: string[]
}): BrowserPreviewTarget {
  return {
    id: input.id,
    kind: "failed",
    status: "failed",
    projectRoot: path.resolve(input.projectRoot),
    taskID: input.taskID,
    url: input.url,
    viewports: input.viewports ? normalizeBrowserPreviewViewports(input.viewports) : [],
    diagnostics: input.diagnostics,
    candidates: input.candidates ?? [],
    source: input.source ?? "none",
  }
}

async function isSelectedBrowserPreviewTargetVisible(
  target: PersistedBrowserPreviewTarget,
  projectRoot: string,
  isVisible: ((url: string) => Promise<boolean>) | undefined,
): Promise<boolean> {
  const probe =
    isVisible ??
    ((url: string) =>
      isBrowserPreviewTargetVisible({ url, taskID: target.taskID, cwd: projectRoot }))
  return (await probe(target.url)) === true
}

function browserPreviewCandidates(
  targets: PersistedBrowserPreviewTarget[],
  selectedID: string,
): BrowserPreviewCandidate[] {
  return targets.map((target) => ({
    id: target.id,
    url: target.url,
    source: target.source,
    selected: target.id === selectedID,
    timeUpdated: target.timeUpdated,
  }))
}
