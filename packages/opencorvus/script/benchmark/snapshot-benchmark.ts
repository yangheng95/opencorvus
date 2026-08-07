#!/usr/bin/env bun
/**
 * Snapshot subsystem dedicated benchmark.
 *
 * Runs end-to-end against the real Snapshot module (no mocks). Each suite
 * either passes silently or throws — main aggregates and exits with the
 * failure count so the harness can report it.
 *
 * Scope: see docs/snapshot-benchmark-plan.md
 *
 * Run:
 *   bun packages/opencorvus/script/benchmark/snapshot-benchmark.ts
 */
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import {
  createManagedTemporaryDirectory,
  currentOpenCorvusRuntimePaths,
  removeManagedDirectoryTree,
} from "@opencorvus-ai/util/runtime-directories"

const benchmarkOwner = path.join(currentOpenCorvusRuntimePaths().temporary, "benchmarks")
const benchmarkHome = await createManagedTemporaryDirectory(benchmarkOwner, "snapshot-")
process.env.OPENCORVUS_HOME = benchmarkHome

const { Snapshot } = await import("../../src/snapshot")
const { Instance } = await import("../../src/project/instance")
const { Global } = await import("../../src/global")
const { withStreamActivity } = await import("../../src/util/stream-activity")
const { Database } = await import("../../src/storage/db")
const { Log } = await import("../../src/util/log")

const fwd = (...parts: string[]) => path.join(...parts).replaceAll("\\", "/")
const SHA1_RE = /^[0-9a-f]{40}$/
const PERF_LIMIT = {
  trackMs: 2_250,
  diffMs: 1_500,
  restoreMs: 2_250,
}

type SuiteResult = void | Record<string, unknown>
type Suite = { name: string; run: () => Promise<SuiteResult> }

async function makeRepo(label = ""): Promise<string> {
  const tag = label ? `${label}-` : ""
  const dir = await createManagedTemporaryDirectory(path.join(Global.Path.temporary, "repositories"), tag || "repo-")
  // Unique commit message → unique root SHA → unique Project.id (no cross-suite collision in
  // ${Global.Path.data}/snapshot/<id>).
  await $`git init -b main`.cwd(dir).quiet().nothrow()
  await $`git -c user.email=bench@x -c user.name=bench commit --allow-empty -m ${"root-" + Math.random().toString(36).slice(2)}`
    .cwd(dir)
    .quiet()
    .nothrow()
  return dir
}

function inInstance<T>(directory: string, fn: () => Promise<T>) {
  return Instance.provide({ directory, fn })
}

async function exists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false)
}

async function dirSize(dir: string): Promise<number> {
  let total = 0
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [] as import("fs").Dirent[])
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile()) {
        const st = await fs.stat(p).catch(() => null)
        if (st) total += st.size
      }
    }
  }
  await walk(dir)
  return total
}

function assertHash(hash: unknown, label: string): asserts hash is string {
  if (typeof hash !== "string" || !SHA1_RE.test(hash))
    throw new Error(`${label}: not a sha1 hash: ${JSON.stringify(hash)}`)
}

function benchmarkIdleMs() {
  const raw = process.env.SNAPSHOT_BENCH_IDLE_TIMEOUT_MS
  if (!raw) return 120_000
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid SNAPSHOT_BENCH_IDLE_TIMEOUT_MS=${raw}`)
  return value
}

function assertUnder(name: string, actual: number, limit: number) {
  if (actual > limit) throw new Error(`${name} exceeded budget: actual=${actual}ms limit=${limit}ms`)
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

async function suite_core_roundtrip(): Promise<SuiteResult> {
  const dir = await makeRepo("rt")
  await fs.writeFile(path.join(dir, "a.txt"), "A")
  await fs.writeFile(path.join(dir, "b.txt"), "B")
  return await inInstance(dir, async () => {
    const h0 = await Snapshot.track()
    assertHash(h0, "track baseline")

    await fs.writeFile(path.join(dir, "a.txt"), "A2")
    await fs.writeFile(path.join(dir, "c.txt"), "C")
    await fs.unlink(path.join(dir, "b.txt"))

    const p = await Snapshot.patch(h0)
    const expected = new Set([fwd(dir, "a.txt"), fwd(dir, "b.txt"), fwd(dir, "c.txt")])
    const got = new Set(p.files)
    if (got.size !== expected.size || [...expected].some((f) => !got.has(f)))
      throw new Error(`patch mismatch: got=${JSON.stringify([...got])} expected=${JSON.stringify([...expected])}`)

    await Snapshot.revert([p])
    if ((await fs.readFile(path.join(dir, "a.txt"), "utf-8")) !== "A") throw new Error("a.txt revert content mismatch")
    if ((await fs.readFile(path.join(dir, "b.txt"), "utf-8")) !== "B") throw new Error("b.txt revert content mismatch")
    if (await exists(path.join(dir, "c.txt"))) throw new Error("c.txt should be removed by revert")
  })
}

async function suite_restore_removes_extras(): Promise<SuiteResult> {
  const dir = await makeRepo("rmx")
  await fs.writeFile(path.join(dir, "keep.txt"), "K")
  return await inInstance(dir, async () => {
    const baseline = await Snapshot.track()
    assertHash(baseline, "baseline")

    for (const i of [1, 2, 3, 4, 5]) {
      await fs.writeFile(path.join(dir, `extra-${i}.txt`), `E${i}`)
    }

    await Snapshot.restore(baseline)

    if ((await fs.readFile(path.join(dir, "keep.txt"), "utf-8")) !== "K") throw new Error("keep.txt lost after restore")

    const survivors: string[] = []
    for (const i of [1, 2, 3, 4, 5]) {
      if (await exists(path.join(dir, `extra-${i}.txt`))) survivors.push(`extra-${i}.txt`)
    }
    if (survivors.length > 0) throw new Error(`restore left ${survivors.length} extras: ${survivors.join(", ")}`)
  })
}

async function suite_gc_no_destructive_api(): Promise<SuiteResult> {
  // Structural guarantee: the public Snapshot surface must NOT expose any
  // function whose intended effect is "drop dangling tree objects". Such an
  // API would necessarily destroy live message-part / task-baseline hashes
  // (every track()-emitted tree is dangling by design). Disk reclaim is
  // ProjectGC's whole-project rm path — outside the Snapshot module.
  const surface = Snapshot as unknown as Record<string, unknown>
  for (const name of ["cleanup", "init", "gc", "prune"]) {
    if (typeof surface[name] !== "undefined")
      throw new Error(`Snapshot.${name} reintroduced — would re-break active snapshots (R1)`)
  }
}

async function suite_gc_two_snapshots_both_survive(): Promise<SuiteResult> {
  const dir = await makeRepo("gc2")
  await fs.writeFile(path.join(dir, "x.txt"), "v1")
  return await inInstance(dir, async () => {
    const h1 = await Snapshot.track()
    assertHash(h1, "h1")
    await fs.writeFile(path.join(dir, "x.txt"), "v2")
    const h2 = await Snapshot.track()
    assertHash(h2, "h2")
    if (h1 === h2) throw new Error("two distinct contents produced identical hashes")

    // Both snapshots must remain restorable independently — no GC API by design.
    await Snapshot.restore(h2)
    if ((await fs.readFile(path.join(dir, "x.txt"), "utf-8")) !== "v2") throw new Error("h2 not restorable")

    await Snapshot.restore(h1)
    if ((await fs.readFile(path.join(dir, "x.txt"), "utf-8")) !== "v1") throw new Error("h1 lost after second track")
  })
}

async function suite_concurrency_parallel_track(): Promise<SuiteResult> {
  const dirs = await Promise.all([makeRepo("c1"), makeRepo("c2"), makeRepo("c3"), makeRepo("c4")])
  for (let i = 0; i < dirs.length; i++) {
    await fs.writeFile(path.join(dirs[i], "f.txt"), `dir-${i}`)
  }

  const hashes = await Promise.all(dirs.map((d) => inInstance(d, () => Snapshot.track())))
  hashes.forEach((h, i) => assertHash(h, `parallel track #${i}`))

  // Distinct content → distinct hashes
  const set = new Set(hashes as string[])
  if (set.size !== hashes.length) throw new Error(`parallel hashes collide: ${JSON.stringify(hashes)}`)

  // Each restore must yield its own content, no cross-talk
  for (let i = 0; i < dirs.length; i++) {
    await inInstance(dirs[i], async () => {
      await fs.writeFile(path.join(dirs[i], "f.txt"), "scrambled")
      await Snapshot.restore(hashes[i] as string)
      const got = await fs.readFile(path.join(dirs[i], "f.txt"), "utf-8")
      if (got !== `dir-${i}`) throw new Error(`parallel restore #${i} cross-talk: got "${got}"`)
    })
  }
}

async function suite_boundary_unicode_and_space(): Promise<SuiteResult> {
  const dir = await createManagedTemporaryDirectory(path.join(Global.Path.temporary, "repositories"), "中文-dir-")
  await $`git init -b main`.cwd(dir).quiet().nothrow()
  await $`git -c user.email=bench@x -c user.name=bench commit --allow-empty -m ${"root-" + Math.random().toString(36).slice(2)}`
    .cwd(dir)
    .quiet()
    .nothrow()

  const fileName = "ümlaut 文件.txt"
  await fs.writeFile(path.join(dir, fileName), "Ω")
  return await inInstance(dir, async () => {
    const h = await Snapshot.track()
    assertHash(h, "unicode track")
    await fs.writeFile(path.join(dir, fileName), "scrambled")
    await Snapshot.restore(h)
    const got = await fs.readFile(path.join(dir, fileName), "utf-8")
    if (got !== "Ω") throw new Error(`unicode restore mismatch: got "${got}"`)
  })
}

async function suite_boundary_binary_and_large(): Promise<SuiteResult> {
  const dir = await makeRepo("blob")
  const bin = Buffer.alloc(5 * 1024 * 1024)
  for (let i = 0; i < bin.length; i++) bin[i] = (i * 37 + 13) & 0xff
  await fs.writeFile(path.join(dir, "blob.bin"), bin)
  await fs.writeFile(path.join(dir, "big.txt"), "x".repeat(1 * 1024 * 1024))

  return await inInstance(dir, async () => {
    const t0 = Date.now()
    const h0 = await Snapshot.track()
    assertHash(h0, "blob track")
    const trackMs = Date.now() - t0

    // Mutate binary, mutate text by appending small delta
    const bin2 = Buffer.from(bin)
    bin2[0] = bin2[0] ^ 0xff
    await fs.writeFile(path.join(dir, "blob.bin"), bin2)
    await fs.writeFile(path.join(dir, "big.txt"), "x".repeat(1 * 1024 * 1024) + "delta")

    const h1 = await Snapshot.track()
    assertHash(h1, "blob track 2")
    const fd = await Snapshot.diffFull(h0, h1)
    const binDiff = fd.find((f) => f.file === "blob.bin")
    const txtDiff = fd.find((f) => f.file === "big.txt")
    if (!binDiff) throw new Error("diffFull missing blob.bin")
    if (!txtDiff) throw new Error("diffFull missing big.txt")
    if (binDiff.additions !== 0 || binDiff.deletions !== 0)
      throw new Error(`binary should have additions=deletions=0, got ${binDiff.additions}/${binDiff.deletions}`)
    return { trackMs, binStatus: binDiff.status, txtStatus: txtDiff.status }
  })
}

async function suite_boundary_exclude_baseline(): Promise<SuiteResult> {
  const dir = await makeRepo("excl")
  await fs.mkdir(path.join(dir, "node_modules", "pkg"), { recursive: true })
  await fs.writeFile(path.join(dir, "node_modules", "pkg", "lib.js"), "ignored")
  await fs.mkdir(path.join(dir, "src"), { recursive: true })
  await fs.writeFile(path.join(dir, "src", "tracked.js"), "tracked")

  return await inInstance(dir, async () => {
    const h = await Snapshot.track()
    assertHash(h, "excl track")

    await fs.writeFile(path.join(dir, "node_modules", "pkg", "lib.js"), "modified-nm")
    await fs.writeFile(path.join(dir, "src", "tracked.js"), "modified-src")

    const p = await Snapshot.patch(h)
    const hadNm = p.files.some((f) => f.includes("node_modules"))
    const hadSrc = p.files.some((f) => f.endsWith("tracked.js"))
    if (hadNm) throw new Error(`node_modules slipped past BASELINE_EXCLUDE: ${p.files.join(", ")}`)
    if (!hadSrc) throw new Error(`src/tracked.js missed: ${p.files.join(", ")}`)
  })
}

async function suite_perf_thousand_files(): Promise<SuiteResult> {
  const dir = await makeRepo("perf")
  for (let i = 0; i < 1000; i++) {
    const sub = path.join(dir, `s${Math.floor(i / 50)}`)
    await fs.mkdir(sub, { recursive: true })
    await fs.writeFile(path.join(sub, `f${i}.txt`), `c-${i}-` + "ab".repeat(60))
  }

  return await inInstance(dir, async () => {
    const h0 = await Snapshot.track() // warm
    assertHash(h0, "warmup")

    const t1 = Date.now()
    const h1 = await Snapshot.track()
    const trackMs = Date.now() - t1
    assertHash(h1, "track")

    for (let i = 0; i < 100; i++) {
      const sub = path.join(dir, `s${Math.floor(i / 50)}`)
      await fs.writeFile(path.join(sub, `f${i}.txt`), `MOD-${i}`)
    }
    const h2 = await Snapshot.track()
    assertHash(h2, "track2")

    const t2 = Date.now()
    const fd = await Snapshot.diffFull(h1, h2)
    const diffMs = Date.now() - t2

    const t3 = Date.now()
    await Snapshot.restore(h1)
    const restoreMs = Date.now() - t3

    assertUnder("track", trackMs, PERF_LIMIT.trackMs)
    assertUnder("diffFull(100)", diffMs, PERF_LIMIT.diffMs)
    assertUnder("restore(100)", restoreMs, PERF_LIMIT.restoreMs)
    return { trackMs, diffMs, restoreMs, diffCount: fd.length }
  })
}

async function suite_long_running_project(): Promise<SuiteResult> {
  // Long-lived project: 50 mutate+track cycles, then prove ANY of the
  // captured hashes is still restorable. Disk grows monotonically because
  // we deliberately don't expose a per-snapshot prune API (see R1 / the
  // gc.no-destructive-api suite). Whole-project reclaim is ProjectGC.
  const dir = await makeRepo("longrun")
  await fs.writeFile(path.join(dir, "a.txt"), "A0")

  return await inInstance(dir, async () => {
    const baseline = await Snapshot.track()
    assertHash(baseline, "baseline")

    const liveHashes = [baseline]
    const liveContents = ["A0"]
    for (let i = 0; i < 50; i++) {
      const content = `payload-${i}-` + "x".repeat(2048)
      await fs.writeFile(path.join(dir, "a.txt"), content)
      const h = await Snapshot.track()
      if (typeof h === "string" && SHA1_RE.test(h)) {
        liveHashes.push(h)
        liveContents.push(content)
      }
    }

    const gitdir = path.join(Global.Path.data, "snapshot", Instance.project.id)
    const sizeBytes = await dirSize(gitdir)

    // Spot-check: baseline + middle + last all restorable independently.
    const checks = [0, Math.floor(liveHashes.length / 2), liveHashes.length - 1]
    for (const idx of checks) {
      await fs.writeFile(path.join(dir, "a.txt"), "scrambled-during-spotcheck")
      await Snapshot.restore(liveHashes[idx])
      const got = await fs.readFile(path.join(dir, "a.txt"), "utf-8")
      if (got !== liveContents[idx]) throw new Error(`hash idx=${idx} not restorable: got "${got.slice(0, 32)}…"`)
    }

    return { sizeBytes, hashes: liveHashes.length }
  })
}

// ---------------------------------------------------------------------------

const suites: Suite[] = [
  { name: "core.roundtrip", run: suite_core_roundtrip },
  { name: "core.restore-removes-extras", run: suite_restore_removes_extras },
  { name: "gc.no-destructive-api", run: suite_gc_no_destructive_api },
  { name: "gc.two-snapshots-both-survive", run: suite_gc_two_snapshots_both_survive },
  { name: "concurrency.parallel-track", run: suite_concurrency_parallel_track },
  { name: "boundary.unicode-and-space", run: suite_boundary_unicode_and_space },
  { name: "boundary.binary-and-large", run: suite_boundary_binary_and_large },
  { name: "boundary.exclude-baseline", run: suite_boundary_exclude_baseline },
  { name: "perf.thousand-files", run: suite_perf_thousand_files },
  { name: "disk.long-running-project", run: suite_long_running_project },
]

async function main() {
  const filter = process.env.SNAPSHOT_BENCH_ONLY
  const idleMs = benchmarkIdleMs()
  const activity = withStreamActivity({ idleMs, label: "snapshot-benchmark" })
  let pass = 0
  let fail = 0
  const cleanupErrors: string[] = []
  const t0 = Date.now()
  try {
    for (const s of suites) {
      if (filter && !s.name.includes(filter)) continue
      activity.observe()
      const start = Date.now()
      try {
        const metrics = await runWithIdleSignal(s.run(), activity.signal)
        activity.observe()
        const dur = Date.now() - start
        const tail = metrics ? ` ${JSON.stringify(metrics)}` : ""
        console.log(`[ok]   ${s.name} dur=${dur}ms${tail}`)
        pass++
      } catch (err) {
        const dur = Date.now() - start
        const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err)
        console.log(`[fail] ${s.name} dur=${dur}ms\n        ${msg.replace(/\n/g, "\n        ")}`)
        fail++
        if (activity.timedOut()) break
      }
    }
  } finally {
    activity.dispose()
    try {
      await Instance.disposeAll()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      cleanupErrors.push(`instance.disposeAll: ${message}`)
      console.log(`[cleanup] instance.disposeAll failed: ${message}`)
    } finally {
      try {
        Database.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        cleanupErrors.push(`database.close: ${message}`)
        console.log(`[cleanup] database close failed: ${message}`)
      }
      try {
        await Log.close()
        await removeManagedDirectoryTree(benchmarkHome)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        cleanupErrors.push(`managed-directory.remove: ${message}`)
        console.log(`[cleanup] managed benchmark directory removal failed: ${message}`)
      }
    }
  }
  console.log(
    `\nresult: pass=${pass} fail=${fail} cleanup_fail=${cleanupErrors.length} total=${pass + fail} elapsed=${Date.now() - t0}ms idleMs=${idleMs}`,
  )
  process.exit(fail > 0 || cleanupErrors.length > 0 ? 1 : 0)
}

async function runWithIdleSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener("abort", onAbort, { once: true })
  })
  try {
    return await Promise.race([work, aborted])
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  }
}

await main()
