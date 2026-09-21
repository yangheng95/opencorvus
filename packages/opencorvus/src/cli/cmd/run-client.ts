import { IN_PROCESS_BASE_URL } from "@/server/in-process-client"
import { runErrorObject } from "../run-error"

export async function runRequest<T>(
  operation: string,
  request: Promise<{ data?: T; error?: unknown; response?: Response }>,
): Promise<T> {
  const result = await request
  if (result.error !== undefined || result.response?.ok === false || result.data === undefined) {
    const error = runErrorObject(result.error ?? new Error(`${operation} returned no data`))
    throw {
      name: error.name,
      data: {
        ...error.data,
        operation,
        ...(result.response ? { statusCode: result.response.status } : {}),
        message:
          error.data.message ||
          `${operation} failed${result.response ? `: HTTP ${result.response.status} ${result.response.statusText}` : ""}`,
      },
    }
  }
  return result.data
}

export function inProcessRunClientOptions(directory: string, fetch: typeof globalThis.fetch) {
  return {
    baseUrl: IN_PROCESS_BASE_URL,
    directory,
    fetch,
  }
}
