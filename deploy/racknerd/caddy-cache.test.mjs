import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

// HTTP transport contract, not page rendering or UI automation. Execute the
// production Caddy routes against deliberately equal-mtime/equal-size bytes.
test("signed release HTTP cache contract", { timeout: 30_000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "opencorvus-caddy-cache-"))
  const caddy = process.env.CADDY_BIN || "caddy"
  const configFile = fileURLToPath(new URL("./Caddyfile", import.meta.url))
  let child
  let output = ""
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit")
      child.kill()
      await stopped
    }
    await rm(root, { recursive: true, force: true, maxRetries: 3 })
  })

  const initial = "version-54"
  const current = "version-61"
  const timestamp = new Date("1980-01-01T00:00:00Z")
  const mutableFiles = ["index.html", "zh-cn/index.html", "docs/index.html",
    "downloads/latest.json", "expert-squads/catalog.json"]
  async function put(relative, body) {
    const target = path.join(root, "client", relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
    await utimes(target, timestamp, timestamp)
  }
  for (const file of mutableFiles) await put(file, initial)
  await put("asset.txt", initial)
  await put("expert-squads/archives/aa.zip", initial)

  const adapted = spawnSync(caddy, ["adapt", "--config", configFile, "--adapter", "caddyfile"], {
    encoding: "utf8", windowsHide: true,
  })
  assert.equal(adapted.status, 0, adapted.stderr || String(adapted.error))
  const config = JSON.parse(adapted.stdout)
  const server = Object.values(config.apps.http.servers)
    .find((item) => item.listen.includes("127.0.0.1:8080"))
  assert.ok(server, "production loopback server must be adapted")
  // Preserve the real route handlers; replace only test-owned listener/root.
  const reservation = createServer()
  reservation.listen(0, "127.0.0.1")
  await once(reservation, "listening")
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  server.listen = [`127.0.0.1:${port}`]
  server.automatic_https = { disable: true }
  let roots = 0
  function relocate(value) {
    if (!value || typeof value !== "object") return
    for (const [key, nested] of Object.entries(value)) {
      if (key === "root" && nested === "/srv/opencorvus/current/client") {
        value[key] = path.join(root, "client")
        roots++
      } else relocate(nested)
    }
  }
  relocate(server)
  assert.ok(roots > 0, "production static root must be relocated")
  const testConfig = path.join(root, "caddy.json")
  await writeFile(testConfig, JSON.stringify({
    admin: { disabled: true },
    apps: { http: { servers: { test: server } } },
  }))
  child = spawn(caddy, ["run", "--config", testConfig], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: root, XDG_CONFIG_HOME: root },
  })
  child.stdout.on("data", (data) => { output += data })
  child.stderr.on("data", (data) => { output += data })
  const origin = `http://127.0.0.1:${port}`
  const request = (url, options = {}) => fetch(`${origin}${url}`, {
    ...options, signal: AbortSignal.timeout(3_000),
  })
  let legacy
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      legacy = await request("/asset.txt")
      break
    } catch {
      if (child.exitCode !== null || child.signalCode !== null) break
      await delay(50)
    }
  }
  assert.ok(legacy, `real Caddy must become ready: ${output}`)
  assert.equal(await legacy.text(), initial)
  const etag = legacy.headers.get("etag")
  assert.ok(etag, "unchanged asset supplies legacy metadata ETag")
  assert.equal(legacy.headers.get("last-modified"), "Tue, 01 Jan 1980 00:00:00 GMT")
  for (const file of mutableFiles) await put(file, current)

  await t.test("old validators retrieve current documents and pointers", async () => {
    const validators = [
      { "If-Modified-Since": "Tue, 01 Jan 1980 00:00:00 GMT" },
      { "If-None-Match": etag },
      { "If-None-Match": etag, "If-Modified-Since": "Tue, 01 Jan 1980 00:00:00 GMT" },
    ]
    for (const url of ["/", "/zh-cn/", "/docs", "/docs/", "/docs/index.html",
      "/downloads/latest.json", "/expert-squads/catalog.json"]) {
      for (const headers of validators) {
        const response = await request(url, { headers })
        assert.equal(response.status, 200, `${url} must serve the new signed bytes`)
        assert.equal(await response.text(), current)
        assert.equal(response.headers.get("cache-control"), "no-store, max-age=0")
      }
    }
  })
  await t.test("HEAD retrieves current publication metadata", async () => {
    const response = await request("/downloads/latest.json", {
      method: "HEAD", headers: { "If-None-Match": etag },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-length"), String(Buffer.byteLength(current)))
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0")
  })
  await t.test("content-addressed archive retains immutable validation", async () => {
    const first = await request("/expert-squads/archives/aa.zip")
    assert.equal(await first.text(), initial)
    assert.equal(first.headers.get("cache-control"), "public, max-age=31536000, immutable")
    const response = await request("/expert-squads/archives/aa.zip", {
      headers: { "If-None-Match": first.headers.get("etag") },
    })
    assert.equal(response.status, 304)
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable")
  })
  await t.test("ordinary assets retain range delivery", async () => {
    const response = await request("/asset.txt", { headers: { Range: "bytes=0-6" } })
    assert.equal(response.status, 206)
    assert.equal(response.headers.get("content-range"), "bytes 0-6/10")
    assert.equal(await response.text(), "version")
  })
})
