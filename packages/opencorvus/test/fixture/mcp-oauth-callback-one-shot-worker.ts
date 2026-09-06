import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { publishJSONBarrier } from "./json-barrier"

const [root, output] = process.argv.slice(2)
if (!root || !output) throw new Error("Expected callback broker root and output path")

const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
await publishJSONBarrier(output, binding)
