import { randomBytes } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { Hono, type Context } from "hono"
import { serveStatic } from "hono/bun"
import { HTTPException } from "hono/http-exception"
import { generatedPublicMarketFacts } from "../src/content/public-market-facts.generated"
import {
  HostedMarketRegistrySimulation,
  HostedMarketSimulationError,
  hostedMarketDownloadPath,
  type HostedMarketRecord,
} from "../src/lib/hosted-market-registry"
import config from "../config.mjs"

export const hostedMarketBasePath = config.base === "/" ? "" : config.base.replace(/\/$/, "")
export const hostedMarketApiBase = `${hostedMarketBasePath}/api/registry`
const hostedMarketCookiePath = hostedMarketBasePath || "/"
const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const defaultRegistryRoot = path.join(packageRoot, ".hosted-market-sim")
const defaultDistRoot = path.join(packageRoot, "dist")
const sessionCookie = "oc_hosted_market_session"
const multipartOverheadBytes = 1024 * 1024

type Session = { csrfToken: string; createdAt: number }

async function publicRecord(registry: HostedMarketRegistrySimulation, record: HostedMarketRecord) {
  return {
    ...record,
    downloadPath: hostedMarketDownloadPath(record, hostedMarketApiBase),
    downloadResponses: await registry.downloadResponseCount(record),
  }
}

function errorResponse(error: unknown) {
  if (error instanceof HostedMarketSimulationError) {
    return {
      status: error.httpStatus,
      body: { error: { code: error.code, message: error.message } },
    }
  }
  if (error instanceof HTTPException) {
    return {
      status: error.status,
      body: { error: { code: "HTTP_REQUEST_REJECTED", message: error.message } },
    }
  }
  return {
    status: 500,
    body: {
      error: {
        code: "HOSTED_SIMULATION_FAILURE",
        message: error instanceof Error ? error.message : String(error),
      },
    },
  }
}

export async function createHostedMarketSimulationApp(input: { registryRoot?: string; distRoot?: string } = {}) {
  const registry = new HostedMarketRegistrySimulation(input.registryRoot ?? defaultRegistryRoot)
  await registry.initialize()
  for (const facts of generatedPublicMarketFacts) {
    await registry.seedPayloadRevision(facts.identity.id, facts.identity.digest)
  }

  const sessions = new Map<string, Session>()
  const app = new Hono()
  const desktopClientOrigins = new Set([
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:5173",
  ])

  app.use(`${hostedMarketApiBase}/*`, async (c, next) => {
    await next()
    const origin = c.req.header("Origin")
    if (origin && desktopClientOrigins.has(origin)) {
      c.header("Access-Control-Allow-Origin", origin)
      c.header("Vary", "Origin")
    }
  })

  app.options(`${hostedMarketApiBase}/records/:namespace/:id/:version/:packageDigest/archive`, (c) => {
    const origin = c.req.header("Origin")
    if (!origin || !desktopClientOrigins.has(origin)) {
      throw new HTTPException(403, { message: "Desktop archive origin was rejected" })
    }
    c.header("Access-Control-Allow-Origin", origin)
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
    c.header("Access-Control-Allow-Headers", "Accept")
    c.header("Access-Control-Max-Age", "600")
    c.header("Vary", "Origin")
    return c.body(null, 204)
  })

  app.onError((error, c) => {
    const response = errorResponse(error)
    return c.json(response.body, response.status as 400)
  })

  app.get(`${hostedMarketApiBase}/status`, (c) =>
    c.json({
      mode: "local_hosted_registry_simulation",
      publicationAuthority: false,
      runtimeExecution: false,
      storage: "local_filesystem_sandbox",
      maxArchiveBytes: registry.maxArchiveBytes,
    }),
  )

  app.get(`${hostedMarketApiBase}/session`, (c) => {
    const sessionID = randomBytes(24).toString("hex")
    const csrfToken = randomBytes(32).toString("hex")
    sessions.set(sessionID, { csrfToken, createdAt: Date.now() })
    setCookie(c, sessionCookie, sessionID, {
      httpOnly: true,
      sameSite: "Strict",
      secure: false,
      path: hostedMarketCookiePath,
      maxAge: 60 * 60,
    })
    return c.json({ csrfToken })
  })

  function requireMutationSession(c: Context) {
    const origin = c.req.header("Origin")
    if (origin && origin !== new URL(c.req.url).origin) {
      throw new HTTPException(403, { message: "Cross-origin hosted sandbox mutation was rejected" })
    }
    const sessionID = getCookie(c, sessionCookie)
    const session = sessionID ? sessions.get(sessionID) : undefined
    if (!session || c.req.header("X-CSRF-Token") !== session.csrfToken) {
      if (sessionID) deleteCookie(c, sessionCookie, { path: hostedMarketCookiePath })
      throw new HTTPException(403, { message: "Hosted sandbox session or CSRF token is missing or expired" })
    }
    if (Date.now() - session.createdAt > 60 * 60 * 1000) {
      sessions.delete(sessionID!)
      throw new HTTPException(403, { message: "Hosted sandbox session expired" })
    }
  }

  app.get(`${hostedMarketApiBase}/records`, async (c) => {
    const records = await registry.listRecords()
    return c.json({
      mode: "local_hosted_registry_simulation",
      records: await Promise.all(records.map((record) => publicRecord(registry, record))),
    })
  })

  app.get(`${hostedMarketApiBase}/records/:namespace/:id/:version/:packageDigest`, async (c) => {
    const record = await registry.getRecord({
      namespace: c.req.param("namespace"),
      id: c.req.param("id"),
      version: c.req.param("version"),
      packageDigest: c.req.param("packageDigest"),
    })
    return c.json(await publicRecord(registry, record))
  })

  app.post(`${hostedMarketApiBase}/submissions`, async (c) => {
    requireMutationSession(c)
    const contentLengthRaw = c.req.header("Content-Length")
    if (!contentLengthRaw || !/^\d+$/.test(contentLengthRaw)) {
      throw new HTTPException(411, { message: "Hosted sandbox upload requires an exact Content-Length" })
    }
    const contentLength = Number(contentLengthRaw)
    if (contentLength > registry.maxArchiveBytes + multipartOverheadBytes) {
      throw new HostedMarketSimulationError(
        "ARCHIVE_TOO_LARGE",
        `Upload request exceeds the ${registry.maxArchiveBytes}-byte Expert Squad archive limit`,
        413,
      )
    }
    const body = await c.req.parseBody()
    const archive = body.archive
    if (!(archive instanceof File)) {
      throw new HostedMarketSimulationError("ARCHIVE_REQUIRED", "Choose one Expert Squad ZIP archive", 400)
    }
    if (archive.size > registry.maxArchiveBytes) {
      throw new HostedMarketSimulationError(
        "ARCHIVE_TOO_LARGE",
        `Archive is ${archive.size} bytes; the local sandbox limit is ${registry.maxArchiveBytes} bytes`,
        413,
      )
    }
    const submission = await registry.validateUpload({
      bytes: new Uint8Array(await archive.arrayBuffer()),
      originalFilename: archive.name,
    })
    return c.json({
      mode: "local_hosted_registry_simulation",
      publicationAuthority: false,
      submission,
    })
  })

  app.post(`${hostedMarketApiBase}/submissions/:submissionID/commit`, async (c) => {
    requireMutationSession(c)
    const result = await registry.commitSubmission(c.req.param("submissionID"))
    return c.json({
      mode: "local_hosted_registry_simulation",
      publicationAuthority: false,
      deduplicated: result.deduplicated,
      record: await publicRecord(registry, result.record),
    })
  })

  app.get(`${hostedMarketApiBase}/records/:namespace/:id/:version/:packageDigest/archive`, async (c) => {
    const record = await registry.getRecord({
      namespace: c.req.param("namespace"),
      id: c.req.param("id"),
      version: c.req.param("version"),
      packageDigest: c.req.param("packageDigest"),
    })
    const archive = await registry.readArchive(record)
    const downloadResponses = await registry.recordDownloadResponse(record)
    c.header("Content-Type", "application/zip")
    c.header("Content-Disposition", `attachment; filename="${archive.filename}"`)
    c.header("Content-Length", String(archive.bytes.byteLength))
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("ETag", `"${record.archive.sha256}"`)
    c.header("X-Content-Type-Options", "nosniff")
    c.header("X-OpenCorvus-Package-Digest", record.facts.identity.digest)
    c.header("X-OpenCorvus-Archive-SHA256", record.archive.sha256)
    c.header("X-OpenCorvus-Download-Responses", String(downloadResponses))
    const body = archive.bytes.buffer.slice(
      archive.bytes.byteOffset,
      archive.bytes.byteOffset + archive.bytes.byteLength,
    ) as ArrayBuffer
    return c.body(body)
  })

  const distRoot = input.distRoot ?? defaultDistRoot
  const hostedStaticRoute = hostedMarketBasePath ? `${hostedMarketBasePath}/*` : "/*"
  app.use(
    hostedStaticRoute,
    serveStatic({
      root: distRoot,
      rewriteRequestPath(requestPath) {
        const relative = hostedMarketBasePath ? requestPath.slice(hostedMarketBasePath.length) : requestPath
        return relative || "/"
      },
    }),
  )
  if (hostedMarketBasePath) {
    app.get(hostedMarketBasePath, (c) => c.redirect(`${hostedMarketBasePath}/`, 308))
  }
  app.notFound((c) => c.json({ error: { code: "HOSTED_ROUTE_NOT_FOUND", message: "Hosted simulation route not found" } }, 404))

  return { app, registry }
}

if (import.meta.main) {
  const { app, registry } = await createHostedMarketSimulationApp()
  const port = Number(process.env.OPENCORVUS_HOSTED_MARKET_PORT ?? "4340")
  Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: app.fetch,
    maxRequestBodySize: registry.maxArchiveBytes + multipartOverheadBytes,
  })
  console.log(`OpenCorvus hosted market simulation: http://127.0.0.1:${port}${hostedMarketBasePath || ""}/`)
}
