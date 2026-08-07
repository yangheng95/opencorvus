export function selectProjectDirectory(input: {
  queryDirectory?: string
  headerDirectory?: string
}): string | undefined {
  if (input.queryDirectory?.trim()) return input.queryDirectory
  if (input.headerDirectory?.trim()) return input.headerDirectory
  return undefined
}
