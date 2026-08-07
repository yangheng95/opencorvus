const FORBIDDEN_ENVIRONMENT_KEYS = new Set([
  "LD_PRELOAD",
  "LD_AUDIT",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_FORCE_FLAT_NAMESPACE",
])

export function sanitizeShellEnvironment(base: NodeJS.ProcessEnv, override: Record<string, string>) {
  const environment: NodeJS.ProcessEnv = {
    ...base,
    ...override,
  }
  for (const key of FORBIDDEN_ENVIRONMENT_KEYS) {
    delete environment[key]
  }
  return environment
}

export function forbiddenShellEnvironmentKeys() {
  return Array.from(FORBIDDEN_ENVIRONMENT_KEYS)
}
