import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"

export type AutomationScope = "session" | "project" | "global"
export type AutomationTarget =
  | { scope: "session"; sessionId: string }
  | { scope: "project"; projectIds: string[] }
  | { scope: "global" }
export type AutomationStatus = "active" | "paused"
export type AutomationExecutionMode = "local" | "worktree"
export type AutomationRunOutcome = "running" | "succeeded" | "failed"

export interface AutomationModel {
  providerID: string
  modelID: string
}

export interface AutomationView {
  id: string
  name: string
  target: AutomationTarget
  recurrence: string
  executionMode: AutomationExecutionMode
  model: AutomationModel | null
  reasoningEffort: string | null
  prompt: string
  status: AutomationStatus
  lastRun: number | null
  nextRun: number
  failureCount: number
  lastError: string | null
}

export interface AutomationRunSession {
  id: string
  title: string
  directory: string
  kind: string
  experience: "chat" | "work" | null
  productPillar: "code" | "work" | null
}

export interface AutomationRunView {
  id: string
  automationId: string
  fireId: string
  targetScope: AutomationScope
  targetProjectId: string | null
  session: AutomationRunSession | null
  outcome: AutomationRunOutcome
  startedAt: number
  completedAt: number | null
  error: string | null
}

export interface AutomationInput {
  name: string
  target: AutomationTarget
  recurrence: string
  executionMode: AutomationExecutionMode
  model?: AutomationModel
  reasoningEffort?: string
  prompt: string
}

export type AutomationUpdate = Partial<Omit<AutomationInput, "model" | "reasoningEffort">> & {
  model?: AutomationModel | null
  reasoningEffort?: string | null
  status?: AutomationStatus
}

const jsonHeaders = { "Content-Type": "application/json" }

function automationPath(suffix = ""): string {
  return `/global/automations${suffix}`
}

export function listAutomations(signal?: AbortSignal): Promise<AutomationView[]> {
  return apiJson<AutomationView[]>(automationPath(), { signal })
}

export function createAutomation(input: AutomationInput): Promise<{ id: string; name: string; nextRun: number }> {
  return apiJson(automationPath(), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function updateAutomation(id: string, input: AutomationUpdate): Promise<AutomationView> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function pauseAutomation(id: string): Promise<AutomationView> {
  return updateAutomation(id, { status: "paused" })
}

export function resumeAutomation(id: string): Promise<AutomationView> {
  return updateAutomation(id, { status: "active" })
}

export function runAutomationNow(id: string): Promise<AutomationRunView[]> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}/run`), { method: "POST" })
}

export function listAutomationRuns(id: string, signal?: AbortSignal): Promise<AutomationRunView[]> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}/runs`), { signal })
}

export function deleteAutomation(id: string): Promise<{ id: string; name: string }> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}`), { method: "DELETE" })
}

export async function resolveAutomationProjectID(directory: string): Promise<string> {
  const project = await apiJson<{ id: string }>(directoryScopedPath("project/current", directory, "automationProject"))
  return project.id
}
