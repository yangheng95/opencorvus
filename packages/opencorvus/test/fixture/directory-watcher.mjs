// Real per-directory Windows watch handles, like a development-server watcher.
// No browser, page, rendering assertion or UI automation participates here.
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

const root = process.argv[2]
const watchers = new Map()
function scan(directory = root) {
  let entries
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
    if (!watchers.has(directory)) {
      watchers.set(
        directory,
        fs.watch(directory, () => scan(directory)),
      )
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    watchers.get(directory)?.close()
    watchers.delete(directory)
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) scan(path.join(directory, entry.name))
  }
}
function ready() {
  scan()
  process.stdout.write("ready\n")
}
ready()
const input = readline.createInterface({ input: process.stdin })
input.on("line", ready)
input.on("close", () => {
  for (const watcher of watchers.values()) watcher.close()
})
