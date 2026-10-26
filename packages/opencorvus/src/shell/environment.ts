const FORBIDDEN_ENVIRONMENT_KEYS = new Set([
  "LD_PRELOAD",
  "LD_AUDIT",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_FORCE_FLAT_NAMESPACE",
])

export function sanitizeShellEnvironment(base: NodeJS.ProcessEnv, ...overrides: Record<string, string>[]) {
  const environment: NodeJS.ProcessEnv = {}
  const names = new Map<string, string>()
  for (const layer of [base, ...overrides]) {
    for (const [name, value] of Object.entries(layer)) {
      const identity = process.platform === "win32" ? name.toUpperCase() : name
      const previous = names.get(identity)
      if (previous !== undefined) delete environment[previous]
      names.set(identity, name)
      environment[name] = value
    }
  }
  // These product text pipes are decoded as UTF-8. Set only the standard-stream
  // default; explicit host/plugin/project choices and Python file I/O stay intact.
  const encodingName = names.get("PYTHONIOENCODING") ?? "PYTHONIOENCODING"
  environment[encodingName] ??= "utf-8"
  for (const key of FORBIDDEN_ENVIRONMENT_KEYS) {
    delete environment[key]
  }
  return environment
}

export function forbiddenShellEnvironmentKeys() {
  return Array.from(FORBIDDEN_ENVIRONMENT_KEYS)
}
