import {
  ApiError,
  apiJson,
  captureApiAuthority,
  getServerUrl,
  isApiAuthorityCurrent,
  serverSettledRequest,
  type ApiAuthority,
} from "./api"
import { isUncertainMutationReceipt, settleMutationReceipt } from "./mutation-receipt"
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

export function listAutomations(signal?: AbortSignal, authority?: ApiAuthority): Promise<AutomationView[]> {
  return apiJson<AutomationView[]>(automationPath(), { signal, authority })
}

export class AutomationSaveUnconfirmedError extends AggregateError {
  override readonly name = "AutomationSaveUnconfirmedError"

  constructor(cause: unknown) {
    super([cause], "The scheduled task save receipt could not be confirmed.")
  }
}

async function confirmAutomationSave<T>(authority: ApiAuthority, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (cause) {
    if (!isApiAuthorityCurrent(authority) || !isUncertainMutationReceipt(cause)) throw cause
    throw new AutomationSaveUnconfirmedError(cause)
  }
}

export function createAutomation(
  input: AutomationInput,
  authority = captureApiAuthority(),
): Promise<GlobalAutomationsCreateResponse> {
  return confirmAutomationSave(authority, async () => {
    const receipt = await apiJson<GlobalAutomationsCreateResponse>(automationPath(), {
      authority,
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    })
    if (
      typeof receipt?.id !== "string" || !receipt.id.trim() ||
      receipt.revisionId !== receipt.id || receipt.name !== input.name ||
      (receipt.nextRun !== null && !Number.isFinite(receipt.nextRun))
    ) {
      throw new Error("The scheduled task creation receipt is invalid.")
    }
    return receipt
  })
}

function updateAutomation(id: string, input: AutomationUpdate, authority: ApiAuthority): Promise<AutomationView> {
  return apiJson(automationPath(`/${encodeURIComponent(id)}`), {
    authority,
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function editAutomation(
  id: string,
  input: AutomationUpdate & { requestID: string },
  authority = captureApiAuthority(),
): Promise<AutomationView> {
  return confirmAutomationSave(authority, async () => {
    const receipt = await updateAutomation(id, input, authority)
    if (
      receipt?.id !== id || typeof receipt.revisionId !== "string" || !receipt.revisionId.trim() ||
      receipt.revisionId === input.expectedRevisionId || (input.name !== undefined && receipt.name !== input.name)
    ) {
      throw new Error("The scheduled task edit receipt is invalid.")
    }
    return receipt
  })
}

export class AutomationStatusUnconfirmedError extends AggregateError {
  override readonly name = "AutomationStatusUnconfirmedError"

  constructor(receiptError: unknown, verificationError: unknown) {
    super([receiptError, verificationError], "The requested scheduled task status could not be confirmed.")
  }
}

export function changeAutomationStatus(
  id: string,
  expectedRevisionId: string,
  status: AutomationStatus,
  authority = captureApiAuthority(),
): Promise<AutomationView> {
  const confirm = (row: AutomationView | undefined) => {
    if (
      row?.id !== id || row.status !== status ||
      typeof row.revisionId !== "string" || !row.revisionId.trim() || row.revisionId === expectedRevisionId
    ) {
      throw new Error("The current scheduled task does not confirm the requested status and revision.")
    }
    return row
  }
  return settleMutationReceipt({
    authority,
    write: async () => confirm(await updateAutomation(id, { status, expectedRevisionId }, authority)),
    verify: async () => confirm((await listAutomations(undefined, authority)).find((row) => row.id === id)),
    UnconfirmedError: AutomationStatusUnconfirmedError,
  })
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
