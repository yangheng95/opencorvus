/** Single-line file labels keep significant spaces visible and distinguishable in accessible names. */
export function filePathLabel(path: string): string {
  if (!/(^|\/) | (?=\/|$)| {2}|[\u0000-\u001f"]/u.test(path)) return path

  return JSON.stringify(path).replace(/(^"|\/)( +)| +(?=\/|"$)| {2,}/gu, (match, prefix, leadingSpaces) => {
    const spaces = leadingSpaces ?? match
    return (prefix ?? "") + "\\u0020".repeat(spaces.length)
  })
}
