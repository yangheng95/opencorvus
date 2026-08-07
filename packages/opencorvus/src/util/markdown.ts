export function markdownList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}
