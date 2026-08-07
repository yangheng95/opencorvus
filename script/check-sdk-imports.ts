import path from "path"
import { findDeprecatedSdkIdentifiers } from "./deprecated-sdk-identifiers"

const root = path.resolve(import.meta.dir, "..")
const exts = [".ts", ".tsx", ".mts", ".cts"]
const issues: Array<{ file: string; line: number; text: string }> = []

const patterns = exts.flatMap((ext) => [
  `packages/*/*${ext}`,
  `packages/*/src/**/*${ext}`,
  `packages/*/script/**/*${ext}`,
  `script/**/*${ext}`,
])

for (const pattern of patterns) {
  for await (const item of new Bun.Glob(pattern).scan({ cwd: root, absolute: true })) {
    const file = item.toString()
    const normalized = file.replaceAll("\\", "/")
    if (normalized.endsWith("/script/check-sdk-imports.ts")) continue
    if (normalized.includes("/node_modules/")) continue
    if (normalized.includes("/dist/")) continue
    if (normalized.includes("/test/")) continue

    const source = await Bun.file(file).text()
    for (const issue of findDeprecatedSdkIdentifiers(source, file)) {
      issues.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        ...issue,
      })
    }
  }
}

if (issues.length === 0) {
  console.log("sdk import check passed (OpenCorvusClient)")
  process.exit(0)
}

console.error("deprecated SDK symbol found. use OpenCorvusClient/createOpenCorvus*")
for (const issue of issues) {
  console.error(`${issue.file}:${issue.line} ${issue.text}`)
}
process.exit(1)
