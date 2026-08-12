import { setAppStore } from "../store/app"
import { apiJson } from "./api"
import { getHostTransport } from "./host-transport-runtime"
import { AppLog } from "../utils/log"

type ProjectMemoryDocument = {
  status: string
  pendingCount: number
  tokenCount: number
  notice?: { status: string; message: string; generation: string; acknowledged: boolean }
}

let handle: { close(reason?: string): void } | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

export async function refreshProjectMemory(): Promise<ProjectMemoryDocument> {
  const document = await apiJson<ProjectMemoryDocument>("experimental/project-memory")
  setAppStore("projectMemory", document)
  return document
}

export async function organizeProjectMemory(): Promise<ProjectMemoryDocument> {
  const response = await apiJson<{ document: ProjectMemoryDocument }>("experimental/project-memory/organize", {
    method: "POST",
  })
  setAppStore("projectMemory", response.document)
  return response.document
}

export async function acknowledgeProjectMemoryNotice(generation: string): Promise<void> {
  await apiJson("experimental/project-memory/notice/acknowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ generation }),
  })
  await refreshProjectMemory()
}

export function stopProjectMemoryEvents(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  const current = handle
  handle = null
  current?.close("consumer-dispose")
}

export function startProjectMemoryEvents(): void {
  stopProjectMemoryEvents()
  void refreshProjectMemory().catch((error) =>
    AppLog.warn("project-memory", "Project MEMORY.MD status refresh failed", { error: String(error) }),
  )
  const next = getHostTransport().openStream(
    { path: "experimental/project-memory/events" },
    {
      onOpen: () => undefined,
      onEvent: (data) => {
        let event: { type?: string } | undefined
        try {
          event = JSON.parse(data)
        } catch (error) {
          AppLog.error("project-memory", "Malformed Project MEMORY.MD event", { error: String(error) })
          return
        }
        if (event?.type !== "project.memory.notice.changed") return
        void refreshProjectMemory().catch((error) =>
          AppLog.warn("project-memory", "Project MEMORY.MD notice refresh failed", { error: String(error) }),
        )
      },
      onClose: () => {
        if (handle !== next) return
        handle = null
        retryTimer = setTimeout(() => {
          retryTimer = null
          startProjectMemoryEvents()
        }, 3000)
      },
      onError: () => {
        if (handle === next) next.close("transport-error")
      },
    },
  )
  handle = next
}
