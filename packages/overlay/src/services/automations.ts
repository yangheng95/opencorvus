import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"
import type {
  GlobalAutomationsCreateData,
  GlobalAutomationsCreateResponse,
  GlobalAutomationsDeleteResponses,
  GlobalAutomationsListResponses,
  GlobalAutomationsRunResponses,
  GlobalAutomationsUpdateData,
} from "@opencorvus-ai/sdk"

export type AutomationView = GlobalAutomationsListResponses[200][number]
export type AutomationTarget = AutomationView["target"]
export type AutomationScope = AutomationTarget["scope"]
export type AutomationStatus = AutomationView["status"]
export type AutomationExecutionMode = AutomationView["executionMode"]
export type AutomationModel = NonNullable<AutomationView["model"]>
export type AutomationRunView = GlobalAutomationsRunResponses[200][number]
export type AutomationRunSession = NonNullable<AutomationRunView["session"]>
export type AutomationRunOutcome = AutomationRunView["outcome"]
export type AutomationInput = GlobalAutomationsCreateData["body"]
export type AutomationUpdate = GlobalAutomationsUpdateData["body"]

const jsonHeaders = { "Content-Type": "application/json" }

function automationPath(suffix = ""): string {
  return `/global/automations${suffix}`
}

export function listAutomations(signal?: AbortSignal): Promise<AutomationView[]> {
  return apiJson<AutomationView[]>(automationPath(), { signal })
}

export function createAutomation(
  input: AutomationInput,
): Promise<GlobalAutomationsCreateResponse> {
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

export function pauseAutomation(id: string, expectedRevisionId: string): Promise<AutomationView> {
  return updateAutomation(id, { status: "paused", expectedRevisionId })
}

export function resumeAutomation(id: string, expectedRevisionId: string): Promise<AutomationView> {
  return updateAutomation(id, { status: "active", expectedRevisionId })
}

export function runAutomationNow(id: string): Promise<AutomationRunView[]> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}/run`), { method: "POST" })
}

export function listAutomationRuns(id: string, signal?: AbortSignal): Promise<AutomationRunView[]> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}/runs`), { signal })
}

export function deleteAutomation(
  id: string,
  expectedRevisionId: string,
): Promise<GlobalAutomationsDeleteResponses[200]> {
  const query = new URLSearchParams({ expectedRevisionId })
  return apiJson(`${automationPath(`/${encodeURIComponent(id)}`)}?${query}`, { method: "DELETE" })
}

export async function resolveAutomationProjectID(directory: string): Promise<string> {
  const project = await apiJson<{ id: string }>(directoryScopedPath("project/current", directory, "automationProject"))
  return project.id
}
