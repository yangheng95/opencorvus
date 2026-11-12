export function displayMcpName(name: string): string {
  return name && name === name.trim() ? name : JSON.stringify(name)
}
