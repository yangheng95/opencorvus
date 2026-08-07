export function formatVersionLabel(version: string) {
  return `v${version.replace(/^(\d+\.\d+\.\d+)-/, "$1")}`
}
