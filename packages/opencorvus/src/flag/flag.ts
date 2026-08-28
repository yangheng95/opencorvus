function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function positiveInteger(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export namespace Flag {
  /** Maximum number of idle Project runtime cache entries retained by the server. */
  export declare const OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT: number
  /** Maximum time cache convergence waits for one Project runtime disposer. */
  export declare const OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS: number
  /** Maximum attempts for one atomic rename while Windows releases transient filesystem handles. */
  export declare const OPENCORVUS_FILESYSTEM_RENAME_ATTEMPTS: number
  /** Base delay in milliseconds between atomic rename attempts after transient filesystem contention. */
  export declare const OPENCORVUS_FILESYSTEM_RENAME_DELAY_MS: number
  export const OPENCORVUS_AUTO_SHARE = truthy("OPENCORVUS_AUTO_SHARE")
  export const OPENCORVUS_GIT_BASH_PATH = process.env["OPENCORVUS_GIT_BASH_PATH"]
  export const OPENCORVUS_CONFIG = process.env["OPENCORVUS_CONFIG"]
  export declare const OPENCORVUS_CONFIG_DIR: string | undefined
  export const OPENCORVUS_CONFIG_CONTENT = process.env["OPENCORVUS_CONFIG_CONTENT"]
  export const OPENCORVUS_DISABLE_AUTOUPDATE = truthy("OPENCORVUS_DISABLE_AUTOUPDATE")
  export const OPENCORVUS_DISABLE_PRUNE = truthy("OPENCORVUS_DISABLE_PRUNE")
  export const OPENCORVUS_DISABLE_TERMINAL_TITLE = truthy("OPENCORVUS_DISABLE_TERMINAL_TITLE")
  export const OPENCORVUS_ENABLE_EXPERIMENTAL_MODELS = truthy("OPENCORVUS_ENABLE_EXPERIMENTAL_MODELS")
  export const OPENCORVUS_DISABLE_AUTOCOMPACT = truthy("OPENCORVUS_DISABLE_AUTOCOMPACT")
  export declare const OPENCORVUS_DISABLE_CLAUDE_CODE: boolean
  export declare const OPENCORVUS_DISABLE_CLAUDE_CODE_PROMPT: boolean
  export declare const OPENCORVUS_DISABLE_CLAUDE_CODE_SKILLS: boolean
  export declare const OPENCORVUS_DISABLE_EXTERNAL_SKILLS: boolean
  export declare const OPENCORVUS_DISABLE_PROJECT_CONFIG: boolean
  export declare const OPENCORVUS_CLIENT: string
  export const OPENCORVUS_SERVER_PASSWORD = process.env["OPENCORVUS_SERVER_PASSWORD"]
  export const OPENCORVUS_SERVER_USERNAME = process.env["OPENCORVUS_SERVER_USERNAME"]
  export const OPENCORVUS_ENABLE_QUESTION_TOOL = truthy("OPENCORVUS_ENABLE_QUESTION_TOOL")

  // Experimental
  export const OPENCORVUS_EXPERIMENTAL = truthy("OPENCORVUS_EXPERIMENTAL")
  export const OPENCORVUS_EXPERIMENTAL_FILEWATCHER = truthy("OPENCORVUS_EXPERIMENTAL_FILEWATCHER")
  export const OPENCORVUS_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("OPENCORVUS_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export declare const OPENCORVUS_EXPERIMENTAL_ICON_DISCOVERY: boolean

  const copy = process.env["OPENCORVUS_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const OPENCORVUS_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("OPENCORVUS_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export declare const OPENCORVUS_ENABLE_EXA: boolean
  export const OPENCORVUS_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = positiveInteger(
    "OPENCORVUS_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS",
  )
  export const OPENCORVUS_EXPERIMENTAL_OUTPUT_TOKEN_MAX = positiveInteger("OPENCORVUS_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export declare const OPENCORVUS_EXPERIMENTAL_OXFMT: boolean
  export const OPENCORVUS_DISABLE_FILETIME_CHECK = truthy("OPENCORVUS_DISABLE_FILETIME_CHECK")
  export const OPENCORVUS_EXPERIMENTAL_MARKDOWN = truthy("OPENCORVUS_EXPERIMENTAL_MARKDOWN")
  export const OPENCORVUS_MODELS_URL = process.env["OPENCORVUS_MODELS_URL"]
  export const OPENCORVUS_MODELS_PATH = process.env["OPENCORVUS_MODELS_PATH"]
}

const DEFAULT_PROJECT_RUNTIME_CACHE_LIMIT = 4
const DEFAULT_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS = 30_000
const DEFAULT_FILESYSTEM_RENAME_ATTEMPTS = 20
const DEFAULT_FILESYSTEM_RENAME_DELAY_MS = 100

Object.defineProperty(Flag, "OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT", {
  get() {
    return positiveInteger("OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT") ?? DEFAULT_PROJECT_RUNTIME_CACHE_LIMIT
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS", {
  get() {
    return (
      positiveInteger("OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS") ?? DEFAULT_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS
    )
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_FILESYSTEM_RENAME_ATTEMPTS", {
  get() {
    return positiveInteger("OPENCORVUS_FILESYSTEM_RENAME_ATTEMPTS") ?? DEFAULT_FILESYSTEM_RENAME_ATTEMPTS
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_FILESYSTEM_RENAME_DELAY_MS", {
  get() {
    return positiveInteger("OPENCORVUS_FILESYSTEM_RENAME_DELAY_MS") ?? DEFAULT_FILESYSTEM_RENAME_DELAY_MS
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENCORVUS_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENCORVUS_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("OPENCORVUS_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENCORVUS_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENCORVUS_CONFIG_DIR", {
  get() {
    return process.env["OPENCORVUS_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENCORVUS_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "OPENCORVUS_CLIENT", {
  get() {
    return process.env["OPENCORVUS_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getters for flags with dependency chains.
// These MUST be evaluated at access time, not module load time,
// because parent flags (e.g. OPENCORVUS_DISABLE_CLAUDE_CODE) may be set after module initialization.
Object.defineProperty(Flag, "OPENCORVUS_DISABLE_CLAUDE_CODE", {
  get() {
    return truthy("OPENCORVUS_DISABLE_CLAUDE_CODE")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_DISABLE_CLAUDE_CODE_PROMPT", {
  get() {
    return Flag.OPENCORVUS_DISABLE_CLAUDE_CODE || truthy("OPENCORVUS_DISABLE_CLAUDE_CODE_PROMPT")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_DISABLE_CLAUDE_CODE_SKILLS", {
  get() {
    return Flag.OPENCORVUS_DISABLE_CLAUDE_CODE || truthy("OPENCORVUS_DISABLE_CLAUDE_CODE_SKILLS")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_DISABLE_EXTERNAL_SKILLS", {
  get() {
    return Flag.OPENCORVUS_DISABLE_CLAUDE_CODE_SKILLS || truthy("OPENCORVUS_DISABLE_EXTERNAL_SKILLS")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_EXPERIMENTAL_ICON_DISCOVERY", {
  get() {
    return Flag.OPENCORVUS_EXPERIMENTAL || truthy("OPENCORVUS_EXPERIMENTAL_ICON_DISCOVERY")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_ENABLE_EXA", {
  get() {
    return truthy("OPENCORVUS_ENABLE_EXA") || Flag.OPENCORVUS_EXPERIMENTAL || truthy("OPENCORVUS_EXPERIMENTAL_EXA")
  },
  enumerable: true,
  configurable: false,
})

Object.defineProperty(Flag, "OPENCORVUS_EXPERIMENTAL_OXFMT", {
  get() {
    return Flag.OPENCORVUS_EXPERIMENTAL || truthy("OPENCORVUS_EXPERIMENTAL_OXFMT")
  },
  enumerable: true,
  configurable: false,
})
