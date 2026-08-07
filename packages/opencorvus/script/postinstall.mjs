#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { resolveInstalledBinaryPath, resolveOptionalBinarySourcePath } from "./published-package-bin.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const wrapperRoot = path.dirname(__dirname)

async function main() {
  const source = resolveOptionalBinarySourcePath(import.meta.url)
  if (!fs.existsSync(source.sourceBinaryPath)) {
    throw new Error(`Binary not found at ${source.sourceBinaryPath}`)
  }

  const target = resolveInstalledBinaryPath(wrapperRoot)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source.sourceBinaryPath, target)
  if (process.platform !== "win32") fs.chmodSync(target, 0o755)
  console.log(`opencorvus binary installed: ${target}`)
}

try {
  await main()
} catch (error) {
  console.error("Failed to setup opencorvus binary:", error instanceof Error ? error.message : String(error))
  process.exit(1)
}
