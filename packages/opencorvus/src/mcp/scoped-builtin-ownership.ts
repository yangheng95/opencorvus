import { BrowserMCPBuiltin } from "./browser/builtin"
import { ComputerMCPBuiltin } from "./computer/builtin"

const scopedBuiltinServerNames = new Set<string>([BrowserMCPBuiltin.ServerName, ComputerMCPBuiltin.ServerName])

export function partitionMcpByRuntimeOwnership<T>(configured: Readonly<Record<string, T>>) {
  const ordinary: Record<string, T> = {}
  const scopedBuiltin: Record<string, T> = {}
  for (const [serverName, declaration] of Object.entries(configured)) {
    const target = scopedBuiltinServerNames.has(serverName) ? scopedBuiltin : ordinary
    target[serverName] = declaration
  }
  return Object.freeze({
    ordinary: Object.freeze(ordinary),
    scopedBuiltin: Object.freeze(scopedBuiltin),
  })
}
