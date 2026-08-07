export function directoryScopedPath(path: string, directory: string, label = "directoryScopedPath"): string {
  const cleanPath = path.replace(/^\/+/, "")
  const cleanDirectory = String(directory || "").trim()
  if (!cleanDirectory) throw new Error(`${label}: directory is required`)
  const queryIndex = cleanPath.indexOf("?")
  const pathOnly = queryIndex >= 0 ? cleanPath.slice(0, queryIndex) : cleanPath
  const query = new URLSearchParams(queryIndex >= 0 ? cleanPath.slice(queryIndex + 1) : "")
  query.set("directory", cleanDirectory)
  return `${pathOnly}?${query.toString()}`
}

export function taskScopedPath(taskID: string, directory: string, suffix = ""): string {
  const base = `task/${encodeURIComponent(taskID)}${suffix}`
  return directoryScopedPath(base, directory, "taskScopedPath")
}
