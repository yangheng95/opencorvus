import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"

const WINDOWS_NODE_COPY = String.raw`
const fs = require("node:fs")
fs.copyFileSync(process.argv[1], process.argv[2])
`

export async function copyReleaseFile(source: string, destination: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  if (process.platform === "win32") {
    execFileSync("node", ["-e", WINDOWS_NODE_COPY, source, destination], { windowsHide: true })
    return
  }
  await fs.copyFile(source, destination)
}
