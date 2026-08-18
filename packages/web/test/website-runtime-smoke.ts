import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Database } from "bun:sqlite"

const webRoot = path.resolve(import.meta.dir, "..")
const clientRoot = path.join(webRoot, "dist", "client")
const serverRoot = path.join(webRoot, "dist", "server")
const control = path.join(serverRoot, process.platform === "win32" ? "opencorvus-registry-control.exe" : "opencorvus-registry-control")
const databaseRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-website-runtime-"))
const databasePath = path.join(databaseRoot, "registry.sqlite3")
const dataRoot = path.join(databaseRoot, "data")
const seedPath = path.join(serverRoot, "website-registry-seed.json")
const seed = JSON.parse(await readFile(seedPath, "utf8")) as {
  resources: { total: number }
  packages: Array<{
    identity: { namespace: string; id: string; version: string; digest: string }
    archive: { sha256: string; bytes: number }
  }>
}

async function run(args: string[]) {
  const child = Bun.spawn(args, { cwd: webRoot, stdout: "inherit", stderr: "inherit" })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`${args.join(" ")} failed with exit code ${exitCode}`)
}

let server: ReturnType<typeof Bun.spawn> | undefined
try {
  await run([control, "import", "--database", databasePath, "--data", dataRoot, "--seed", seedPath, "--source", clientRoot])
  const port = 46000 + Math.floor(Math.random() * 1000)
  server = Bun.spawn([process.execPath, path.join(serverRoot, "opencorvus-web.mjs")], {
    cwd: path.join(webRoot, "dist"),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      OPENCORVUS_WEB_REGISTRY_DB: databasePath,
      OPENCORVUS_WEB_REGISTRY_DATA: dataRoot,
      OPENCORVUS_WEB_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    },
    stdout: "inherit",
    stderr: "inherit",
  })
  const origin = `http://127.0.0.1:${port}`
  let live: Response | undefined
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      live = await fetch(`${origin}/health/live`)
      if (live.ok) break
    } catch {}
    await Bun.sleep(50)
  }
  if (!live?.ok) throw new Error("Packaged website runtime did not become live")
  const ready = await fetch(`${origin}/health/ready`)
  const readyBody = await ready.json() as { status?: string; publication?: { total?: number } }
  if (!ready.ok || readyBody.status !== "ready" || readyBody.publication?.total !== seed.resources.total) {
    throw new Error(`Packaged readiness failed: ${JSON.stringify(readyBody)}`)
  }
  const exact = seed.packages[0]!
  const identityPath = `${encodeURIComponent(exact.identity.namespace)}/${encodeURIComponent(exact.identity.id)}`
  const checks = [
    `${origin}/market/`,
    `${origin}/zh-cn/market/`,
    `${origin}/market/${identityPath}/`,
    `${origin}/zh-cn/market/${identityPath}/`,
    `${origin}/api/registry/v1/squads?limit=1`,
    `${origin}/api/registry/v1/squads/${identityPath}?locale=zh-CN`,
  ]
  for (const url of checks) {
    const response = await fetch(url)
    if (!response.ok || (await response.arrayBuffer()).byteLength === 0) throw new Error(`Packaged route failed: ${url}`)
  }

  /*
   * Asset integrity.
   *
   * A page that returns 200 while its stylesheet 404s looks completely broken and reports as
   * healthy — the exact symptom that got the squad detail page filed as "崩坏". Every surface here
   * gets its referenced assets fetched, so a dangling hash fails the build instead of a reader.
   *
   * The design-system check is separate on purpose: reaching a stylesheet is not the same as that
   * stylesheet carrying the tokens, and the failure mode where a surface links only a component
   * chunk renders unstyled markup with every asset resolving happily.
   */
  const surfaces = [
    `${origin}/`,
    `${origin}/zh-cn/`,
    `${origin}/market/`,
    `${origin}/zh-cn/market/`,
    `${origin}/market/${identityPath}/`,
    `${origin}/zh-cn/market/${identityPath}/`,
  ]

  for (const surface of surfaces) {
    const html = await (await fetch(surface)).text()

    const referenced = new Set<string>()
    for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js|png|svg|gif|webp|woff2|webmanifest))"/g)) {
      referenced.add(href)
    }
    const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1]
    if (ogImage) referenced.add(new URL(ogImage).pathname)

    if (referenced.size === 0) throw new Error(`Surface referenced no assets at all: ${surface}`)

    for (const asset of referenced) {
      const response = await fetch(`${origin}${asset}`)
      if (!response.ok) throw new Error(`Surface ${surface} references a missing asset: ${asset} (${response.status})`)
    }

    const stylesheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1]!)
    if (stylesheets.length === 0) throw new Error(`Surface served no stylesheet: ${surface}`)

    let carriesDesignSystem = false
    for (const sheet of stylesheets) {
      const css = await (await fetch(new URL(sheet, surface).href)).text()
      if (css.includes("--oc-color-bg-page") && css.includes(".oc-container")) carriesDesignSystem = true
    }
    if (!carriesDesignSystem) {
      throw new Error(`Surface loads stylesheets but none define the design system: ${surface}`)
    }
  }
  const visitorRead = await fetch(`${origin}/api/site/v1/visitors`)
  const visitorInitial = await visitorRead.json() as { estimatedParticipatingBrowsers?: number; participating?: boolean }
  if (!visitorRead.ok || visitorInitial.estimatedParticipatingBrowsers !== 0 || visitorInitial.participating !== false || visitorRead.headers.get("set-cookie")) {
    throw new Error("Read-only visitor summary changed browser participation")
  }
  if (visitorRead.headers.get("access-control-allow-origin")) throw new Error("Visitor summary unexpectedly enabled cross-origin reads")
  const visitorCount = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ purpose: "footer-count" }),
  })
  const visitorCounted = await visitorCount.json() as { estimatedParticipatingBrowsers?: number; participating?: boolean }
  const setCookie = visitorCount.headers.get("set-cookie") ?? ""
  if (!visitorCount.ok || visitorCounted.estimatedParticipatingBrowsers !== 1 || visitorCounted.participating !== true) {
    throw new Error("Same-origin visitor participation did not increment the estimate")
  }
  if (visitorCount.headers.get("access-control-allow-origin")) throw new Error("Visitor participation unexpectedly enabled cross-origin reads")
  for (const attribute of ["__Host-opencorvus-visitor=", "__Host-opencorvus-visitor-consent=1", "Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) {
    if (!setCookie.includes(attribute)) throw new Error(`Visitor cookie contract is missing ${attribute}`)
  }
  const visitorToken = /__Host-opencorvus-visitor=([^;,]+)/.exec(setCookie)?.[1]
  if (!visitorToken) throw new Error("Visitor response did not issue an opaque token")
  const participatingCookie = `__Host-opencorvus-visitor=${visitorToken}; __Host-opencorvus-visitor-consent=1`
  const sameDayDatabase = new Database(databasePath, { strict: true })
  const visitorDigest = createHash("sha256").update(visitorToken).digest("hex")
  const initialExpiry = sameDayDatabase.query<{ expires_at: number }, [string]>("SELECT expires_at FROM site_visitor WHERE visitor_digest = ?").get(visitorDigest)?.expires_at
  const sameDay = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: participatingCookie },
    body: JSON.stringify({ purpose: "footer-count" }),
  })
  const sameDayExpiry = sameDayDatabase.query<{ expires_at: number }, [string]>("SELECT expires_at FROM site_visitor WHERE visitor_digest = ?").get(visitorDigest)?.expires_at
  if (!sameDay.ok || !initialExpiry || sameDayExpiry !== initialExpiry || sameDay.headers.get("set-cookie")) {
    throw new Error("Same-day visitor participation was not a read-only repeat")
  }
  sameDayDatabase.run("UPDATE site_visitor SET expires_at = ? WHERE visitor_digest = ?", [Math.floor(Date.now() / 1000) + 60, visitorDigest])
  sameDayDatabase.close()
  const renewalRead = await fetch(`${origin}/api/site/v1/visitors`, { headers: { cookie: participatingCookie } })
  const renewalState = await renewalRead.json() as { renewalDue?: boolean; participating?: boolean }
  if (!renewalRead.ok || renewalState.participating !== true || renewalState.renewalDue !== true || renewalRead.headers.get("set-cookie")) {
    throw new Error("Read-only visitor summary did not expose due renewal")
  }
  const renewal = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: participatingCookie },
    body: JSON.stringify({ purpose: "footer-count" }),
  })
  const renewalCookies = renewal.headers.get("set-cookie") ?? ""
  if (!renewal.ok || !renewalCookies.includes("__Host-opencorvus-visitor=") || !renewalCookies.includes("__Host-opencorvus-visitor-consent=1")) {
    throw new Error("Due renewal did not synchronously extend both visitor cookies")
  }
  const crossSite = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin: "https://example.invalid", "sec-fetch-site": "cross-site", "content-type": "application/json" },
    body: JSON.stringify({ purpose: "footer-count" }),
  })
  const crossSiteBody = await crossSite.json() as { error?: { code?: string } }
  if (crossSite.status !== 403 || crossSiteBody.error?.code !== "site_visitor_origin_rejected") throw new Error("Cross-site visitor mutation did not return its typed rejection")
  const invalidBody = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ purpose: "other" }),
  })
  const invalidBodyResult = await invalidBody.json() as { error?: { code?: string } }
  if (invalidBody.status !== 400 || invalidBodyResult.error?.code !== "site_visitor_request_invalid") throw new Error("Invalid visitor mutation did not return its typed request error")
  const oversized = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ purpose: "footer-count", padding: "x".repeat(256) }),
  })
  const oversizedBody = await oversized.json() as { error?: { code?: string } }
  if (oversized.status !== 400 || oversizedBody.error?.code !== "site_visitor_request_invalid") throw new Error("Fixed-length oversized visitor mutation did not return its typed request error")
  const streamedBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"purpose":"footer-count","padding":"'))
      controller.enqueue(new TextEncoder().encode("x".repeat(256)))
      controller.enqueue(new TextEncoder().encode('"}'))
      controller.close()
    },
  })
  const streamed = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: streamedBody,
  })
  const streamedResult = await streamed.json() as { error?: { code?: string } }
  if (streamed.status !== 400 || streamedResult.error?.code !== "site_visitor_request_invalid") throw new Error("Streamed oversized visitor mutation did not return its typed request error")
  const withdrawn = await fetch(`${origin}/api/site/v1/visitors/current`, {
    method: "DELETE",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: participatingCookie },
  })
  const withdrawnBody = await withdrawn.json() as { estimatedParticipatingBrowsers?: number; participating?: boolean }
  const clearedCookies = withdrawn.headers.get("set-cookie") ?? ""
  if (!withdrawn.ok || withdrawnBody.estimatedParticipatingBrowsers !== 0 || withdrawnBody.participating !== false || !clearedCookies.includes("Max-Age=0")) {
    throw new Error("Visitor withdrawal did not remove membership and clear both cookies")
  }
  const repeatedWithdrawal = await fetch(`${origin}/api/site/v1/visitors/current`, {
    method: "DELETE",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
  })
  const repeatedWithdrawalBody = await repeatedWithdrawal.json() as { estimatedParticipatingBrowsers?: number; participating?: boolean }
  if (!repeatedWithdrawal.ok || repeatedWithdrawalBody.estimatedParticipatingBrowsers !== 0 || repeatedWithdrawalBody.participating !== false || repeatedWithdrawal.headers.get("access-control-allow-origin")) {
    throw new Error("Visitor withdrawal without a current token was not an idempotent same-origin success")
  }
  const fixedToken = "A".repeat(22)
  const fixedCookie = `__Host-opencorvus-visitor=${fixedToken}; __Host-opencorvus-visitor-consent=1`
  const concurrent = await Promise.all([0, 1].map(() => fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: fixedCookie },
    body: JSON.stringify({ purpose: "footer-count" }),
  })))
  const concurrentBodies = await Promise.all(concurrent.map((response) => response.json() as Promise<{ estimatedParticipatingBrowsers?: number }>))
  if (concurrent.some((response) => !response.ok) || concurrentBodies.some((body) => body.estimatedParticipatingBrowsers !== 1)) {
    throw new Error("Concurrent first participation for one browser token did not converge on one member")
  }
  const invalidCookie = `__Host-opencorvus-visitor=invalid; __Host-opencorvus-visitor-consent=1`
  const rotated = await fetch(`${origin}/api/site/v1/visitors`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: invalidCookie },
    body: JSON.stringify({ purpose: "footer-count" }),
  })
  const rotatedCookies = rotated.headers.get("set-cookie") ?? ""
  if (!rotated.ok || !rotatedCookies.includes("__Host-opencorvus-visitor=") || rotatedCookies.includes("__Host-opencorvus-visitor=invalid")) {
    throw new Error("Consented invalid visitor token did not rotate to a valid token")
  }
  const archive = await fetch(
    `${origin}/api/registry/v1/squads/${identityPath}/${encodeURIComponent(exact.identity.version)}/${exact.identity.digest}/archive`,
  )
  const archiveBytes = new Uint8Array(await archive.arrayBuffer())
  const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex")
  if (
    !archive.ok ||
    archiveBytes.byteLength !== exact.archive.bytes ||
    archiveSha256 !== exact.archive.sha256 ||
    archive.headers.get("x-opencorvus-archive-sha256") !== exact.archive.sha256
  ) {
    throw new Error("Packaged archive response failed its database byte binding")
  }
  if (process.platform === "linux" && server.pid) {
    const status = await readFile(`/proc/${server.pid}/status`, "utf8")
    const residentKiB = Number.parseInt(/^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1] ?? "0", 10)
    if (residentKiB <= 0 || residentKiB >= 512 * 1024) throw new Error(`Packaged runtime resident memory is outside the 512 MiB service budget: ${residentKiB} KiB`)
  }
  console.log(JSON.stringify({ status: "ok", records: seed.resources.total, archiveSha256: exact.archive.sha256 }))
} finally {
  server?.kill()
  await rm(databaseRoot, { recursive: true, force: true })
}
