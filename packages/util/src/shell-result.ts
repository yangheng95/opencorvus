/** The real command result belongs in the Tool's visible body as well as its
 * structured metadata. Keep it at the tail so normal output truncation retains
 * the observed exit outcome for both live model input and historical replay. */
export function shellResultOutput(output: string, exitCode: number | null, details: readonly string[] = []): string {
  const metadata = [`exit code: ${exitCode === null ? "unavailable" : exitCode}`, ...details]
  return `${output ? `${output}\n\n` : ""}<bash_metadata>\n${metadata.join("\n")}\n</bash_metadata>`
}

/** Read a result whose only appended detail is the confirmed exit code. */
export function shellCommandOutput(result: string, exitCode: number): string {
  const receipt = shellResultOutput("", exitCode)
  if (result === receipt) return ""
  const suffix = `\n\n${receipt}`
  return result.endsWith(suffix) ? result.slice(0, -suffix.length) : result
}
