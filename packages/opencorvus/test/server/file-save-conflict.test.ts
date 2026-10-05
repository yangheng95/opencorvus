import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function startPeer(directory: string, label: string, rewritePath?: string) {
  const readyPath = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, `${label}.json`)
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "../empty-bunfig.toml")}`,
      path.join(import.meta.dir, "../fixture/file-save-http-peer.ts"),
      directory,
      readyPath,
      ...(rewritePath ? [rewritePath] : []),
    ],
    { cwd: path.join(import.meta.dir, "../.."), env: process.env, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  )
  const stdout = new Response(child.stdout).text()
  const stderr = new Response(child.stderr).text()
  let stopPromise: Promise<void> | undefined
  const stop = () =>
    (stopPromise ??= (async () => {
      child.stdin.end()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          child.exited,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 10_000)
          }),
        ])
        if (child.exitCode === null) child.kill()
        await child.exited
        const logs = await Promise.all([stdout, stderr])
        await fs.writeFile(`${readyPath}.log`, logs.join("\n"))
        if (child.exitCode !== 0)
          throw new Error(`File HTTP peer ${label} exited ${child.exitCode}: ${logs.join("\n").slice(-4000)}`)
      } finally {
        clearTimeout(timer)
      }
    })())
  try {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`File HTTP peer startup failed: ${(await stderr).slice(-4000)}`)
      const ready = await fs.readFile(readyPath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (ready) {
        const { url, pid, stdinState } = JSON.parse(ready) as { url: string; pid: number; stdinState: string }
        console.log("[file-save peer]", JSON.stringify({ readyPath, url, pid, stdinState }))
        return {
          url,
          pid,
          stdinState,
          stop,
          async [Symbol.asyncDispose]() {
            await stop()
          },
        }
      }
      await Bun.sleep(25)
    }
    throw new Error(`File HTTP peer ${label} startup timed out`)
  } catch (error) {
    await stop()
    throw error
  }
}

async function read(url: string, file: string) {
  const response = await fetch(new URL(`/file/content?${new URLSearchParams({ path: file })}`, url), {
    signal: AbortSignal.timeout(15_000),
  })
  return { status: response.status, body: await response.json() }
}

async function write(url: string, file: string, content: string, expectedRevision?: string) {
  const response = await fetch(new URL("/file/content", url), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ path: file, content, expectedRevision }),
  })
  return { status: response.status, body: await response.json() }
}

test("real HTTP save uses loaded bytes across external changes, peer processes, restart and path identities", async () => {
  await using project = await memoryProject("file-save-preconditions")
  await Instance.provide({ directory: project.path, fn: async () => undefined })
  const file = "conflict.md"
  const target = path.join(project.path, file)
  await fs.writeFile(target, "version-A\n")
  const fixedTime = new Date("2026-10-05T00:00:00Z")
  await fs.utimes(target, fixedTime, fixedTime)
  await using first = await startPeer(project.path, "file-save-first", "receipt.md")
  await using second = await startPeer(project.path, "file-save-second")
  expect(new Set([first.pid, second.pid]).size).toBe(2)
  expect([first.stdinState, second.stdinState]).toEqual(["open", "open"])
  const initialMode = (await fs.stat(target)).mode & 0o777
  const initial = await read(first.url, file)
  expect(structuredClone(initial)).toMatchObject({
    status: 200,
    body: { type: "text", content: "version-A\n", revision: expect.any(String) },
  })
  await fs.writeFile(path.join(project.path, "other-resource.md"), "version-A\n")
  expect(await write(first.url, "other-resource.md", "wrong-resource\n", initial.body.revision)).toMatchObject({
    status: 409,
    body: { name: "FileWriteConflictError", data: { path: "other-resource.md" } },
  })
  expect(await fs.readFile(path.join(project.path, "other-resource.md"), "utf8")).toBe("version-A\n")
  const statusResponse = await fetch(new URL("/file/status", first.url), { signal: AbortSignal.timeout(15_000) })
  expect({ status: statusResponse.status, files: await statusResponse.json() }).toMatchObject({
    status: 200,
    files: expect.arrayContaining([{ path: file, added: 2, removed: 0, status: "added" }]),
  })
  await fs.writeFile(target, "version-B\n")
  await fs.utimes(target, fixedTime, fixedTime)
  expect((await fs.stat(target)).mtimeMs).toBe(fixedTime.getTime())
  expect(await write(first.url, file, "local-C\n", initial.body.revision)).toMatchObject({
    status: 409,
    body: { name: "FileWriteConflictError", data: { path: file } },
  })
  expect(await fs.readFile(target, "utf8")).toBe("version-B\n")
  const reloaded = await read(second.url, file)
  const saved = await write(first.url, file, "saved-current\n", reloaded.body.revision)
  expect(structuredClone(saved)).toMatchObject({
    status: 200,
    body: { type: "text", content: "saved-current\n", revision: expect.any(String) },
  })
  expect(await read(second.url, file)).toEqual(saved)
  expect((await fs.stat(target)).mode & 0o777).toBe(initialMode)
  expect(await write(first.url, file, "requires-a-baseline\n")).toMatchObject({ status: 400, body: { success: false } })

  for (const [wave, peers] of [
    [first, first],
    [first, second],
  ].entries()) {
    const baseline = await read(first.url, file)
    const edits = await Promise.all(
      peers.map((peer, index) =>
        write(peer.url, file, `wave-${wave}-peer-${peer.pid}-${index}\n`, baseline.body.revision),
      ),
    )
    expect(edits.map((edit) => edit.status).sort()).toEqual([200, 409])
    const winner = edits.find((edit) => edit.status === 200)!
    expect(edits.find((edit) => edit.status === 409)).toMatchObject({ body: { name: "FileWriteConflictError" } })
    expect(await fs.readFile(target, "utf8")).toBe(winner.body.content)
  }

  await fs.writeFile(path.join(project.path, "receipt.md"), "before-receipt\n")
  const receiptBase = await read(first.url, "receipt.md")
  const receipt = await write(first.url, "receipt.md", "own-committed-content\n", receiptBase.body.revision)
  expect(structuredClone(receipt)).toMatchObject({
    status: 200,
    body: { content: "own-committed-content\n", revision: expect.any(String) },
  })
  expect(await fs.readFile(path.join(project.path, "receipt.md"), "utf8")).toBe("external-after-save\n")
  expect(await write(second.url, "receipt.md", "follow-up\n", receipt.body.revision)).toMatchObject({
    status: 409,
    body: { name: "FileWriteConflictError" },
  })

  const baseline = await read(first.url, file)
  await first.stop()
  await using restarted = await startPeer(project.path, "file-save-restarted")
  expect(await write(restarted.url, file, "after-backend-restart\n", baseline.body.revision)).toMatchObject({
    status: 200,
    body: { content: "after-backend-restart\n" },
  })

  for (const change of ["delete", "move"] as const) {
    const name = `${change}.md`
    const source = path.join(project.path, name)
    await fs.writeFile(source, `before-${change}\n`)
    const before = await read(restarted.url, name)
    if (change === "delete") await fs.unlink(source)
    else await fs.rename(source, `${source}.moved`)
    expect(await write(restarted.url, name, "stale\n", before.body.revision)).toMatchObject({
      status: 404,
      body: { name: "FileNotFoundError" },
    })
    if (change === "move") expect(await fs.readFile(`${source}.moved`, "utf8")).toBe("before-move\n")
  }

  const aliasName = process.platform === "win32" ? "CONFLICT.MD" : "./conflict.md"
  const alias = await read(restarted.url, aliasName)
  expect(alias.body).toEqual((await read(second.url, file)).body)
  const aliasRace = await Promise.all([
    write(restarted.url, aliasName, "alias-winner\n", alias.body.revision),
    write(second.url, file, "canonical-winner\n", alias.body.revision),
  ])
  expect(aliasRace.map((value) => value.status).sort()).toEqual([200, 409])
  expect(await fs.readFile(target, "utf8")).toBe(aliasRace.find((value) => value.status === 200)!.body.content)

  const link = path.join(project.path, "linked.md")
  let symlink = "supported"
  try {
    await fs.symlink(target, link, "file")
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (process.platform !== "win32" || !["EPERM", "EACCES"].includes(code ?? "")) throw error
    symlink = `unavailable:${code}`
  }
  if (symlink === "supported") {
    const linked = await read(restarted.url, "linked.md")
    expect(linked.body).toEqual((await read(second.url, file)).body)
    expect(await write(restarted.url, "linked.md", "through-physical-target\n", linked.body.revision)).toMatchObject({
      status: 200,
      body: { content: "through-physical-target\n" },
    })
    expect({ linked: (await fs.lstat(link)).isSymbolicLink(), content: await fs.readFile(target, "utf8") }).toEqual({
      linked: true,
      content: "through-physical-target\n",
    })
  }
  console.log(
    "[file-save HTTP]",
    JSON.stringify({
      processes: [first.pid, second.pid, restarted.pid],
      externalSameMtime: "conflict",
      restart: "saved",
      symlink,
    }),
  )
}, 120_000)
