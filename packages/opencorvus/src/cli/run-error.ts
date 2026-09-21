import { NamedError } from "@opencorvus-ai/util/error"

/** Also covers failures raised before the command handler (argument parsing/startup). */
export function isJsonRun(args: string[]): boolean {
  const end = args.indexOf("--")
  const options = end < 0 ? args : args.slice(0, end)
  return (
    options.includes("run") &&
    options.some((arg, i) => arg === "--format=json" || (arg === "--format" && options[i + 1] === "json"))
  )
}

export function runErrorObject(cause: unknown): { name: string; data: Record<string, unknown> } {
  if (cause instanceof NamedError) return cause.toObject()
  if (
    cause &&
    typeof cause === "object" &&
    "name" in cause &&
    "data" in cause &&
    typeof cause.name === "string" &&
    cause.data &&
    typeof cause.data === "object"
  ) {
    return { name: cause.name, data: cause.data as Record<string, unknown> }
  }
  return {
    name: cause instanceof Error ? cause.name : "RunError",
    data: { message: cause instanceof Error ? cause.message : String(cause) },
  }
}

export function writeRunError(cause: unknown, sessionID?: string): void {
  process.stdout.write(
    JSON.stringify({
      type: "error",
      timestamp: Date.now(),
      ...(sessionID ? { sessionID } : {}),
      error: runErrorObject(cause),
    }) + "\n",
  )
}
