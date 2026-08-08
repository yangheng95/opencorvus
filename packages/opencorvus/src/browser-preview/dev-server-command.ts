import { canonicalBrowserPreviewUrl } from "./url-identity"

const FRONTEND_PACKAGE_MANAGERS = new Set(["npm", "pnpm", "bun", "yarn"])
const FRONTEND_EXEC_COMMANDS = new Set(["npx", "bunx"])
const PACKAGE_MANAGER_EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"])
const FRONTEND_SERVER_SCRIPTS = new Set(["dev", "start", "serve", "preview"])
const DIRECT_FRONTEND_SERVER_COMMANDS = new Set([
  "astro",
  "next",
  "nuxt",
  "remix",
  "rsbuild",
  "svelte-kit",
  "vite",
  "vitepress",
  "webpack-dev-server",
])
const DIRECT_FRONTEND_SERVE_ONLY_COMMANDS = new Set(["angular", "ng"])
const DIRECT_FRONTEND_NON_SERVER_SUBCOMMANDS = new Set(["build", "check", "info", "lint", "test", "typecheck"])
const DIRECT_FRONTEND_INFORMATION_FLAGS = new Set(["--help", "--version", "-h", "-v"])
const OPTION_TAKES_VALUE = new Set([
  "-c",
  "-C",
  "-w",
  "--cwd",
  "--dir",
  "--filter",
  "--prefix",
  "--scope",
  "--workspace",
])
const COMMAND_SEPARATORS = new Set([";", "&", "&&", "||", "\n"])

export function isFrontendDevServerCommandTokens(tokens: string[]): boolean {
  const executable = normalizeCommandToken(tokens[0] ?? "")
  if (!executable) return false

  if (FRONTEND_EXEC_COMMANDS.has(executable)) {
    const targetIndex = firstCommandArgumentIndex(tokens, 1)
    return targetIndex !== -1 && isDirectFrontendServerCommand(tokens.slice(targetIndex))
  }

  if (isDirectFrontendServerCommand(tokens)) return true
  if (!FRONTEND_PACKAGE_MANAGERS.has(executable)) return false

  const subcommandIndex = firstCommandArgumentIndex(tokens, 1)
  if (subcommandIndex === -1) return false
  const subcommand = normalizeCommandToken(tokens[subcommandIndex])

  if (subcommand === "run") {
    const script = commandArgument(tokens, subcommandIndex + 1)
    return script !== undefined && FRONTEND_SERVER_SCRIPTS.has(script)
  }

  if (PACKAGE_MANAGER_EXEC_SUBCOMMANDS.has(subcommand)) {
    const targetIndex = firstCommandArgumentIndex(tokens, subcommandIndex + 1)
    return targetIndex !== -1 && isDirectFrontendServerCommand(tokens.slice(targetIndex))
  }

  return FRONTEND_SERVER_SCRIPTS.has(subcommand)
}

export function deriveBrowserPreviewUrlsFromDevServerCommand(command: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const tokens of shellCommandTokenGroups(command)) {
    if (!isFrontendDevServerCommandTokens(tokens)) continue
    const port = optionValue(tokens, ["--port", "-p"])
    if (!port || !validPort(port)) continue
    const host = browserReachableHost(optionValue(tokens, ["--host", "-H"]))
    const normalized = canonicalBrowserPreviewUrl(`${host}:${port}`)
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
  }
  return urls
}

export function normalizeCommandToken(value: string) {
  const stripped = stripShellQuotes(value).split(/[\\/]/).pop() ?? ""
  return stripped.replace(/\.(?:cmd|exe|ps1)$/i, "").toLowerCase()
}

function firstCommandArgumentIndex(tokens: string[], start: number) {
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index]
    if (!token || token === "--") continue
    if (!token.startsWith("-")) return index
    const normalized = normalizeCommandToken(token)
    if (!token.includes("=") && OPTION_TAKES_VALUE.has(normalized)) index++
  }
  return -1
}

function commandArgument(tokens: string[], start: number) {
  const index = firstCommandArgumentIndex(tokens, start)
  return index === -1 ? undefined : normalizeCommandToken(tokens[index])
}

function isDirectFrontendServerCommand(tokens: string[]) {
  const executable = normalizeCommandToken(tokens[0] ?? "")
  if (!executable) return false
  if (tokens.slice(1).some((token) => DIRECT_FRONTEND_INFORMATION_FLAGS.has(normalizeCommandToken(token)))) return false
  const subcommand = commandArgument(tokens, 1)
  if (DIRECT_FRONTEND_SERVE_ONLY_COMMANDS.has(executable)) return subcommand === "serve"
  if (!DIRECT_FRONTEND_SERVER_COMMANDS.has(executable)) return false
  if (!subcommand) return true
  return !DIRECT_FRONTEND_NON_SERVER_SUBCOMMANDS.has(subcommand)
}

function optionValue(tokens: string[], names: string[]): string | undefined {
  const normalizedNames = new Set(names.map((name) => normalizeCommandToken(name)))
  for (let index = 0; index < tokens.length; index++) {
    const token = stripShellQuotes(tokens[index] ?? "")
    const equals = token.indexOf("=")
    if (equals > 0) {
      const name = normalizeCommandToken(token.slice(0, equals))
      if (normalizedNames.has(name)) return stripShellQuotes(token.slice(equals + 1))
      continue
    }
    const name = normalizeCommandToken(token)
    if (!normalizedNames.has(name)) continue
    const next = tokens[index + 1]
    if (!next || next.startsWith("-")) return undefined
    return stripShellQuotes(next)
  }
  return undefined
}

function validPort(value: string): boolean {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port <= 65535
}

function browserReachableHost(value: string | undefined): string {
  const host = stripShellQuotes(value ?? "").trim()
  if (!host || host === "0.0.0.0" || host === "::" || host === "*") return "127.0.0.1"
  if (host === "::1") return "[::1]"
  return host
}

function shellCommandTokenGroups(command: string): string[][] {
  const groups: string[][] = []
  let current: string[] = []
  for (const token of shellTokens(command)) {
    if (COMMAND_SEPARATORS.has(token)) {
      if (current.length > 0) groups.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function shellTokens(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | undefined
  for (let index = 0; index < command.length; index++) {
    const char = command[index]
    if (quote) {
      if (char === quote) {
        quote = undefined
      } else {
        current += char
      }
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === "\r") continue
    if (char === "\n" || /\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      if (char === "\n") tokens.push("\n")
      continue
    }
    if (char === ";" || char === "&" || char === "|") {
      if (current) {
        tokens.push(current)
        current = ""
      }
      const next = command[index + 1]
      if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
        tokens.push(char + next)
        index++
      } else {
        tokens.push(char)
      }
      continue
    }
    current += char
  }
  if (current) tokens.push(current)
  return tokens
}

function stripShellQuotes(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}
