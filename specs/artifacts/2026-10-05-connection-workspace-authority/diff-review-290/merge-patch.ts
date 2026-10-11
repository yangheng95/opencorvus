import fs from "node:fs"
import path from "node:path"
const repo = "D:/myhexin-local/opencorvus"
const task = path.join(repo, ".tmp-product-iteration/diff-review-290")
const base = path.join(task, "merge-patch")
for (const side of ["original", "modified"]) fs.mkdirSync(path.join(base, side, "dist"), { recursive: true })
for (const name of ["index.js", "index.cjs"]) {
  fs.copyFileSync(path.join(task, "merge-original", name), path.join(base, "original/dist", name), fs.constants.COPYFILE_EXCL)
  fs.copyFileSync(path.join(repo, "node_modules/@codemirror/merge/dist", name), path.join(base, "modified/dist", name), fs.constants.COPYFILE_EXCL)
}
const diff = Bun.spawnSync(["git", "diff", "--no-index", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", "original", "modified"], { cwd: base })
if (diff.exitCode !== 1) throw new Error("Expected an actual package preimage diff")
const patch = new TextDecoder().decode(diff.stdout)
  .replace(/^diff --git a\/original\/(.+) b\/modified\/(.+)$/gm, "diff --git a/$1 b/$2")
  .replace(/^--- a\/original\//gm, "--- a/")
  .replace(/^\+\+\+ b\/modified\//gm, "+++ b/")
fs.writeFileSync(path.join(repo, "patches/@codemirror%2Fmerge@6.12.2.patch"), patch, { flag: "wx" })
console.log("Generated standard package patch from the preserved originals and actual edited distributions.")
