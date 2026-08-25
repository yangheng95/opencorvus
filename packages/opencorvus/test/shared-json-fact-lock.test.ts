import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { withSharedJsonFactLock } from "../src/util/process-lock"

const roots: string[] = []

afterAll(async () => {
  for (const root of roots) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined)
})

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oc-shared-json-fact-"))
  roots.push(root)
  return root
}

/**
 * A second OS process that performs the same read-modify-write against the same
 * file, holding the critical section long enough that an unsynchronized writer
 * would read the pre-update snapshot.
 */
const PEER_WRITER = `
import { withSharedJsonFactLock } from "SOURCE"
import fs from "node:fs/promises"

const target = process.argv[2]
const key = process.argv[3]
const holdMilliseconds = Number(process.argv[4])
const locks = new Map()
await withSharedJsonFactLock({
  locks,
  filepath: target,
  empty: "{}",
  mode: 0o600,
  run: async () => {
    // Announce only once the lock is actually held, so the parent races the
    // held lock rather than a guess about process startup time.
    process.stdout.write("acquired\\n")
    const current = JSON.parse(await fs.readFile(target, "utf8"))
    await new Promise((resolve) => setTimeout(resolve, holdMilliseconds))
    await fs.writeFile(target, JSON.stringify({ ...current, [key]: "peer" }, null, 2))
  },
})
process.stdout.write("written\\n")
`

describe("shared JSON fact lock", () => {
  test("a writer in another process cannot drop an update it never read", async () => {
    const root = await temporaryRoot()
    const target = path.join(root, "fact.json")
    const peerPath = path.join(root, "peer-writer.ts")
    const source = path.resolve(import.meta.dir, "../src/util/process-lock").replaceAll("\\", "/")
    await fs.writeFile(peerPath, PEER_WRITER.replace("SOURCE", source))

    const peer = Bun.spawn(["bun", "run", peerPath, target, "peer", "400"], {
      cwd: path.resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    })

    // Wait for the peer to say it holds the lock. A fixed sleep would let
    // this process win the race on a slow machine, and the assertion below
    // would then pass with the lock removed entirely.
    const peerOutput = peer.stdout.getReader()
    const decoder = new TextDecoder()
    let announced = ""
    while (!announced.includes("acquired")) {
      const chunk = await peerOutput.read()
      if (chunk.done) throw new Error(`peer exited before acquiring: ${announced}`)
      announced += decoder.decode(chunk.value)
    }
    peerOutput.releaseLock()

    const locks = new Map<string, Promise<unknown>>()
    await withSharedJsonFactLock({
      locks,
      filepath: target,
      empty: "{}",
      mode: 0o600,
      run: async () => {
        const current = JSON.parse(await fs.readFile(target, "utf8")) as Record<string, string>
        await fs.writeFile(target, JSON.stringify({ ...current, local: "this-process" }, null, 2))
      },
    })

    const peerExit = await peer.exited
    const peerError = await new Response(peer.stderr).text()
    expect({ peerExit, peerError }).toEqual({ peerExit: 0, peerError: "" })

    // Both updates survive: the second writer read the first writer's result
    // rather than a snapshot taken before it.
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ peer: "peer", local: "this-process" })
  }, 60_000)

  test("the fact file is provisioned with the empty representation a reader would synthesize", async () => {
    const root = await temporaryRoot()
    const target = path.join(root, "nested", "fact.json")
    const locks = new Map<string, Promise<unknown>>()
    const observed = await withSharedJsonFactLock({
      locks,
      filepath: target,
      empty: "{}",
      mode: 0o600,
      run: async () => JSON.parse(await fs.readFile(target, "utf8")) as Record<string, unknown>,
    })
    expect(observed).toEqual({})
  }, 30_000)
})
