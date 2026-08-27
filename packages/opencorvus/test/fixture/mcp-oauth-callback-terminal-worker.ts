import { Global } from "../../src/global"
import { McpAuth } from "../../src/mcp/auth"

const [root, authKey, oauthState, revision, requestedOutcome] = process.argv.slice(2)
if (!root || !authKey || !oauthState || !revision) {
  throw new Error("Expected root, auth key, OAuth state and revision")
}

await Global.provideRoot(root, async () => {
  const ownerID = (await McpAuth.get(authKey))?.oauthFinishing?.ownerID
  if (!ownerID) throw new Error("Durable finishing owner is unavailable")
  const outcome = McpAuth.OAuthCallbackTerminal.shape.outcome.parse(requestedOutcome ?? "connected")
  await McpAuth.publishOAuthCallbackTerminal(authKey, oauthState, outcome, revision, ownerID)
})
