import { setAppStore } from "../store/app"
import { apiJson } from "./api"

type ProjectMemoryDocument = {
  status: string
  pendingCount: number
  tokenCount: number
  notice?: { status: string; message: string; generation: string; acknowledged: boolean }
}

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
