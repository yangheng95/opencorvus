import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  generateKeyPairSync,
  sign,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto"
import { WhatsappAdapter } from "../src/adapters/whatsapp"
import { GoogleChatAdapter } from "../src/adapters/googlechat"
import { MSTeamsAdapter } from "../src/adapters/msteams"
import { LineAdapter } from "../src/adapters/line"
import { MatrixAdapter } from "../src/adapters/matrix"
import { MattermostAdapter } from "../src/adapters/mattermost"
import { SignalAdapter } from "../src/adapters/signal"
import { WeComAdapter } from "../src/adapters/wecom"
import { DingTalkAdapter } from "../src/adapters/dingtalk"

type ServeOpts = {
  hostname?: string
  port?: number
  fetch: (req: Request) => Response | Promise<Response>
}

type Server = {
  hostname: string
  port: number
  stop: (force?: boolean) => void
}

function stub() {
  let route: ((req: Request) => Response | Promise<Response>) | undefined
  return {
    serve(opts: ServeOpts) {
      route = opts.fetch
      return {
        hostname: "127.0.0.1",
        port: 19999,
        stop() {},
      } as Server
    },
    route() {
      if (!route) throw new Error("route not ready")
      return route
    },
  }
}

function lineSignedRequest(body: unknown, secret: string) {
  const raw = JSON.stringify(body)
  return new Request("http://127.0.0.1:19999/line", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": createHmac("sha256", secret).update(raw).digest("base64"),
    },
    body: raw,
  })
}

function whatsappSignedRequest(body: unknown, appSecret: string, signature?: string) {
  const raw = JSON.stringify(body)
  return new Request("http://127.0.0.1:19999/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature ?? `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`,
    },
    body: raw,
  })
}

const callbackAesKey = Buffer.from("0123456789abcdefghijklmnopqrstuv").toString("base64").slice(0, 43)

function callbackKey(encodingAesKey: string) {
  return Buffer.from(`${encodingAesKey}=`, "base64")
}

function pad32(value: Buffer) {
  const remainder = value.length % 32
  const padding = remainder === 0 ? 32 : 32 - remainder
  return Buffer.concat([value, Buffer.alloc(padding, padding)])
}

function callbackEncrypt(message: string, receiveId: string, encodingAesKey = callbackAesKey) {
  const key = callbackKey(encodingAesKey)
  const length = Buffer.alloc(4)
  const body = Buffer.from(message)
  length.writeUInt32BE(body.length)
  const plain = pad32(Buffer.concat([Buffer.from("abcdefghijklmnop"), length, body, Buffer.from(receiveId)]))
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16))
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64")
}

function callbackDecrypt(encrypted: string, receiveId: string, encodingAesKey = callbackAesKey) {
  const key = callbackKey(encodingAesKey)
  const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16))
  decipher.setAutoPadding(false)
  const decrypted = Buffer.concat([decipher.update(encrypted, "base64"), decipher.final()])
  const padding = decrypted.at(-1)!
  const unpadded = decrypted.subarray(0, decrypted.length - padding)
  const length = unpadded.readUInt32BE(16)
  const message = unpadded.subarray(20, 20 + length)
  expect(unpadded.subarray(20 + length).toString()).toBe(receiveId)
  return message.toString()
}

function callbackSigned(token: string, timestamp: string, nonce: string, encrypted: string) {
  return createHash("sha1").update([token, timestamp, nonce, encrypted].sort().join("")).digest("hex")
}

function encryptedCallbackJson(
  url: string,
  body: Record<string, unknown>,
  opts: { receiveId: string; token: string; encodingAesKey?: string; signature?: string },
) {
  const timestamp = "1710000000"
  const nonce = "nonce-1"
  const encrypted = callbackEncrypt(JSON.stringify(body), opts.receiveId, opts.encodingAesKey)
  const signature = opts.signature ?? callbackSigned(opts.token, timestamp, nonce, encrypted)
  return new Request(`${url}?timestamp=${timestamp}&nonce=${nonce}&signature=${signature}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ encrypt: encrypted }),
  })
}

function encryptedCallbackXml(
  url: string,
  xml: string,
  opts: { receiveId: string; token: string; encodingAesKey?: string; signature?: string; method?: string },
) {
  const timestamp = "1710000000"
  const nonce = "nonce-1"
  const encrypted = callbackEncrypt(xml, opts.receiveId, opts.encodingAesKey)
  const signature = opts.signature ?? callbackSigned(opts.token, timestamp, nonce, encrypted)
  const params = `timestamp=${timestamp}&nonce=${nonce}&msg_signature=${signature}`
  if (opts.method === "GET") {
    return new Request(`${url}?${params}&echostr=${encodeURIComponent(encrypted)}`)
  }
  return new Request(`${url}?${params}`, {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body: `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`,
  })
}

function b64url(raw: Buffer | string) {
  const source: Buffer = typeof raw === "string" ? Buffer.from(raw) : raw
  return source.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function jwtSegment(raw: unknown) {
  return b64url(JSON.stringify(raw))
}

function msTeamsAuthFixture(appId: string, serviceUrl = "https://smba.trafficmanager.net/emea") {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const kid = "ms-key-1"
  const publicJwk = pair.publicKey.export({ format: "jwk" }) as JsonWebKey & {
    kid?: string
    use?: string
    alg?: string
    endorsements?: string[]
  }
  publicJwk.kid = kid
  publicJwk.use = "sig"
  publicJwk.alg = "RS256"
  publicJwk.endorsements = ["msteams"]

  const auth = (
    overrides: {
      audience?: string
      serviceUrl?: string
      issuer?: string
      expiresIn?: number
      privateKey?: KeyObject
    } = {},
  ) => {
    const now = Math.floor(Date.now() / 1000)
    const header = jwtSegment({ alg: "RS256", typ: "JWT", kid })
    const payload = jwtSegment({
      iss: overrides.issuer ?? "https://api.botframework.com",
      aud: overrides.audience ?? appId,
      iat: now,
      nbf: now - 60,
      exp: now + (overrides.expiresIn ?? 3600),
      serviceUrl: overrides.serviceUrl ?? serviceUrl,
    })
    const input = `${header}.${payload}`
    const signature = sign("RSA-SHA256", Buffer.from(input), overrides.privateKey ?? pair.privateKey)
    return `Bearer ${input}.${b64url(signature)}`
  }

  return {
    publicJwk,
    auth,
  }
}

function withoutEndorsements(jwk: JsonWebKey) {
  const clone = { ...(jwk as Record<string, unknown>) }
  delete clone.endorsements
  return clone as JsonWebKey
}

function msTeamsFetch(publicJwk: JsonWebKey, calls: string[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes(".well-known/openidconfiguration")) {
      return Response.json({
        issuer: "https://api.botframework.com",
        jwks_uri: "https://login.botframework.com/keys",
      })
    }
    if (url === "https://login.botframework.com/keys") {
      return Response.json({ keys: [publicJwk] })
    }
    if (url.includes("oauth2/v2.0/token")) {
      return Response.json({ access_token: "ms_token", expires_in: 3600 })
    }
    return Response.json({ id: "reply-1" })
  }) as typeof globalThis.fetch
}

function googleChatAuthFixture(audience: string) {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const kid = "google-chat-key-1"
  const publicJwk = pair.publicKey.export({ format: "jwk" }) as JsonWebKey & {
    kid?: string
    use?: string
    alg?: string
  }
  publicJwk.kid = kid
  publicJwk.use = "sig"
  publicJwk.alg = "RS256"

  const auth = (
    overrides: {
      audience?: string
      email?: string
      emailVerified?: boolean
      expiresIn?: number
      privateKey?: KeyObject
    } = {},
  ) => {
    const now = Math.floor(Date.now() / 1000)
    const header = jwtSegment({ alg: "RS256", typ: "JWT", kid })
    const payload = jwtSegment({
      iss: "https://accounts.google.com",
      aud: overrides.audience ?? audience,
      iat: now,
      nbf: now - 60,
      exp: now + (overrides.expiresIn ?? 3600),
      email: overrides.email ?? "chat@system.gserviceaccount.com",
      email_verified: overrides.emailVerified ?? true,
    })
    const input = `${header}.${payload}`
    const signature = sign("RSA-SHA256", Buffer.from(input), overrides.privateKey ?? pair.privateKey)
    return `Bearer ${input}.${b64url(signature)}`
  }

  return {
    publicJwk,
    auth,
  }
}

function googleChatFetch(publicJwk: JsonWebKey, calls: string[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes("oauth2/v3/certs")) {
      return Response.json({ keys: [publicJwk] })
    }
    if (url.includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "g_token", expires_in: 3600 })
    }
    return Response.json({ name: "spaces/AAA/messages/m2" })
  }) as typeof globalThis.fetch
}

let oldFetch: typeof globalThis.fetch

beforeEach(() => {
  oldFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = oldFetch
})

describe("mainstream adapters", () => {
  test("whatsapp handles webhook and outbound send", async () => {
    const s = stub()
    const appSecret = "wa_app_secret"
    const adapter = new WhatsappAdapter({
      token: "wa_token",
      numberId: "wa_number",
      appSecret,
      verifyToken: "check",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const challenge = await s.route()(
      new Request("http://127.0.0.1:19999/whatsapp?hub.mode=subscribe&hub.verify_token=check&hub.challenge=abc"),
    )
    expect(await challenge.text()).toBe("abc")

    const inbound = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid.1",
                    from: "15550001",
                    type: "text",
                    text: { body: "hello" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    const ok = await s.route()(whatsappSignedRequest(inbound, appSecret))
    expect(ok.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "whatsapp",
      channel: "15550001",
      thread: "wamid.1",
      user: "15550001",
      text: "hello",
    })

    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Response.json({ messages: [{ id: "wamid.out" }] })
    }) as typeof globalThis.fetch
    await adapter.sendMessage("15550001", "wamid.1", "done")
    expect(calls[0]).toContain("/wa_number/messages")
  })

  test("whatsapp requires verify token and valid webhook signature before dispatch", async () => {
    const s = stub()
    const appSecret = "wa_app_secret"
    const adapter = new WhatsappAdapter({
      token: "wa_token",
      numberId: "wa_number",
      appSecret,
      verifyToken: "check",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const wrongChallenge = await s.route()(
      new Request("http://127.0.0.1:19999/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc"),
    )
    expect(wrongChallenge.status).toBe(401)

    const inbound = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid.1",
                    from: "15550001",
                    type: "text",
                    text: { body: "hello" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    const unsigned = await s.route()(
      new Request("http://127.0.0.1:19999/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inbound),
      }),
    )
    const wrongSignature = await s.route()(whatsappSignedRequest(inbound, appSecret, "sha256=deadbeef"))
    const valid = await s.route()(whatsappSignedRequest(inbound, appSecret))

    expect(unsigned.status).toBe(401)
    expect(wrongSignature.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  test("googlechat maps inbound and sends outbound with service account", async () => {
    const key = generateKeyPairSync("rsa", { modulusLength: 1024 })
      .privateKey.export({ type: "pkcs1", format: "pem" })
      .toString()
    const s = stub()
    const audience = "https://public.opencorvus.dev/googlechat"
    const auth = googleChatAuthFixture(audience)
    const calls: string[] = []
    globalThis.fetch = googleChatFetch(auth.publicJwk, calls)
    const adapter = new GoogleChatAdapter({
      serviceAccount: JSON.stringify({
        client_email: "bot@example.iam.gserviceaccount.com",
        private_key: key,
      }),
      authAudience: audience,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const event = {
      type: "MESSAGE",
      space: { name: "spaces/AAA" },
      message: {
        name: "spaces/AAA/messages/msg-1",
        thread: { name: "spaces/AAA/threads/t-1" },
        sender: { name: "users/123" },
        text: "run task",
      },
    }
    await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth.auth(),
        },
        body: JSON.stringify(event),
      }),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "googlechat",
      channel: "spaces/AAA",
      thread: "spaces/AAA/threads/t-1",
      user: "users/123",
      text: "run task",
    })

    await adapter.sendMessage("spaces/AAA", "spaces/AAA/threads/t-1", "done")
    expect(calls.some((item) => item.includes("oauth2/v3/certs"))).toBe(true)
    expect(calls.some((item) => item.includes("oauth2.googleapis.com/token"))).toBe(true)
    expect(calls.some((item) => item.includes("/v1/spaces/AAA/messages"))).toBe(true)
  })

  test("googlechat requires a valid Google request token before dispatch", async () => {
    const key = generateKeyPairSync("rsa", { modulusLength: 1024 })
      .privateKey.export({ type: "pkcs1", format: "pem" })
      .toString()
    const s = stub()
    const audience = "https://public.opencorvus.dev/googlechat"
    const auth = googleChatAuthFixture(audience)
    globalThis.fetch = googleChatFetch(auth.publicJwk, [])
    const adapter = new GoogleChatAdapter({
      serviceAccount: JSON.stringify({
        client_email: "bot@example.iam.gserviceaccount.com",
        private_key: key,
      }),
      authAudience: audience,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const event = {
      type: "MESSAGE",
      space: { name: "spaces/AAA" },
      message: {
        name: "spaces/AAA/messages/msg-1",
        sender: { name: "users/123" },
        text: "run task",
      },
    }
    const body = JSON.stringify(event)
    const unsigned = await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    )
    const wrongAudience = await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth.auth({ audience: "https://other.example.com/googlechat" }),
        },
        body,
      }),
    )
    const wrongSender = await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth.auth({ email: "attacker@example.com" }),
        },
        body,
      }),
    )
    const unverifiedEmail = await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth.auth({ emailVerified: false }),
        },
        body,
      }),
    )
    const valid = await s.route()(
      new Request("http://127.0.0.1:19999/googlechat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth.auth(),
        },
        body,
      }),
    )

    expect(unsigned.status).toBe(401)
    expect(wrongAudience.status).toBe(401)
    expect(wrongSender.status).toBe(401)
    expect(unverifiedEmail.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  test("googlechat sends screenshot cards from a public image URL", async () => {
    const key = generateKeyPairSync("rsa", { modulusLength: 1024 })
      .privateKey.export({ type: "pkcs1", format: "pem" })
      .toString()
    const adapter = new GoogleChatAdapter({
      serviceAccount: JSON.stringify({
        client_email: "bot@example.iam.gserviceaccount.com",
        private_key: key,
      }),
      authAudience: "https://public.opencorvus.dev/googlechat",
    })
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({
        url,
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "g_token", expires_in: 3600 })
      }
      return Response.json({ name: "spaces/AAA/messages/m2" })
    }) as typeof globalThis.fetch

    await adapter.uploadImageUrl?.(
      "spaces/AAA",
      "spaces/AAA/threads/t-1",
      "https://public.opencorvus.dev/overlay.png",
      "overlay.png",
      "Captured OpenCorvus GUI.",
    )

    const payload = JSON.parse(calls.at(-1)!.body!) as {
      thread?: { name?: string }
      cardsV2?: Array<{ card?: { sections?: Array<{ widgets?: Array<Record<string, unknown>> }> } }>
    }
    expect(payload.thread?.name).toBe("spaces/AAA/threads/t-1")
    const widgets = payload.cardsV2?.[0]?.card?.sections?.[0]?.widgets ?? []
    expect(widgets.some((item) => "image" in item)).toBe(true)
  })

  test("msteams maps inbound and can reply", async () => {
    const s = stub()
    const fixture = msTeamsAuthFixture("bot-app")
    const calls: string[] = []
    globalThis.fetch = msTeamsFetch(fixture.publicJwk, calls)
    const adapter = new MSTeamsAdapter({
      appId: "bot-app",
      appSecret: "bot-secret",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()
    await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth(),
        },
        body: JSON.stringify({
          type: "message",
          channelId: "msteams",
          id: "m-1",
          text: "hello",
          serviceUrl: "https://smba.trafficmanager.net/emea",
          conversation: { id: "conv-1" },
          from: { id: "user-1" },
        }),
      }),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "msteams",
      channel: "conv-1",
      thread: "m-1",
      user: "user-1",
      text: "hello",
    })

    await adapter.sendMessage("conv-1", "m-1", "done")
    expect(calls.some((item) => item.includes(".well-known/openidconfiguration"))).toBe(true)
    expect(calls.some((item) => item.includes("login.botframework.com/keys"))).toBe(true)
    expect(calls.some((item) => item.includes("oauth2/v2.0/token"))).toBe(true)
    expect(calls.some((item) => item.includes("/v3/conversations/conv-1/activities"))).toBe(true)
  })

  test("msteams rejects unauthenticated or mismatched activities before session persistence", async () => {
    const s = stub()
    const fixture = msTeamsAuthFixture("bot-app")
    const other = msTeamsAuthFixture("bot-app")
    const calls: string[] = []
    globalThis.fetch = msTeamsFetch(fixture.publicJwk, calls)
    const adapter = new MSTeamsAdapter({
      appId: "bot-app",
      appSecret: "bot-secret",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const body = {
      type: "message",
      channelId: "msteams",
      id: "m-1",
      text: "hello",
      serviceUrl: "https://smba.trafficmanager.net/emea",
      conversation: { id: "conv-1" },
      from: { id: "user-1" },
    }
    const unsigned = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    const wrongSignature = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: other.auth(),
        },
        body: JSON.stringify(body),
      }),
    )
    const wrongAudience = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth({ audience: "other-app" }),
        },
        body: JSON.stringify(body),
      }),
    )
    const wrongIssuer = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth({ issuer: "https://evil.example" }),
        },
        body: JSON.stringify(body),
      }),
    )
    const expired = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth({ expiresIn: -900 }),
        },
        body: JSON.stringify(body),
      }),
    )
    const mismatchedService = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth({ serviceUrl: "https://smba.trafficmanager.net/emea" }),
        },
        body: JSON.stringify({
          ...body,
          serviceUrl: "https://attacker.example",
        }),
      }),
    )
    const wrongChannel = await s.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: fixture.auth(),
        },
        body: JSON.stringify({
          ...body,
          channelId: "webchat",
        }),
      }),
    )

    expect(unsigned.status).toBe(401)
    expect(wrongSignature.status).toBe(401)
    expect(wrongAudience.status).toBe(401)
    expect(wrongIssuer.status).toBe(401)
    expect(expired.status).toBe(401)
    expect(mismatchedService.status).toBe(401)
    expect(wrongChannel.status).toBe(401)
    expect(seen).toHaveLength(0)
    await expect(adapter.sendMessage("conv-1", "m-1", "done")).rejects.toThrow(
      "MS Teams channel not initialized: conv-1",
    )

    const unendorsed = msTeamsAuthFixture("bot-app")
    const unendorsedStub = stub()
    globalThis.fetch = msTeamsFetch(withoutEndorsements(unendorsed.publicJwk), calls)
    const unendorsedAdapter = new MSTeamsAdapter({
      appId: "bot-app",
      appSecret: "bot-secret",
      serve: unendorsedStub.serve,
    })
    unendorsedAdapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await unendorsedAdapter.start()
    const missingEndorsement = await unendorsedStub.route()(
      new Request("http://127.0.0.1:19999/msteams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: unendorsed.auth(),
        },
        body: JSON.stringify(body),
      }),
    )
    expect(missingEndorsement.status).toBe(401)
    expect(seen).toHaveLength(0)
  })

  test("msteams sends screenshot hero cards from a public image URL", async () => {
    const adapter = new MSTeamsAdapter({
      appId: "bot-app",
      appSecret: "bot-secret",
    })
    ;(adapter as unknown as { session: Map<string, { serviceUrl: string; conversationId: string }> }).session.set(
      "conv-1",
      {
        serviceUrl: "https://smba.trafficmanager.net/emea",
        conversationId: "conv-1",
      },
    )
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({
        url,
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      if (url.includes("oauth2/v2.0/token")) {
        return Response.json({ access_token: "ms_token", expires_in: 3600 })
      }
      return Response.json({ id: "reply-1" })
    }) as typeof globalThis.fetch

    await adapter.uploadImageUrl?.(
      "conv-1",
      "m-1",
      "https://public.opencorvus.dev/overlay.png",
      "overlay.png",
      "Captured OpenCorvus GUI.",
    )

    const payload = JSON.parse(calls.at(-1)!.body!) as {
      replyToId?: string
      attachments?: Array<{ content?: { images?: Array<{ url?: string }> } }>
    }
    expect(payload.replyToId).toBe("m-1")
    expect(payload.attachments?.[0]?.content?.images?.[0]?.url).toBe("https://public.opencorvus.dev/overlay.png")
  })

  test("line maps inbound and pushes outbound", async () => {
    const s = stub()
    const secret = "line_secret"
    const adapter = new LineAdapter({
      token: "line_token",
      secret,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    await s.route()(
      lineSignedRequest(
        {
          events: [
            {
              type: "message",
              source: { userId: "u-1" },
              message: { id: "mid-1", type: "text", text: "hello" },
            },
          ],
        },
        secret,
      ),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "line",
      channel: "u-1",
      thread: "mid-1",
      user: "u-1",
      text: "hello",
    })

    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return new Response(null, { status: 200 })
    }) as typeof globalThis.fetch
    await adapter.sendMessage("u-1", "", "done")
    expect(calls[0]).toContain("/v2/bot/message/push")
  })

  test("line requires channel secret and valid signature before dispatch", async () => {
    const body = {
      events: [
        {
          type: "message",
          source: { userId: "u-1" },
          message: { id: "mid-1", type: "text", text: "hello" },
        },
      ],
    }

    const unsigned = stub()
    const noSecret = new LineAdapter({
      token: "line_token",
      serve: unsigned.serve,
    })
    const unsignedSeen: Array<any> = []
    noSecret.onMessage(async (msg) => {
      unsignedSeen.push(msg)
    })
    await noSecret.start()
    const missingSecret = await unsigned.route()(
      new Request("http://127.0.0.1:19999/line", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    expect(missingSecret.status).toBe(401)
    expect(unsignedSeen).toHaveLength(0)

    const signed = stub()
    const adapter = new LineAdapter({
      token: "line_token",
      secret: "line_secret",
      serve: signed.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const missingSignature = await signed.route()(
      new Request("http://127.0.0.1:19999/line", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    const wrongSignature = await signed.route()(
      new Request("http://127.0.0.1:19999/line", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-line-signature": "wrong",
        },
        body: JSON.stringify(body),
      }),
    )
    const valid = await signed.route()(lineSignedRequest(body, "line_secret"))

    expect(missingSignature.status).toBe(401)
    expect(wrongSignature.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  test("line sends screenshot image messages from a public image URL", async () => {
    const adapter = new LineAdapter({
      token: "line_token",
    })
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      return new Response(null, { status: 200 })
    }) as typeof globalThis.fetch

    await adapter.uploadImageUrl?.(
      "u-1",
      "",
      "https://public.opencorvus.dev/overlay.png",
      "overlay.png",
      "Captured OpenCorvus GUI.",
    )

    const payload = JSON.parse(calls[0]!.body!) as {
      to: string
      messages: Array<{ type?: string; originalContentUrl?: string; previewImageUrl?: string }>
    }
    expect(payload.to).toBe("u-1")
    expect(payload.messages.at(-1)).toMatchObject({
      type: "image",
      originalContentUrl: "https://public.opencorvus.dev/overlay.png",
      previewImageUrl: "https://public.opencorvus.dev/overlay.png",
    })
  })

  test("matrix sends message with reply relation", async () => {
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      return Response.json({ event_id: "$out-1" })
    }) as typeof globalThis.fetch

    const adapter = new MatrixAdapter({
      homeserver: "https://matrix.example.com",
      token: "mx_token",
    })
    await adapter.sendMessage("!room:example.com", "$root-1", "done")

    expect(calls[0]?.url).toContain("/_matrix/client/v3/rooms/!room%3Aexample.com/send/m.room.message/")
    const payload = JSON.parse(calls[0]!.body!) as {
      msgtype: string
      body: string
      "m.relates_to"?: {
        "m.in_reply_to"?: {
          event_id?: string
        }
      }
    }
    expect(payload.msgtype).toBe("m.text")
    expect(payload.body).toBe("done")
    expect(payload["m.relates_to"]?.["m.in_reply_to"]?.event_id).toBe("$root-1")
  })

  test("matrix start requires an authenticated physical identity", async () => {
    globalThis.fetch = (async () => new Response("denied", { status: 401 })) as unknown as typeof globalThis.fetch
    const adapter = new MatrixAdapter({ homeserver: "https://matrix.example.com", token: "invalid" })

    await expect(adapter.start()).rejects.toThrow("Matrix whoami failed: 401")
  })

  test("mattermost maps inbound and posts outbound", async () => {
    const s = stub()
    const adapter = new MattermostAdapter({
      url: "https://mm.example.com",
      token: "mm_token",
      webhookToken: "hook_token",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    await s.route()(
      new Request("http://127.0.0.1:19999/mattermost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "hook_token",
          channel_id: "ch-1",
          user_id: "u-1",
          post_id: "p-1",
          text: "hello",
        }),
      }),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "mattermost",
      channel: "ch-1",
      thread: "p-1",
      user: "u-1",
      text: "hello",
    })

    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Response.json({ id: "p-out-1" })
    }) as typeof globalThis.fetch
    await adapter.sendMessage("ch-1", "p-1", "done")
    expect(calls[0]).toContain("/api/v4/posts")
  })

  test("mattermost requires webhook token before dispatch", async () => {
    const s = stub()
    const adapter = new MattermostAdapter({
      url: "https://mm.example.com",
      token: "mm_token",
      webhookToken: "hook_token",
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const payload = {
      channel_id: "ch-1",
      user_id: "u-1",
      post_id: "p-1",
      text: "hello",
    }
    const missing = await s.route()(
      new Request("http://127.0.0.1:19999/mattermost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    )
    const wrong = await s.route()(
      new Request("http://127.0.0.1:19999/mattermost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, token: "wrong" }),
      }),
    )
    const form = new URLSearchParams({
      token: "hook_token",
      channel_id: "ch-1",
      user_id: "u-1",
      post_id: "p-2",
      text: "from form",
    })
    const valid = await s.route()(
      new Request("http://127.0.0.1:19999/mattermost", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form,
      }),
    )

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "mattermost",
      channel: "ch-1",
      thread: "p-2",
      user: "u-1",
      text: "from form",
    })
  })

  test("signal sends outbound message", async () => {
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      return Response.json({ timestamp: 123456 })
    }) as typeof globalThis.fetch

    const adapter = new SignalAdapter({
      service: "http://127.0.0.1:8080",
      account: "+15550001",
    })
    await adapter.sendMessage("+15550002", "123", "done")
    expect(calls[0]?.url).toContain("/v2/send")
    const body = JSON.parse(calls[0]!.body!) as {
      number: string
      recipients: string[]
      message: string
    }
    expect(body.number).toBe("+15550001")
    expect(body.recipients).toEqual(["+15550002"])
    expect(body.message).toBe("done")
  })

  test("signal start requires an initial successful receive response", async () => {
    globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as unknown as typeof globalThis.fetch
    const adapter = new SignalAdapter({ service: "http://127.0.0.1:8080", account: "+15550001" })

    await expect(adapter.start()).rejects.toThrow("Signal receive failed: 503 unavailable")
  })

  test("wecom maps inbound xml and sends outbound", async () => {
    const s = stub()
    const corpId = "wxcorp"
    const callbackToken = "wecom_token"
    const adapter = new WeComAdapter({
      corpId,
      secret: "wxsec",
      agentId: "1000002",
      token: callbackToken,
      encodingAesKey: callbackAesKey,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const xml = `<xml>
  <ToUserName><![CDATA[to]]></ToUserName>
  <FromUserName><![CDATA[user1]]></FromUserName>
  <CreateTime>1710000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[hello]]></Content>
  <MsgId>999</MsgId>
</xml>`
    await s.route()(
      encryptedCallbackXml("http://127.0.0.1:19999/wecom", xml, { receiveId: corpId, token: callbackToken }),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "wecom",
      channel: "user1",
      thread: "999",
      user: "user1",
      text: "hello",
    })

    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("/cgi-bin/gettoken")) {
        return Response.json({ errcode: 0, access_token: "wx_token", expires_in: 7200 })
      }
      return Response.json({ errcode: 0, errmsg: "ok" })
    }) as typeof globalThis.fetch
    await adapter.sendMessage("user1", "", "done")
    expect(calls.some((item) => item.includes("/cgi-bin/gettoken"))).toBe(true)
    expect(calls.some((item) => item.includes("/cgi-bin/message/send"))).toBe(true)
  })

  test("wecom requires callback signature and decrypts encrypted callbacks before dispatch", async () => {
    const s = stub()
    const corpId = "wxcorp"
    const callbackToken = "wecom_token"
    const adapter = new WeComAdapter({
      corpId,
      secret: "wxsec",
      agentId: "1000002",
      token: callbackToken,
      encodingAesKey: callbackAesKey,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const xml = `<xml>
  <ToUserName><![CDATA[to]]></ToUserName>
  <FromUserName><![CDATA[user1]]></FromUserName>
  <CreateTime>1710000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[hello]]></Content>
  <MsgId>999</MsgId>
</xml>`
    const missingSignature = await s.route()(
      new Request("http://127.0.0.1:19999/wecom?timestamp=1710000000&nonce=nonce-1", {
        method: "POST",
        headers: { "content-type": "application/xml" },
        body: "<xml><Encrypt><![CDATA[bad]]></Encrypt></xml>",
      }),
    )
    const wrongSignature = await s.route()(
      encryptedCallbackXml("http://127.0.0.1:19999/wecom", xml, {
        receiveId: corpId,
        token: callbackToken,
        signature: "bad",
      }),
    )
    const wrongReceiveId = await s.route()(
      encryptedCallbackXml("http://127.0.0.1:19999/wecom", xml, {
        receiveId: "other-corp",
        token: callbackToken,
      }),
    )
    const validation = await s.route()(
      encryptedCallbackXml("http://127.0.0.1:19999/wecom", "plain-echo", {
        receiveId: corpId,
        token: callbackToken,
        method: "GET",
      }),
    )
    const valid = await s.route()(
      encryptedCallbackXml("http://127.0.0.1:19999/wecom", xml, { receiveId: corpId, token: callbackToken }),
    )

    expect(missingSignature.status).toBe(401)
    expect(wrongSignature.status).toBe(401)
    expect(wrongReceiveId.status).toBe(401)
    expect(validation.status).toBe(200)
    expect(await validation.text()).toBe("plain-echo")
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  test("dingtalk maps inbound and replies with session webhook", async () => {
    const s = stub()
    const appKey = "ding_key"
    const callbackToken = "ding_token"
    const adapter = new DingTalkAdapter({
      appKey,
      appSecret: "ding_secret",
      callbackToken,
      encodingAesKey: callbackAesKey,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()
    const inbound = await s.route()(
      encryptedCallbackJson(
        "http://127.0.0.1:19999/dingtalk",
        {
          msgtype: "text",
          text: { content: "hello" },
          senderStaffId: "staff_1",
          conversationId: "cid_1",
          msgId: "mid_1",
          sessionWebhook: "https://oapi.dingtalk.com/robot/send?access_token=abc",
        },
        { receiveId: appKey, token: callbackToken },
      ),
    )
    expect(inbound.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      platform: "dingtalk",
      channel: "cid_1",
      thread: "mid_1",
      user: "staff_1",
      text: "hello",
    })

    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Response.json({ errcode: 0, errmsg: "ok" })
    }) as typeof globalThis.fetch
    await adapter.sendMessage("cid_1", "", "done")
    expect(calls[0]).toContain("oapi.dingtalk.com/robot/send")
  })

  test("dingtalk requires callback signature and encrypted body before dispatch", async () => {
    const s = stub()
    const appKey = "ding_key"
    const callbackToken = "ding_token"
    const adapter = new DingTalkAdapter({
      appKey,
      appSecret: "ding_secret",
      callbackToken,
      encodingAesKey: callbackAesKey,
      serve: s.serve,
    })
    const seen: Array<any> = []
    adapter.onMessage(async (msg) => {
      seen.push(msg)
    })
    await adapter.start()

    const body = {
      msgtype: "text",
      text: { content: "hello" },
      senderStaffId: "staff_1",
      conversationId: "cid_1",
      msgId: "mid_1",
      sessionWebhook: "https://oapi.dingtalk.com/robot/send?access_token=abc",
    }
    const unsigned = await s.route()(
      new Request("http://127.0.0.1:19999/dingtalk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    const wrongSignature = await s.route()(
      encryptedCallbackJson("http://127.0.0.1:19999/dingtalk", body, {
        receiveId: appKey,
        token: callbackToken,
        signature: "bad",
      }),
    )
    await expect(adapter.sendMessage("cid_1", "", "done")).rejects.toThrow("DingTalk conversation not initialized")
    const wrongReceiveId = await s.route()(
      encryptedCallbackJson("http://127.0.0.1:19999/dingtalk", body, {
        receiveId: "other-app",
        token: callbackToken,
      }),
    )
    const challenge = await s.route()(
      encryptedCallbackJson(
        "http://127.0.0.1:19999/dingtalk",
        { challenge: "plain-challenge" },
        { receiveId: appKey, token: callbackToken },
      ),
    )
    const challengeBody = (await challenge.json()) as {
      encrypt?: string
      msg_signature?: string
      timeStamp?: string
      nonce?: string
    }
    const valid = await s.route()(
      encryptedCallbackJson("http://127.0.0.1:19999/dingtalk", body, {
        receiveId: appKey,
        token: callbackToken,
      }),
    )

    expect(unsigned.status).toBe(400)
    expect(wrongSignature.status).toBe(401)
    expect(wrongReceiveId.status).toBe(401)
    expect(challenge.status).toBe(200)
    expect(challengeBody.encrypt).toBeString()
    expect(challengeBody.msg_signature).toBe(
      callbackSigned(callbackToken, challengeBody.timeStamp!, challengeBody.nonce!, challengeBody.encrypt!),
    )
    expect(callbackDecrypt(challengeBody.encrypt!, appKey)).toBe("plain-challenge")
    expect(valid.status).toBe(200)
    expect(seen).toHaveLength(1)
  })

  test("dingtalk sends markdown screenshot links from a public image URL", async () => {
    const adapter = new DingTalkAdapter({
      appKey: "ding_key",
      appSecret: "ding_secret",
      callbackToken: "ding_token",
      encodingAesKey: callbackAesKey,
      defaultWebhook: "https://oapi.dingtalk.com/robot/send?access_token=abc",
    })
    const calls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      return Response.json({ errcode: 0, errmsg: "ok" })
    }) as typeof globalThis.fetch

    await adapter.uploadImageUrl?.(
      "cid_1",
      "",
      "https://public.opencorvus.dev/overlay.png",
      "overlay.png",
      "Captured OpenCorvus GUI.",
    )

    const payload = JSON.parse(calls[0]!.body!) as {
      msgtype?: string
      markdown?: { text?: string }
    }
    expect(payload.msgtype).toBe("markdown")
    expect(payload.markdown?.text).toContain("https://public.opencorvus.dev/overlay.png")
  })
})
