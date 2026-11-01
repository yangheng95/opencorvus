const TEXT_APP_MIMES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/x-toml",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
  "application/x-shellscript",
  "application/sql",
])

const TEXT_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "java",
  "rb",
  "sh",
  "bat",
  "ps1",
  "html",
  "css",
  "scss",
  "less",
  "sql",
  "toml",
  "yaml",
  "yml",
  "json",
  "xml",
  "csv",
  "log",
  "md",
  "markdown",
  "txt",
  "rst",
])

/**
 * Returns true if the MIME type (+ optional filename) represents text content
 * that should be decoded and injected as readable text, rather than passed as
 * a binary file part to the model.
 */
export function isDecodableText(mime: string, filename?: string): boolean {
  const normalizedMime = mime.split(";", 1)[0].trim().toLowerCase()
  if (normalizedMime.startsWith("text/")) return true
  if (TEXT_APP_MIMES.has(normalizedMime)) return true
  if (normalizedMime.endsWith("+json") || normalizedMime.endsWith("+xml")) return true
  if (normalizedMime === "application/octet-stream" && filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? ""
    return TEXT_EXTS.has(ext)
  }
  return false
}
