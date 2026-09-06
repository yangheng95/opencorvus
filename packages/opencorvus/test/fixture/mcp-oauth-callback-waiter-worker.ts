import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { publishJSONBarrier } from "./json-barrier"

const [root, authKey, oauthState, correlationID, output] = process.argv.slice(2)
if (!root || !authKey || !oauthState || !correlationID || !output) {
  throw new Error("Expected root, auth key, OAuth state, correlation ID and output path")
}

const settlement = await Global.provideRoot(root, () =>
  McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, correlationID),
)
await publishJSONBarrier(
  output,
  settlement.status === "fulfilled"
    ? settlement
    : { status: settlement.status, error: { message: settlement.error.message } },
)
