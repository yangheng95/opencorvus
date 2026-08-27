import { writeFile } from "node:fs/promises"
import { Global } from "../../src/global"
import { McpAuth } from "../../src/mcp/auth"

const [root, authKey, oauthState, revision, output, leaseDuration] = process.argv.slice(2)
if (!root || !authKey || !oauthState || !revision || !output || !leaseDuration) {
  throw new Error("Expected root, auth key, OAuth state, revision, output and lease duration")
}

await Global.provideRoot(root, async () => {
  const spent = await McpAuth.spendOAuthState(
    authKey,
    oauthState,
    revision,
    crypto.randomUUID(),
    Date.now() + Number(leaseDuration),
  )
  if (!spent) throw new Error("Finishing worker could not spend the durable OAuth state")
})
await writeFile(output, JSON.stringify({ spent: true }), "utf8")
setInterval(() => {}, 1_000)
