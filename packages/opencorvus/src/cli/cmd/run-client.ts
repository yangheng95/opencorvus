import { IN_PROCESS_BASE_URL } from "@/server/in-process-client"

export function inProcessRunClientOptions(directory: string, fetch: typeof globalThis.fetch) {
  return {
    baseUrl: IN_PROCESS_BASE_URL,
    directory,
    fetch,
  }
}
