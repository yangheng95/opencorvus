import { expect, spyOn, test } from "bun:test"
import { Global } from "@/global"
import { McpAuth } from "@/mcp/auth"
import { Filesystem } from "@/util/filesystem"
import { tmpdir } from "../fixture/fixture"

const PROJECT = "project-credential-names"
const OTHER = "project-other-credential-names"
const NORMAL = "review"
const PADDED = " review "
const URL = "https://mcp.example.test/tools"
const ISSUER = "https://issuer.example.test"
const IDENTITY = "configured-resource"
const GENERATION = "fixture-broker-generation"
const admitted = async () => {}

function scope(mcpName: string, projectID = PROJECT) {
  return McpAuth.scopedKey({ projectID, mcpName })
}

test("credential scope round-trips the project and every exact connection name", () => {
  const scopes = [
    { projectID: PROJECT, mcpName: NORMAL },
    { projectID: PROJECT, mcpName: PADDED },
    { projectID: PROJECT, mcpName: "" },
    { projectID: PROJECT, mcpName: " :service: " },
    { projectID: OTHER, mcpName: NORMAL },
  ]
  const keys = scopes.map(McpAuth.scopedKey)
  expect(new Set(keys).size).toBe(scopes.length)
  expect(keys.map(McpAuth.parseScopedKey)).toEqual(scopes)
})

test("a unique legacy binding moves its entire occurrence to the exact name once", async () => {
  await using profile = await tmpdir()
  await Global.provideRoot(profile.path, async () => {
    const legacyKey = `${PROJECT}:${NORMAL}`
    const otherKey = `${OTHER}:${NORMAL}`
    const migrated = {
      serverUrl: URL,
      credentialIdentity: IDENTITY,
      revision: await McpAuth.ensureRevision(legacyKey),
      clientInfo: { clientId: "legacy-client", issuer: ISSUER },
      oauthState: "legacy-pending",
      codeVerifier: "fixture-pkce",
      callbackGeneration: GENERATION,
      callbackRedirectUrl: "http://127.0.0.1:19876/mcp/oauth/callback",
    }
    const stored = { revision: await McpAuth.ensureRevision(otherKey), tokens: { accessToken: "other-fixture" } }
    await McpAuth.set(legacyKey, migrated)
    await McpAuth.set(otherKey, stored)
    const definitions = [
      { mcpName: NORMAL, serverUrl: URL, credentialIdentity: "different-configured-resource" },
      { mcpName: PADDED, serverUrl: URL, credentialIdentity: IDENTITY },
    ]
    await Promise.all([
      McpAuth.migrateProjectNames(PROJECT, definitions, admitted),
      McpAuth.migrateProjectNames(PROJECT, definitions, admitted),
    ])
    expect(await McpAuth.all()).toEqual({
      [scope(PADDED)]: migrated,
      [otherKey]: stored,
    })
    expect(await McpAuth.findOAuthState("legacy-pending", GENERATION)).toMatchObject({
      authKey: scope(PADDED),
      projectID: PROJECT,
      phase: "pending",
      entry: { revision: migrated.revision },
    })
  })
})

test("ambiguous legacy credentials retain historical material and publish exact callback terminals", async () => {
  await using profile = await tmpdir()
  await Global.provideRoot(profile.path, async () => {
    const legacyKey = `${PROJECT}:${NORMAL}`
    const finishingKey = `${PROJECT}:finishing`
    const credentials = {
      serverUrl: URL,
      credentialIdentity: IDENTITY,
      tokens: { accessToken: "legacy-fixture", issuer: ISSUER },
      tokenClientInfo: { clientId: "legacy-client", issuer: ISSUER },
    }
    await McpAuth.set(legacyKey, {
      ...credentials,
      revision: await McpAuth.ensureRevision(legacyKey),
      callbackGeneration: GENERATION,
      oauthState: "ambiguous-pending",
      codeVerifier: "legacy-verifier",
    })
    await McpAuth.set(finishingKey, {
      ...credentials,
      revision: await McpAuth.ensureRevision(finishingKey),
      callbackGeneration: GENERATION,
      oauthFinishing: { oauthState: "ambiguous-finishing", ownerID: "lost-finisher", leaseExpiresAt: Date.now() + 30_000 },
    })
    const current = {
      revision: await McpAuth.ensureRevision(scope(PADDED)),
      tokens: { accessToken: "exact-fixture", issuer: ISSUER },
    }
    await McpAuth.set(scope(PADDED), current)
    const definitions = [NORMAL, PADDED, "finishing", " finishing "].map((mcpName) => ({
      mcpName, serverUrl: URL, credentialIdentity: IDENTITY,
    }))
    await McpAuth.migrateProjectNames(PROJECT, definitions, admitted)

    const retired = await McpAuth.get(legacyKey)
    const finishing = await McpAuth.get(finishingKey)
    expect(retired).toMatchObject({ legacyOwnerRetired: true, legacyCredentialArchive: credentials })
    expect(finishing).toMatchObject({ legacyOwnerRetired: true, legacyCredentialArchive: credentials })
    expect(await McpAuth.get(scope(PADDED))).toEqual(current)
    const terminals = await Promise.all([
      McpAuth.findOAuthCallbackTerminal("ambiguous-pending", GENERATION),
      McpAuth.findOAuthCallbackTerminal("ambiguous-finishing", GENERATION),
    ])
    expect(terminals.map((item) => item?.outcome)).toEqual(["revoked", "exchange_uncertain"])
    await McpAuth.removeProject(PROJECT)
    expect(await McpAuth.all()).toEqual({
      [legacyKey]: {
        legacyOwnerRetired: true,
        revision: expect.any(String),
        oauthCallbackTerminals: { "ambiguous-pending": terminals[0] },
      },
      [finishingKey]: {
        legacyOwnerRetired: true,
        revision: expect.any(String),
        oauthCallbackTerminals: { "ambiguous-finishing": terminals[1] },
      },
    })
  })
})

test("a committed migration write settles the staged credential after a lost receipt", async () => {
  await using profile = await tmpdir()
  await Global.provideRoot(profile.path, async () => {
    const legacyKey = `${PROJECT}:${NORMAL}`
    const currentKey = scope(PADDED)
    const binding = { serverUrl: URL, credentialIdentity: IDENTITY }
    await McpAuth.stageStaticCredential(legacyKey, "fixture-static", URL, IDENTITY)
    const originalWrite = Filesystem.writeAtomic
    const lostReceipt = spyOn(Filesystem, "writeAtomic").mockImplementationOnce(async (...args) => {
      await originalWrite(...args)
      throw new Error("Fixture lost the migration write receipt")
    })
    try {
      await McpAuth.migrateProjectNames(PROJECT, [{ mcpName: PADDED, ...binding }], admitted)
    } finally {
      lostReceipt.mockRestore()
    }
    expect(await McpAuth.promoteStagedStaticCredential(currentKey, binding)).toBe(true)
    expect((await McpAuth.readForUrl(currentKey, URL, IDENTITY)).credentials).toEqual({
      ...binding,
      staticCredential: { secret: "fixture-static" },
    })
  })
})
