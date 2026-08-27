import { writeFile } from "node:fs/promises"
import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"

const root = process.argv[2]
const output = process.argv[3]
if (!root || !output) throw new Error("Expected callback broker root and output path")

const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
await writeFile(output, JSON.stringify(binding), "utf8")

setInterval(() => {}, 1_000)
