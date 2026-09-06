import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { publishJSONBarrier } from "./json-barrier"

const root = process.argv[2]
const output = process.argv[3]
if (!root || !output) throw new Error("Expected callback broker root and output path")

const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
await publishJSONBarrier(output, binding)

setInterval(() => {}, 1_000)
