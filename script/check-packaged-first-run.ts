#!/usr/bin/env bun

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

// Run as a separate process: the SDK launches with this process's environment.
// Only host execution variables cross into the empty, credential-free runtime.
const executable = path.resolve(process.argv[2] ?? "")
if (!process.argv[2] || !(await fs.stat(executable)).isFile()) {
  throw new Error("Usage: bun script/check-packaged-first-run.ts <native-opencorvus-executable>")
}
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-first-run-")))
const hostKeys = new Set(["path", "systemroot", "windir", "comspec", "pathext", "lang", "lc_all"])
for (const key of Object.keys(process.env)) {
  if (!hostKeys.has(key.toLowerCase())) delete process.env[key]
}
Object.assign(process.env, {
  HOME: root,
  USERPROFILE: root,
  LOCALAPPDATA: root,
  APPDATA: root,
  TEMP: root,
  TMP: root,
  TMPDIR: root,
  OPENCORVUS_HOME: path.join(root, "runtime"),
  OPENCORVUS_BIN_PATH: executable,
  ...(process.platform === "win32"
    ? { OPENCORVUS_PROCESS_SUPERVISOR: path.join(path.dirname(executable), "opencorvus-process-supervisor.exe") }
    : {}),
})
process.chdir(root)

type Created = { id: string; projectID: string; directory: string; metadata: Record<string, unknown> }
const created: Created[] = []
try {
  const { createOpenCorvusServer } = await import("../packages/sdk/js/src/server")
  for (let occurrence = 0; occurrence < 2; occurrence++) {
    const server = await createOpenCorvusServer({ hostname: "127.0.0.1", port: 0, timeout: 60_000 })
    try {
      const request = async (route: string, status: number, init?: RequestInit) => {
        const response = await fetch(new URL(route, server.url), {
          ...init,
          signal: AbortSignal.timeout(30_000),
        })
        const body = await response.json()
        assert.equal(response.status, status, `${route}: ${JSON.stringify(body)}`)
        return body
      }
      const config = await request("/global/config", 200)
      assert.deepEqual(config.prompt_profile, { active: "base" })
      for (const prior of created) {
        const stored = await request(`/session/${prior.id}?directory=${encodeURIComponent(prior.directory)}`, 200)
        assert.equal(stored.id, prior.id)
        assert.equal(stored.projectID, prior.projectID)
        assert.deepEqual(stored.metadata, prior.metadata)
      }
      for (const experience of ["work", "chat"]) {
        const { session } = await request(`/global/${experience}`, 201, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
        assert.equal(typeof session.id, "string")
        assert.equal(typeof session.projectID, "string")
        assert.deepEqual(session.metadata.conversation, { experience, surface: "right-sidebar" })
        assert.deepEqual(session.metadata.configOverlay.prompt_profile, { active: "base" })
        const relative = path.relative(root, await fs.realpath(session.directory))
        assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Project belongs to test runtime")
        created.push(session)
      }
    } finally {
      await server.close()
    }
  }
  assert.equal(new Set(created.map((session) => session.id)).size, 4)
  assert.equal(new Set(created.map((session) => session.projectID)).size, 4)
  console.log(JSON.stringify({ firstRun: "passed", sessionsCreated: 4, persistedAcrossRestart: 2 }))
} finally {
  process.chdir(path.dirname(root))
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}
