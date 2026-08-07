import type { StreamHandle } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"
import { apiJson } from "./api"
import { PtyOutputStreamEvent, type PtyOutputStreamEvent as PtyOutputEvent } from "@opencorvus-ai/transport-protocol"
export type { PtyOutputStreamEvent as PtyOutputEvent } from "@opencorvus-ai/transport-protocol"

export interface TerminalProfileInfo {
  id: string
  label: string
  icon: "terminal" | "powershell" | "command-prompt" | "bash"
}

export interface TerminalProfileList {
  defaultProfileID: string
  profiles: TerminalProfileInfo[]
}

export interface PtyInfo {
  id: string
  title: string
  command: string
  args: string[]
  cwd: string
  status: "running" | "exited"
  pid: number
}

export async function listTerminalProfiles(): Promise<TerminalProfileList> {
  return apiJson<TerminalProfileList>("terminal/profiles")
}

export async function listPtySessions(): Promise<PtyInfo[]> {
  return apiJson<PtyInfo[]>("pty")
}

export async function createPtySession(profileID: string): Promise<PtyInfo> {
  return apiJson<PtyInfo>("pty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileID }),
  })
}

export async function resizePtySession(id: string, size: { cols: number; rows: number }): Promise<PtyInfo> {
  return apiJson<PtyInfo>(`pty/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size }),
  })
}

export async function writePtyInput(id: string, data: string): Promise<boolean> {
  return apiJson<boolean>(`pty/${encodeURIComponent(id)}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  })
}

export async function removePtySession(id: string): Promise<boolean> {
  return apiJson<boolean>(`pty/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function openPtyOutput(input: {
  id: string
  directory: string
  cursor: number
  onOpen?: () => void
  onEvent: (event: PtyOutputEvent) => void
  onError: (error: Error) => void
  onClose: (reason: string) => void
}): StreamHandle {
  let handle: StreamHandle | undefined
  let consumerFailed = false
  handle = getHostTransport().openStream(
    {
      path: `pty/${encodeURIComponent(input.id)}/output`,
      query: { directory: input.directory, cursor: input.cursor },
    },
    {
      onOpen: input.onOpen,
      onEvent: (data) => {
        if (consumerFailed) return
        let value: unknown
        try {
          value = JSON.parse(data)
        } catch (error) {
          consumerFailed = true
          input.onError(error instanceof Error ? error : new Error(String(error)))
          handle?.close("consumer-error")
          return
        }
        const parsed = PtyOutputStreamEvent.safeParse(value)
        if (!parsed.success) {
          consumerFailed = true
          input.onError(new Error("Invalid Pseudo Terminal output stream event", { cause: parsed.error }))
          handle?.close("consumer-error")
          return
        }
        input.onEvent(parsed.data)
      },
      onError: input.onError,
      onClose: input.onClose,
    },
  )
  if (consumerFailed) handle.close("consumer-error")
  return handle
}
