import { ProjectRuntimePaths } from "@/project/runtime-paths"

export const USER_REQUEST_BUNDLE_PATH_TEMPLATE = ".opencorvus/.r/t/<task-key>/intent/request.md"

export function renderUserRequestSection(input: {
  heading: string
  request: string
  title?: string
  taskID?: string
  bundlePath?: string
}): string {
  const bundlePath =
    input.bundlePath ??
    (input.taskID
      ? ProjectRuntimePaths.taskRelative(input.taskID, "intent", "request.md")
      : USER_REQUEST_BUNDLE_PATH_TEMPLATE)
  const lines: string[] = [input.heading, ""]
  if (input.title?.trim()) {
    lines.push(`Title: ${input.title.trim()}`, "")
  }
  lines.push("Full user request:")
  lines.push("")
  lines.push(input.request)
  lines.push("")
  lines.push(`Audit copy: \`${bundlePath}\`.`)
  return lines.join("\n")
}
