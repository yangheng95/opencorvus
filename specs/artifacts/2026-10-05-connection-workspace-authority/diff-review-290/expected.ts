import fs from "node:fs"
const repo = "D:/myhexin-local/opencorvus"
const file = "packages/overlay/src/components/ui/CodeEditor.tsx"
const originalRef = "b34e232acc32406d18e6cd4738c3c1d2c505ea10"
const modifiedRef = "58bdde186c9b31a5ae6cb87684771e1b6f849802"
function read(ref: string): string {
  const result = Bun.spawnSync(["git", "-C", repo, "show", `${ref}:${file}`])
  if (result.exitCode !== 0) throw new Error("Exact existing Git file version required")
  return new TextDecoder().decode(result.stdout)
}
const value = { file, originalRef, modifiedRef, original: read(originalRef), modified: read(modifiedRef) }
fs.writeFileSync(`${repo}/specs/artifacts/2026-10-05-connection-workspace-authority/diff-review-290/live-01/expected-git-files.json`, JSON.stringify(value, null, 2), { flag: "wx" })
console.log(JSON.stringify({ file, originalRef, modifiedRef, originalChars: value.original.length, modifiedChars: value.modified.length }))
