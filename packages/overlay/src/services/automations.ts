import { ApiError, apiJson, captureApiAuthority, getServerUrl, serverSettledRequest } from "./api"
import { directoryScopedPath } from "./task-path"
import { randomUUID } from "../utils/random-id"
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

function manualRunStorageKey(id: string): string {
  const server = new URL(getServerUrl())
  return JSON.stringify(["opencorvus.automation-manual-run.v1", server.origin, server.pathname, id])
}

export function hasPendingAutomationRun(id: string): boolean {
  captureApiAuthority()
  try {
    return window.sessionStorage.getItem(manualRunStorageKey(id)) !== null
  } catch {
    return false
  }
}

export async function runAutomationNow(id: string): Promise<AutomationRunView[]> {
  const authority = captureApiAuthority()
  const storage = window.sessionStorage
  const storageKey = manualRunStorageKey(id)
  const requestID = storage.getItem(storageKey) ?? randomUUID()
  storage.setItem(storageKey, requestID)
  const retire = () => {
    if (storage.getItem(storageKey) === requestID) storage.removeItem(storageKey)
  }
  try {
    const runs = await apiJson<AutomationRunView[]>(automationPath(`/${encodeURIComponent(id)}/run`), serverSettledRequest({
      authority,
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ requestID }),
    }))
    const fireID = Array.isArray(runs) ? runs[0]?.fireId : undefined
    if (!fireID || !runs.every((run) => run?.automationId === id && run.fireId === fireID && Boolean(run.id))) {
      throw new Error(`Automation ${id} returned an unreadable run receipt.`)
    }
    retire()
    return runs
  } catch (error) {
    if (error instanceof ApiError && error.body && typeof error.body === "object" &&
      (error.body as { name?: unknown }).name === "AutomationManualRunReceiptUnavailableError") retire()
    throw error
  }
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
