export function unwrapCommandQuotes(value: string): string {
  let next = value.trim()
  while (next.length >= 2) {
    const first = next[0]
    const last = next[next.length - 1]
    if (!((first === "'" && last === "'") || (first === '"' && last === '"'))) break
    next = next.slice(1, -1).trim()
  }
  return next
}

export function normalizeExecutableArgv(command: string[]): string[] {
  if (command.length === 0) return command
  const [executable, ...args] = command
  return [unwrapCommandQuotes(executable), ...args]
}
