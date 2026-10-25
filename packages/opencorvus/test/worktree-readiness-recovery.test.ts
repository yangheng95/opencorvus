import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

async function prepare() {
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "worktree-receipt-"))
  const directory = path.join(root, "project")
  await fs.mkdir(directory)
  await fs.writeFile(path.join(directory, "tracked.txt"), "original tracked bytes\n")
  const env = { ...process.env, OPENCORVUS_HOME: path.join(root, "runtime") }
  async function git(args: string[]) {
    const child = Bun.spawn(["git", ...args], { cwd: directory, env, stdout: "pipe", stderr: "pipe" })
    const [exit, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    if (exit !== 0) throw new Error(`owned git ${args[0]} failed: ${stderr}`)
  }
  for (const args of [
    ["init"],
    ["config", "user.name", "Readiness Test"],
    ["config", "user.email", "readiness@example.invalid"],
    ["config", "core.autocrlf", "false"],
    ["add", "tracked.txt"],
    ["commit", "-m", "owned baseline"],
  ])
    await git(args)
  function spawn(action: string, name: string, projectDirectory = directory) {
    return Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "fixture/worktree-readiness-child.ts"),
        action,
        projectDirectory,
        name,
      ],
      { cwd: path.join(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe" },
    )
  }
  async function output(child: ReturnType<typeof spawn>) {
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exit !== 0 && exit !== 23) throw new Error(`Owned Worktree child exited ${exit}: ${stderr}\n${stdout}`)
    return { exit, stderr, result: stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) : null }
  }
  async function wait(name: string) {
    for (let i = 0; i < 3000; i++) {
      try {
        await fs.stat(path.join(env.OPENCORVUS_HOME, name))
        return
      } catch {}
      await Bun.sleep(10)
    }
    throw new Error(`owned process barrier timed out: ${name}`)
  }
  return { root, directory, env, git, spawn, output, wait }
}

test("a successor opens a completed reset and retries the same operation with retained files and one reset effect", async () => {
  const p = await prepare()
  try {
    const setup = await p.output(p.spawn("reset-setup", "reset-completed"))
    expect({ exit: setup.exit, effects: setup.result.effects }).toEqual({ exit: 0, effects: 1 })
    expect((await p.output(p.spawn("reset-populated-cut", "reset-completed"))).exit).toBe(23)
    const [recovered, peer] = await Promise.all([
      p.output(p.spawn("reset-read", "reset-completed")),
      p.output(p.spawn("reset-read", "reset-completed")),
    ])
    expect({
      exit: peer.exit,
      id: peer.result.readiness.id,
      effects: peer.result.effects,
      tracked: peer.result.tracked,
    }).toEqual({ exit: 0, id: recovered.result.readiness.id, effects: 2, tracked: "retained reset operator bytes\n" })
    expect({
      exit: recovered.exit,
      effects: recovered.result.effects,
      tracked: recovered.result.tracked,
      ready: recovered.result.readiness.ready,
      admissions: recovered.result.admissions.length,
    }).toEqual({ exit: 0, effects: 2, tracked: "retained reset operator bytes\n", ready: true, admissions: 0 })
    const repeated = await p.output(p.spawn("reset-retry", "reset-completed"))
    expect({
      error: repeated.result.error,
      effects: repeated.result.effects,
      tracked: repeated.result.tracked,
      id: repeated.result.readiness.id,
    }).toEqual({
      error: null,
      effects: 2,
      tracked: "retained reset operator bytes\n",
      id: recovered.result.readiness.id,
    })
    const newReset = await p.output(p.spawn("reset-new", "reset-completed"))
    expect({
      error: newReset.result.error,
      effects: newReset.result.effects,
      tracked: newReset.result.tracked,
      ready: newReset.result.readiness.ready,
    }).toEqual({ error: null, effects: 3, tracked: "original tracked bytes\n", ready: true })
    const originalRetry = await p.output(p.spawn("reset-retry", "reset-completed"))
    expect({
      error: originalRetry.result.error,
      effects: originalRetry.result.effects,
      current: originalRetry.result.readiness.id,
    }).toEqual({ error: null, effects: 3, current: newReset.result.readiness.id })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

for (const cut of ["reset-hard-cut", "reset-startup-cut"]) {
  test(`a successor preserves the actual ${cut} and exposes a typed retry outcome`, async () => {
    const p = await prepare()
    try {
      const name = cut
      expect((await p.output(p.spawn("reset-setup", name))).exit).toBe(0)
      expect((await p.output(p.spawn(cut, name))).exit).toBe(23)
      const recovered = await p.output(p.spawn("reset-read", name))
      expect({
        exit: recovered.exit,
        tracked: recovered.result.tracked,
        effects: recovered.result.effects,
        recovery: recovered.result.readiness.recovery.kind,
        ready: recovered.result.readiness.ready,
        admissions: recovered.result.admissions.length,
      }).toEqual({
        exit: 0,
        tracked: "retained reset operator bytes\n",
        effects: 1,
        recovery: "startup_outcome_unknown",
        ready: false,
        admissions: 0,
      })
      const retry = await p.output(p.spawn("reset-retry", name))
      expect({
        exit: retry.exit,
        error: retry.result.error.name,
        id: retry.result.error.data.recovery.occurrenceID,
        effects: retry.result.effects,
        tracked: retry.result.tracked,
      }).toEqual({
        exit: 0,
        error: "WorktreeStartupOutcomeUnknownError",
        id: recovered.result.readiness.id,
        effects: 1,
        tracked: "retained reset operator bytes\n",
      })
      const http = await p.output(p.spawn("reset-http", name))
      expect({ status: http.result.http.status, body: http.result.http.body }).toEqual({
        status: 409,
        body: retry.result.error,
      })
    } finally {
      await removeManagedDirectoryTree(p.root)
    }
  }, 120000)
}

for (const replacement of ["recreated", "junction"]) {
  test(`a successor retires the old reset fence and preserves the actual ${replacement} resource`, async () => {
    const p = await prepare()
    try {
      const name = `reset-${replacement}`
      const setup = await p.output(p.spawn("reset-setup", name))
      const target = setup.result.directory
      expect((await p.output(p.spawn("reset-populated-cut", name))).exit).toBe(23)
      let original: string | undefined
      if (replacement === "recreated") {
        await p.git(["worktree", "remove", "--force", target])
        await p.git(["worktree", "add", "--no-checkout", target, `opencorvus/${name}`])
      } else {
        original = `${target}-original`
        await fs.rename(target, original)
        const replacementDirectory = path.join(p.root, "replacement")
        await fs.mkdir(replacementDirectory)
        await fs.symlink(replacementDirectory, target, process.platform === "win32" ? "junction" : "dir")
      }
      await fs.writeFile(path.join(target, "tracked.txt"), "replacement resource bytes\n")
      const recovered = await p.output(p.spawn("reset-read", name))
      const retired = recovered.result.sourceHistory.find(
        (item: any) => item.terminal?.payload.disposition === "resource_retired",
      )
      expect({
        exit: recovered.exit,
        effects: recovered.result.effects,
        tracked: recovered.result.tracked,
        admissions: recovered.result.admissions.length,
        disposition: retired.terminal.payload.disposition,
        source: retired.intent.payload.resetOrigin,
      }).toEqual({
        exit: 0,
        effects: 2,
        tracked: "replacement resource bytes\n",
        admissions: 0,
        disposition: "resource_retired",
        source: "historical_unknown",
      })
      if (original)
        expect(await fs.readFile(path.join(original, "tracked.txt"), "utf8")).toBe("retained reset operator bytes\n")
    } finally {
      await removeManagedDirectoryTree(p.root)
    }
  }, 120000)
}

test("a retry through a retargeted managed junction resolves its original immutable reset request", async () => {
  const p = await prepare()
  try {
    const name = "reset-request-alias"
    const setup = await p.output(p.spawn("reset-setup", name))
    const second = await p.output(p.spawn("reset-setup", "reset-other-resource"))
    expect((await p.output(p.spawn("reset-populated-cut", name))).exit).toBe(23)
    const target = setup.result.directory
    await fs.rename(target, `${target}-original`)
    await fs.symlink(second.result.directory, target, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(second.result.directory, "tracked.txt"), "second resource operator bytes\n")
    const retry = await p.output(p.spawn("reset-retry", name))
    expect({
      exit: retry.exit,
      error: retry.result.error?.name,
      effects: retry.result.effects,
      tracked: retry.result.tracked,
    }).toEqual({ exit: 0, error: "WorktreeResetFailedError", effects: 3, tracked: "second resource operator bytes\n" })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a reset entry retains its original canonical owner when a queued junction is retargeted", async () => {
  const p = await prepare()
  try {
    const name = "reset-entry-original"
    const original = await p.output(p.spawn("reset-setup", name))
    const other = await p.output(p.spawn("reset-setup", "reset-entry-other"))
    const target = original.result.directory
    await fs.rename(target, `${target}-original`)
    await fs.symlink(`${target}-original`, target, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(other.result.directory, "tracked.txt"), "entry replacement operator bytes\n")
    const outcome = await p.output(p.spawn("reset-entry-retarget", name))
    expect({
      exit: outcome.exit,
      error: outcome.result.error?.name,
      effects: outcome.result.effects,
      tracked: outcome.result.tracked,
    }).toEqual({
      exit: 0,
      error: "WorktreeResetFailedError",
      effects: 2,
      tracked: "entry replacement operator bytes\n",
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a create reuse entry maps a queued alias replacement to its preservation error", async () => {
  const p = await prepare()
  try {
    const name = "create-entry-original"
    const original = await p.output(p.spawn("reset-setup", name))
    const other = await p.output(p.spawn("reset-setup", "reset-entry-other"))
    const target = original.result.directory
    await fs.rename(target, `${target}-original`)
    await fs.symlink(`${target}-original`, target, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(other.result.directory, "tracked.txt"), "create entry replacement bytes\n")
    const outcome = await p.output(p.spawn("create-entry-retarget", name))
    expect({
      exit: outcome.exit,
      error: outcome.result.error.name,
      tracked: outcome.result.tracked,
      effects: (await fs.readFile(path.join(p.directory, "reset-effects.txt"), "utf8")).trim().split(/\r?\n/).length,
    }).toEqual({ exit: 0, error: "WorktreeCreateFailedError", effects: 2, tracked: "create entry replacement bytes\n" })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a first Git creation keeps its captured physical parent after the logical parent retargets", async () => {
  const p = await prepare()
  try {
    expect((await p.output(p.spawn("initial-project", "physical-parent"))).exit).toBe(0)
    const logicalRoot = path.join(p.directory, ".opencorvus/.r/project/worktrees")
    await fs.mkdir(path.dirname(logicalRoot), { recursive: true })
    const physicalA = path.join(p.root, "physical-parent-a"),
      physicalB = path.join(p.root, "physical-parent-b")
    await fs.mkdir(physicalA)
    await fs.mkdir(physicalB)
    await fs.symlink(physicalA, logicalRoot, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(physicalB, "operator.txt"), "different parent operator bytes\n")
    const result = await p.output(p.spawn("create-parent-retarget", "physical-parent"))
    const actual = path.join(physicalA, "physical-parent")
    console.log(
      JSON.stringify({
        case: "first-git-physical-parent",
        error: result.result.error,
        originalChild: await fs.readdir(actual).catch(() => []),
        replacementChild: await fs.readdir(path.join(physicalB, "physical-parent")).catch(() => []),
      }),
    )
    expect({
      error: result.result.error,
      admission: result.result.admission,
      effects: result.result.effects,
      directory: result.result.info?.directory,
      actual: await fs.readFile(path.join(actual, "tracked.txt"), "utf8").catch(() => "creation result missing"),
      parent: await fs.readFile(path.join(physicalB, "operator.txt"), "utf8"),
    }).toEqual({
      error: null,
      admission: "ready",
      effects: 1,
      directory: await fs.realpath(actual),
      actual: "original tracked bytes\n",
      parent: "different parent operator bytes\n",
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a reset executes at its frozen physical directory after its final alias observation", async () => {
  const p = await prepare()
  try {
    const name = "reset-late-original"
    const original = await p.output(p.spawn("reset-setup", name))
    const other = await p.output(p.spawn("reset-setup", "reset-entry-other"))
    const target = original.result.directory,
      physical = `${target}-original`
    await fs.rename(target, physical)
    await fs.symlink(physical, target, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(physical, "tracked.txt"), "original physical operator bytes\n")
    await fs.writeFile(path.join(other.result.directory, "tracked.txt"), "late replacement operator bytes\n")
    const outcome = await p.output(p.spawn("reset-late-retarget", name))
    expect({
      exit: outcome.exit,
      error: outcome.result.error,
      effects: outcome.result.effects,
      tracked: outcome.result.tracked,
      physicalTracked: await fs.readFile(path.join(physical, "tracked.txt"), "utf8"),
      effectDirectory: await fs.realpath(outcome.result.effectDirectory),
    }).toEqual({
      exit: 0,
      error: null,
      effects: 3,
      tracked: "late replacement operator bytes\n",
      physicalTracked: "original tracked bytes\n",
      effectDirectory: await fs.realpath(physical),
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a successor recovers the original physical reset after a late alias retarget and completed effect cut", async () => {
  const p = await prepare()
  try {
    const name = "reset-late-recovery"
    const original = await p.output(p.spawn("reset-setup", name))
    const other = await p.output(p.spawn("reset-setup", "reset-entry-other"))
    const target = original.result.directory,
      physical = `${target}-original`
    await fs.rename(target, physical)
    await fs.symlink(physical, target, process.platform === "win32" ? "junction" : "dir")
    await fs.writeFile(path.join(other.result.directory, "tracked.txt"), "late recovery replacement bytes\n")
    expect((await p.output(p.spawn("reset-late-cut", name))).exit).toBe(23)
    const recovered = await p.output(p.spawn("reset-read", name))
    const source = recovered.result.sourceHistory.find((item: any) => item.intent.payload.resetOperationID)
    expect({
      exit: recovered.exit,
      effects: recovered.result.effects,
      replacement: recovered.result.tracked,
      physical: await fs.readFile(path.join(physical, "tracked.txt"), "utf8"),
      admissions: recovered.result.admissions.length,
      phase: source.phases.at(-1).name,
      terminal: source.terminal.outcome,
    }).toEqual({
      exit: 0,
      effects: 3,
      replacement: "late recovery replacement bytes\n",
      physical: "late physical retained bytes\n",
      admissions: 0,
      phase: "populated",
      terminal: "committed",
    })
    const sourceRead = await p.output(p.spawn("reset-read", `${name}-original`))
    expect({
      id: sourceRead.result.readiness.id,
      ready: sourceRead.result.readiness.ready,
      tracked: sourceRead.result.tracked,
      effects: sourceRead.result.effects,
    }).toEqual({ id: source.intent.occurrenceID, ready: true, tracked: "late physical retained bytes\n", effects: 3 })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("formal Project deletion and recreation retain the old reset request generation and admit a new explicit ID", async () => {
  const p = await prepare()
  try {
    const name = "reset-generation"
    const original = await p.output(p.spawn("reset-setup", name))
    expect((await p.output(p.spawn("reset-populated-cut", name))).exit).toBe(23)
    expect((await p.output(p.spawn("reset-read", name))).result.readiness.ready).toBe(true)
    const deletion = await p.output(p.spawn("reset-delete", name))
    expect(deletion.result.deletion.status).toBe("committed")
    const current = await p.output(p.spawn("reset-setup", name))
    await fs.writeFile(path.join(current.result.directory, "tracked.txt"), "current generation operator bytes\n")
    const retry = await p.output(p.spawn("reset-retry", name))
    expect({
      projectID: current.result.projectID,
      generationOccurrences: new Set([original.result.generation, current.result.generation]).size,
      previousGeneration: deletion.result.generation,
      error: retry.result.error.name,
      effects: retry.result.effects,
      tracked: retry.result.tracked,
    }).toEqual({
      projectID: original.result.projectID,
      generationOccurrences: 2,
      previousGeneration: original.result.generation,
      error: "WorktreeResetFailedError",
      effects: 3,
      tracked: "current generation operator bytes\n",
    })
    const next = await p.output(p.spawn("reset-new", name))
    expect({
      error: next.result.error,
      effects: next.result.effects,
      ready: next.result.readiness.ready,
      generation: next.result.generation,
    }).toEqual({ error: null, effects: 4, ready: true, generation: current.result.generation })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("two logical aliases of one physical tree read its same preserved startup fact", async () => {
  const p = await prepare()
  try {
    const setup = await p.output(p.spawn("reset-setup", "alias-original"))
    expect((await p.output(p.spawn("reset-startup-cut", "alias-original"))).exit).toBe(23)
    const original = await p.output(p.spawn("reset-read", "alias-original"))
    await fs.symlink(
      setup.result.directory,
      path.join(path.dirname(setup.result.directory), "alias-reader"),
      process.platform === "win32" ? "junction" : "dir",
    )
    const alias = await p.output(p.spawn("reset-read", "alias-reader"))
    expect({
      id: alias.result.readiness.id,
      recovery: alias.result.readiness.recovery,
      tracked: alias.result.tracked,
      effects: alias.result.effects,
    }).toEqual({
      id: original.result.readiness.id,
      recovery: original.result.readiness.recovery,
      tracked: "retained reset operator bytes\n",
      effects: 1,
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a real Project reads its current receipt while another Project journal retains a damaged intent", async () => {
  const p = await prepare()
  try {
    const created = await p.output(p.spawn("create", "isolated-current"))
    const other = path.join(p.root, "other-project")
    await fs.mkdir(other)
    await fs.writeFile(path.join(other, "tracked.txt"), "other Project identity\n")
    for (const args of [
      ["init"],
      ["config", "user.name", "Other Receipt Test"],
      ["config", "user.email", "other@example.invalid"],
      ["add", "tracked.txt"],
      ["commit", "-m", "other isolated Project"],
    ])
      await p.git(["-C", other, ...args])
    const otherCreated = await p.output(p.spawn("create", "other-current", other))
    await fs.writeFile(
      path.join(otherCreated.result.occurrences[0].directory, "intent.json"),
      "other Project damaged original",
    )
    const current = await p.output(p.spawn("reuse", "isolated-current"))
    expect({
      exit: current.exit,
      admission: current.result.admission,
      effects: current.result.effects,
      id: current.result.occurrences[0].intent.occurrenceID,
    }).toEqual({ exit: 0, admission: "ready", effects: 1, id: created.result.occurrences[0].intent.occurrenceID })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("two real processes recover one reset operation under its complete subject owner", async () => {
  const p = await prepare()
  let holder: ReturnType<typeof p.spawn> | undefined
  let contender: ReturnType<typeof p.spawn> | undefined
  try {
    expect((await p.output(p.spawn("reset-setup", "reset-concurrent"))).exit).toBe(0)
    contender = p.spawn("reset-contend", "reset-concurrent")
    const contenderOutput = p.output(contender)
    await p.wait("warmed")
    holder = p.spawn("reset-hold", "reset-concurrent")
    const holderOutput = p.output(holder)
    await p.wait("holder")
    await fs.writeFile(path.join(p.env.OPENCORVUS_HOME, "start"), "start")
    await p.wait("contender")
    await fs.writeFile(path.join(p.env.OPENCORVUS_HOME, "release"), "release")
    const [first, second] = await Promise.all([holderOutput, contenderOutput])
    expect({
      first: first.exit,
      second: second.exit,
      firstError: first.result.error,
      secondError: second.result.error,
      firstEffects: first.result.effects,
      secondEffects: second.result.effects,
      id: second.result.readiness.id,
      tracked: second.result.tracked,
    }).toEqual({
      first: 0,
      second: 0,
      firstError: null,
      secondError: null,
      firstEffects: 2,
      secondEffects: 2,
      id: first.result.readiness.id,
      tracked: "retained reset operator bytes\n",
    })
  } finally {
    holder?.kill()
    contender?.kill()
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a new process settles completed population with the original edited bytes and effect", async () => {
  const p = await prepare()
  try {
    expect((await p.output(p.spawn("populated-cut", "completed"))).exit).toBe(23)
    const recovered = await p.output(p.spawn("reuse", "completed"))
    expect({
      exit: recovered.exit,
      tracked: recovered.result.tracked,
      effects: recovered.result.effects,
      admission: recovered.result.admission,
      terminal: recovered.result.occurrences[0].terminal.outcome,
    }).toEqual({ exit: 0, tracked: "retained operator bytes\n", effects: 1, admission: "ready", terminal: "committed" })
    const repeat = await p.output(p.spawn("reuse", "completed"))
    expect({
      tracked: repeat.result.tracked,
      effects: repeat.result.effects,
      id: repeat.result.occurrences[0].intent.occurrenceID,
    }).toEqual({
      tracked: recovered.result.tracked,
      effects: 1,
      id: recovered.result.occurrences[0].intent.occurrenceID,
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a new physical tree obtains its own population and retains the prior receipt", async () => {
  const p = await prepare()
  try {
    const created = await p.output(p.spawn("create", "recreated"))
    expect(created.result.admission).toBe("ready")
    const target = created.result.info.directory
    await p.git(["worktree", "remove", "--force", target])
    await p.git(["worktree", "add", "--no-checkout", target, "opencorvus/recreated"])
    const recovered = await p.output(p.spawn("reuse", "recreated"))
    expect({
      exit: recovered.exit,
      tracked: recovered.result.tracked.replaceAll("\r\n", "\n"),
      effects: recovered.result.effects,
      admission: recovered.result.admission,
      receipts: recovered.result.occurrences.map((o: any) => o.terminal.outcome).sort(),
    }).toEqual({
      exit: 0,
      tracked: "original tracked bytes\n",
      effects: 1,
      admission: "ready",
      receipts: ["committed", "committed"],
    })
    const retained = recovered.result.occurrences.find(
      (o: any) => o.intent.occurrenceID === created.result.occurrences[0].intent.occurrenceID,
    )
    expect(retained).toEqual(created.result.occurrences[0])
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("two live processes settle one population under the complete subject owner", async () => {
  const p = await prepare()
  try {
    const first = p.spawn("hold", "parallel")
    await p.wait("holder")
    const second = p.spawn("contend", "parallel")
    await p.wait("contender")
    await fs.writeFile(path.join(p.env.OPENCORVUS_HOME, "release"), "resume")
    const results = await Promise.all([p.output(first), p.output(second)])
    expect(results.map((r) => ({ exit: r.exit, effects: r.result?.effects, admission: r.result?.admission }))).toEqual([
      { exit: 0, effects: 1, admission: "ready" },
      { exit: 0, effects: 1, admission: "ready" },
    ])
    expect(results[0].result.occurrences).toEqual(results[1].result.occurrences)
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("an interrupted startup preserves its physical tree and publishes an explicit recovery result", async () => {
  const p = await prepare()
  try {
    expect((await p.output(p.spawn("startup-cut", "unknown"))).exit).toBe(23)
    const recovered = await p.output(p.spawn("reuse", "unknown"))
    expect({
      exit: recovered.exit,
      tracked: recovered.result.tracked,
      recovery: recovered.result.info.recovery.kind,
      admission: recovered.result.admission,
      event: recovered.result.events.at(-1),
      disposition: recovered.result.occurrences[0].terminal.payload.disposition,
    }).toEqual({
      exit: 0,
      tracked: "retained operator bytes\n",
      recovery: "startup_outcome_unknown",
      admission: "WorktreeStartupOutcomeUnknownError",
      event: "worktree.recovery_preserved",
      disposition: "population_preserved",
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a failed extra startup records rollback and the next creation reaches readiness", async () => {
  const p = await prepare()
  try {
    const failed = await p.output(p.spawn("fail", "failure"))
    expect({ error: failed.result.error.name, outcome: failed.result.occurrences[0].terminal.outcome }).toEqual({
      error: "WorktreeStartCommandFailedError",
      outcome: "rolled_back",
    })
    const retried = await p.output(p.spawn("create", "failure"))
    expect({
      admission: retried.result.admission,
      effects: retried.result.effects,
      outcomes: retried.result.occurrences.map((o: any) => o.terminal.outcome).sort(),
    }).toEqual({ admission: "ready", effects: 1, outcomes: ["committed", "rolled_back"] })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)

test("a renamed registered branch maps to the exact ownership error while preserving its bytes", async () => {
  const p = await prepare()
  try {
    const created = await p.output(p.spawn("create", "branch-owner"))
    const target = created.result.info.directory
    await p.git(["-C", target, "branch", "-m", "operator-preserved-branch"])
    await fs.writeFile(path.join(target, "tracked.txt"), "operator branch bytes\n")
    const reused = await p.output(p.spawn("reuse", "branch-owner"))
    expect({
      error: reused.result.error.name,
      message: reused.result.error.message,
      tracked: reused.result.tracked,
    }).toEqual({
      error: "WorktreeCreateFailedError",
      message:
        "Worktree branch identity changed: expected opencorvus/branch-owner, found operator-preserved-branch. The existing tree is preserved.",
      tracked: "operator branch bytes\n",
    })
    const recovered = await p.output(p.spawn("recover-recorded", "branch-owner"))
    expect(recovered.result).toEqual({
      recorded: {
        status: "unrecoverable",
        reason:
          "Worktree branch identity changed: expected opencorvus/branch-owner, found operator-preserved-branch; existing bytes are preserved",
      },
      tracked: "operator branch bytes\n",
    })
  } finally {
    await removeManagedDirectoryTree(p.root)
  }
}, 120000)
