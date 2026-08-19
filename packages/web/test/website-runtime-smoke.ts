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
  const viewRead = await fetch(`${origin}/api/site/v1/views`)
  const viewInitial = await viewRead.json() as { month?: string; monthViews?: number; totalViews?: number }
  if (!viewRead.ok || viewInitial.monthViews !== 0 || viewInitial.totalViews !== 0 || viewRead.headers.get("set-cookie")) {
    throw new Error("Read-only view summary recorded a view or issued a cookie")
  }
  if (!/^[0-9]{4}-[0-9]{2}$/.test(viewInitial.month ?? "")) throw new Error("View summary did not report its UTC month")
  if (viewRead.headers.get("access-control-allow-origin")) throw new Error("View summary unexpectedly enabled cross-origin reads")
  const recorded = await fetch(`${origin}/api/site/v1/views`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
  })
  const recordedBody = await recorded.json() as { monthViews?: number; totalViews?: number }
  if (!recorded.ok || recordedBody.monthViews !== 1 || recordedBody.totalViews !== 1 || recorded.headers.get("set-cookie")) {
    throw new Error("Same-origin view record did not count exactly one view without a cookie")
  }
  if (recorded.headers.get("access-control-allow-origin")) throw new Error("View record unexpectedly enabled cross-origin reads")
  const repeated = await fetch(`${origin}/api/site/v1/views`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
  })
  const repeatedBody = await repeated.json() as { monthViews?: number; totalViews?: number }
  if (!repeated.ok || repeatedBody.monthViews !== 2 || repeatedBody.totalViews !== 2) {
    throw new Error("A second view from the same reader did not count as a second view")
  }
  const viewDatabase = new Database(databasePath, { strict: true })
  const storedTotal = viewDatabase.query<{ total_views: number }, []>("SELECT total_views FROM site_view_summary WHERE singleton = 1").get()?.total_views
  const storedMonths = viewDatabase.query<{ month: string; views: number }, []>("SELECT month, views FROM site_view_month ORDER BY month").all()
  viewDatabase.close()
  if (storedTotal !== 2 || storedMonths.length !== 1 || storedMonths[0]?.views !== 2) {
    throw new Error("Recorded views did not land in the monthly ledger and its running total")
  }
  const crossSiteView = await fetch(`${origin}/api/site/v1/views`, {
    method: "POST",
    headers: { origin: "https://example.invalid", "sec-fetch-site": "cross-site", "content-type": "application/json" },
  })
  const crossSiteViewBody = await crossSiteView.json() as { error?: { code?: string } }
  if (crossSiteView.status !== 403 || crossSiteViewBody.error?.code !== "site_view_origin_rejected") {
    throw new Error("Cross-site view record did not return its typed rejection")
  }
  const unchanged = await (await fetch(`${origin}/api/site/v1/views`)).json() as { totalViews?: number }
  if (unchanged.totalViews !== 2) throw new Error("A rejected cross-site record still moved the counter")
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
