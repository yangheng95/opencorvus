import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

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
