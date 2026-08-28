import { expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

async function waitForFile(file: string) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (
      await fs.stat(file).then(
        () => true,
        () => false,
      )
    )
      return
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for fixture receipt ${file}`)
}

test("a multi-Skill catalog converges one complete revision across killed backend occurrences", async () => {
  const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "skill-replacement-crash-"))
  const fixture = path.join(import.meta.dir, "fixture", "skill-replacement-child.ts")
  const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  const run = (args: string[]) =>
    Bun.spawn([process.execPath, fixture, ...args], {
      cwd: path.join(import.meta.dir, ".."),
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
  const output = async (child: ReturnType<typeof run>) => {
    const stdout = await new Response(child.stdout).text()
    const stderr = await new Response(child.stderr).text()
    return { exit: await child.exited, stdout, stderr }
  }

  try {
    const setup = await output(run(["setup"]))
    expect(setup.exit).toBe(0)
    const prepared = JSON.parse(setup.stdout.trim().split(/\r?\n/).at(-1)!) as { projectID: string }

    const cacheWatcher = run(["watch-cache", prepared.projectID])
    const cacheReady = path.join(runtimeRoot, "skill-replacement-cache-ready.json")
    await waitForFile(cacheReady)
    const cachedBefore = JSON.parse(await fs.readFile(cacheReady, "utf8")) as Array<{
      description: string
      policy: string
    }>
    expect(cachedBefore.map(({ description, policy }) => ({ description, policy }))).toEqual([
      { description: "old replacement-alpha", policy: "allow" },
      { description: "old replacement-beta", policy: "allow" },
    ])
    const cachePublisher = await output(run(["import-version", prepared.projectID, "new", "deny"]))
    expect(cachePublisher.exit).toBe(0)
    await fs.writeFile(path.join(runtimeRoot, "skill-replacement-cache-resume"), "resume\n", "utf8")
    const cacheRefresh = await output(cacheWatcher)
    expect(cacheRefresh.exit).toBe(0)
    const refreshedCache = JSON.parse(cacheRefresh.stdout.trim().split(/\r?\n/).at(-1)!) as {
      after: Array<{ description: string; policy: string }>
    }
    expect(refreshedCache.after.map(({ description, policy }) => ({ description, policy }))).toEqual([
      { description: "new replacement-alpha", policy: "deny" },
      { description: "new replacement-beta", policy: "deny" },
    ])
    const restoredFixture = await output(run(["import-version", prepared.projectID, "old", "allow"]))
    expect(restoredFixture.exit).toBe(0)

    const projectionHolder = run(["hold-projection", prepared.projectID])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-projection-ready"))
    const projectionContender = run(["contend-version", prepared.projectID, "new", "deny"])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-projection-attempt"))
    await fs.writeFile(path.join(runtimeRoot, "skill-replacement-projection-resume"), "resume\n", "utf8")
    const [heldProjection, contendedPublication] = await Promise.all([
      output(projectionHolder),
      output(projectionContender),
    ])
    expect([heldProjection.exit, contendedPublication.exit]).toEqual([0, 0])
    const held = JSON.parse(heldProjection.stdout.trim().split(/\r?\n/).at(-1)!) as {
      descriptions: string[]
      releasedAt: number
    }
    const afterProjectionRace = await output(run(["inspect", prepared.projectID]))
    expect(afterProjectionRace.exit).toBe(0)
    const projectionRace = JSON.parse(afterProjectionRace.stdout.trim().split(/\r?\n/).at(-1)!) as {
      skills: Array<{ description: string }>
      occurrences: Array<{ timeCreated: number; terminal?: string }>
    }
    expect({
      heldDescriptions: held.descriptions,
      publishedDescriptions: projectionRace.skills.map((skill) => skill.description),
      publicationAfterRelease: projectionRace.occurrences.at(-1)!.timeCreated >= held.releasedAt,
      terminal: projectionRace.occurrences.at(-1)!.terminal,
    }).toEqual({
      heldDescriptions: ["old replacement-alpha", "old replacement-beta"],
      publishedDescriptions: ["new replacement-alpha", "new replacement-beta"],
      publicationAfterRelease: true,
      terminal: "committed",
    })
    const resetAfterProjectionRace = await output(run(["import-version", prepared.projectID, "old", "allow"]))
    expect(resetAfterProjectionRace.exit).toBe(0)

    const configHolder = run(["import-hold", prepared.projectID, "catalog-published"])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-catalog-published-holder-ready"))
    const configWriter = run(["mcp-write", prepared.projectID, "catalog-race-mcp"])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-catalog-race-mcp-attempt"))
    await fs.writeFile(path.join(runtimeRoot, "skill-replacement-catalog-published-holder-resume"), "resume\n", "utf8")
    const [heldReplacement, contendedConfig] = await Promise.all([output(configHolder), output(configWriter)])
    expect([heldReplacement.exit, contendedConfig.exit]).toEqual([0, 0])
    const catalogHolderReceipt = JSON.parse(heldReplacement.stdout.trim().split(/\r?\n/).at(-1)!) as {
      completedAt: number
    }
    const catalogWriterReceipt = JSON.parse(contendedConfig.stdout.trim().split(/\r?\n/).at(-1)!) as {
      configuredAt: number
    }
    expect(catalogWriterReceipt.configuredAt >= catalogHolderReceipt.completedAt).toBe(true)
    const afterConfigRace = await output(run(["inspect", prepared.projectID]))
    expect(afterConfigRace.exit).toBe(0)
    const configRace = JSON.parse(afterConfigRace.stdout.trim().split(/\r?\n/).at(-1)!) as {
      skills: Array<{ description: string }>
      policies: Record<string, string>
      mcpRaceTypes: { catalog?: string; configured?: string }
      occurrences: Array<{ terminal?: string }>
    }
    expect({
      descriptions: configRace.skills.map((skill) => skill.description),
      policies: configRace.policies,
      mcpRaceType: configRace.mcpRaceTypes.catalog,
      terminal: configRace.occurrences.at(-1)?.terminal,
    }).toEqual({
      descriptions: ["new replacement-alpha", "new replacement-beta"],
      policies: { "replacement-alpha": "deny", "replacement-beta": "deny" },
      mcpRaceType: "local",
      terminal: "committed",
    })
    const resetAfterConfigRace = await output(run(["import-version", prepared.projectID, "old", "allow"]))
    expect(resetAfterConfigRace.exit).toBe(0)

    const intentOnly = await output(run(["import-cut", prepared.projectID, "intent-published"]))
    expect(intentOnly.exit).not.toBe(0)
    const intentRecovery = await output(run(["inspect", prepared.projectID]))
    expect(intentRecovery.exit).toBe(0)
    const afterIntent = JSON.parse(intentRecovery.stdout.trim().split(/\r?\n/).at(-1)!) as {
      skills: Array<{ description: string }>
      policies: Record<string, string>
      occurrences: Array<{ terminal?: string }>
    }
    expect({
      descriptions: afterIntent.skills.map((skill) => skill.description),
      policies: afterIntent.policies,
      terminal: afterIntent.occurrences.at(-1)?.terminal,
    }).toEqual({
      descriptions: ["old replacement-alpha", "old replacement-beta"],
      policies: { "replacement-alpha": "allow", "replacement-beta": "allow" },
      terminal: "rolled_back",
    })

    const backedUp = await output(run(["import-cut", prepared.projectID, "target-backed-up", "0"]))
    expect(backedUp.exit).not.toBe(0)
    const backupRecovery = await output(run(["inspect", prepared.projectID]))
    expect(backupRecovery.exit).toBe(0)
    const restoredBackup = JSON.parse(backupRecovery.stdout.trim().split(/\r?\n/).at(-1)!) as {
      skills: Array<{ name: string; description: string }>
      policies: Record<string, string>
      occurrences: Array<{ terminal?: string }>
      contents: string[]
    }
    expect({
      descriptions: restoredBackup.skills.map((skill) => skill.description),
      policies: restoredBackup.policies,
      terminal: restoredBackup.occurrences.at(-1)?.terminal,
    }).toEqual({
      descriptions: ["old replacement-alpha", "old replacement-beta"],
      policies: { "replacement-alpha": "allow", "replacement-beta": "allow" },
      terminal: "rolled_back",
    })

    const secondBackedUp = await output(run(["import-cut", prepared.projectID, "target-backed-up", "1"]))
    expect(secondBackedUp.exit).not.toBe(0)
    const secondBackupRecovery = await output(run(["inspect", prepared.projectID]))
    expect(secondBackupRecovery.exit).toBe(0)
    const secondRestoredBackup = JSON.parse(
      secondBackupRecovery.stdout.trim().split(/\r?\n/).at(-1)!,
    ) as typeof restoredBackup
    expect({
      descriptions: secondRestoredBackup.skills.map((skill) => skill.description),
      policies: secondRestoredBackup.policies,
      terminal: secondRestoredBackup.occurrences.at(-1)?.terminal,
    }).toEqual({
      descriptions: ["old replacement-alpha", "old replacement-beta"],
      policies: { "replacement-alpha": "allow", "replacement-beta": "allow" },
      terminal: "rolled_back",
    })

    const partial = await output(run(["import-cut", prepared.projectID, "target-installed", "0"]))
    expect(partial.exit).not.toBe(0)
    const backward = await output(run(["inspect", prepared.projectID]))
    expect(backward.exit).toBe(0)
    const rolledBack = JSON.parse(backward.stdout.trim().split(/\r?\n/).at(-1)!) as typeof restoredBackup
    expect({
      descriptions: rolledBack.skills.map((skill) => skill.description),
      policies: rolledBack.policies,
      terminal: rolledBack.occurrences.at(-1)?.terminal,
      contents: rolledBack.contents.map((content) => content.includes("# old ")),
    }).toEqual({
      descriptions: ["old replacement-alpha", "old replacement-beta"],
      policies: { "replacement-alpha": "allow", "replacement-beta": "allow" },
      terminal: "rolled_back",
      contents: [true, true],
    })

    const completeTargets = await output(run(["import-cut", prepared.projectID, "target-installed", "1"]))
    expect(completeTargets.exit).not.toBe(0)
    const completeTargetRecovery = await output(run(["inspect", prepared.projectID]))
    expect(completeTargetRecovery.exit).toBe(0)
    const recoveredCompleteTargets = JSON.parse(
      completeTargetRecovery.stdout.trim().split(/\r?\n/).at(-1)!,
    ) as typeof rolledBack
    expect({
      descriptions: recoveredCompleteTargets.skills.map((skill) => skill.description),
      policies: recoveredCompleteTargets.policies,
      terminal: recoveredCompleteTargets.occurrences.at(-1)?.terminal,
      contents: recoveredCompleteTargets.contents.map((content) => content.includes("# new ")),
    }).toEqual({
      descriptions: ["new replacement-alpha", "new replacement-beta"],
      policies: { "replacement-alpha": "deny", "replacement-beta": "deny" },
      terminal: "committed",
      contents: [true, true],
    })
    const resetAfterCompleteTargets = await output(run(["import-version", prepared.projectID, "old", "allow"]))
    expect(resetAfterCompleteTargets.exit).toBe(0)

    const published = await output(run(["import-cut", prepared.projectID, "catalog-published"]))
    expect(published.exit).not.toBe(0)
    const forward = await output(run(["inspect", prepared.projectID]))
    expect(forward.exit).toBe(0)
    const committed = JSON.parse(forward.stdout.trim().split(/\r?\n/).at(-1)!) as typeof rolledBack
    expect({
      descriptions: committed.skills.map((skill) => skill.description),
      policies: committed.policies,
      terminal: committed.occurrences.at(-1)?.terminal,
      contents: committed.contents.map((content) => content.includes("# new ")),
    }).toEqual({
      descriptions: ["new replacement-alpha", "new replacement-beta"],
      policies: { "replacement-alpha": "deny", "replacement-beta": "deny" },
      terminal: "committed",
      contents: [true, true],
    })

    const resetAfterCatalogPhase = await output(run(["import-version", prepared.projectID, "old", "allow"]))
    expect(resetAfterCatalogPhase.exit).toBe(0)
    const configured = await output(run(["import-cut", prepared.projectID, "configuration-published"]))
    expect(configured.exit).not.toBe(0)
    const configuredRecovery = await output(run(["inspect", prepared.projectID]))
    expect(configuredRecovery.exit).toBe(0)
    const committedConfiguration = JSON.parse(
      configuredRecovery.stdout.trim().split(/\r?\n/).at(-1)!,
    ) as typeof rolledBack
    expect({
      descriptions: committedConfiguration.skills.map((skill) => skill.description),
      policies: committedConfiguration.policies,
      terminal: committedConfiguration.occurrences.at(-1)?.terminal,
      contents: committedConfiguration.contents.map((content) => content.includes("# new ")),
    }).toEqual({
      descriptions: ["new replacement-alpha", "new replacement-beta"],
      policies: { "replacement-alpha": "deny", "replacement-beta": "deny" },
      terminal: "committed",
      contents: [true, true],
    })

    const configuredHolder = run(["import-hold", prepared.projectID, "configuration-published"])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-configuration-published-holder-ready"))
    const configuredWriter = run(["mcp-write", prepared.projectID, "configured-race-mcp"])
    await waitForFile(path.join(runtimeRoot, "skill-replacement-configured-race-mcp-attempt"))
    await fs.writeFile(
      path.join(runtimeRoot, "skill-replacement-configuration-published-holder-resume"),
      "resume\n",
      "utf8",
    )
    const [heldConfigured, contendedConfiguredWrite] = await Promise.all([
      output(configuredHolder),
      output(configuredWriter),
    ])
    expect([heldConfigured.exit, contendedConfiguredWrite.exit]).toEqual([0, 0])
    const configuredHolderReceipt = JSON.parse(heldConfigured.stdout.trim().split(/\r?\n/).at(-1)!) as {
      completedAt: number
    }
    const configuredWriterReceipt = JSON.parse(contendedConfiguredWrite.stdout.trim().split(/\r?\n/).at(-1)!) as {
      configuredAt: number
    }
    expect(configuredWriterReceipt.configuredAt >= configuredHolderReceipt.completedAt).toBe(true)
    const afterConfiguredRace = await output(run(["inspect", prepared.projectID]))
    expect(afterConfiguredRace.exit).toBe(0)
    const configuredRace = JSON.parse(afterConfiguredRace.stdout.trim().split(/\r?\n/).at(-1)!) as {
      skills: Array<{ description: string }>
      policies: Record<string, string>
      mcpRaceTypes: { catalog?: string; configured?: string }
      occurrences: Array<{ terminal?: string }>
    }
    expect({
      descriptions: configuredRace.skills.map((skill) => skill.description),
      policies: configuredRace.policies,
      mcpRaceTypes: configuredRace.mcpRaceTypes,
      terminal: configuredRace.occurrences.at(-1)?.terminal,
    }).toEqual({
      descriptions: ["new replacement-alpha", "new replacement-beta"],
      policies: { "replacement-alpha": "deny", "replacement-beta": "deny" },
      mcpRaceTypes: { catalog: "local", configured: "local" },
      terminal: "committed",
    })

    const contenders = await Promise.all([
      output(run(["import-version", prepared.projectID, "new", "deny"])),
      output(run(["import-version", prepared.projectID, "old", "allow"])),
    ])
    expect(contenders.map((item) => item.exit)).toEqual([0, 0])
    const afterRace = await output(run(["inspect", prepared.projectID]))
    expect(afterRace.exit).toBe(0)
    const raced = JSON.parse(afterRace.stdout.trim().split(/\r?\n/).at(-1)!) as typeof rolledBack
    const finalVersion = raced.skills[0]!.description.startsWith("old ") ? "old" : "new"
    const finalPolicy = finalVersion === "old" ? "allow" : "deny"
    expect({
      coherentDescriptions: raced.skills.every((skill) => skill.description.startsWith(`${finalVersion} `)),
      policies: raced.policies,
      finalTerminals: raced.occurrences.slice(-2).map((occurrence) => occurrence.terminal),
      contents: raced.contents.map((content) => content.includes(`# ${finalVersion} `)),
    }).toEqual({
      coherentDescriptions: true,
      policies: { "replacement-alpha": finalPolicy, "replacement-beta": finalPolicy },
      finalTerminals: ["committed", "committed"],
      contents: [true, true],
    })
  } finally {
    await removeManagedDirectoryTree(runtimeRoot)
  }
}, 360_000)

test("recovery preserves a changed backup whose digest no longer proves replacement ownership", async () => {
  const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "skill-replacement-foreign-"))
  const fixture = path.join(import.meta.dir, "fixture", "skill-replacement-child.ts")
  const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  const run = (args: string[]) =>
    Bun.spawn([process.execPath, fixture, ...args], {
      cwd: path.join(import.meta.dir, ".."),
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
  const output = async (child: ReturnType<typeof run>) => {
    const stdout = await new Response(child.stdout).text()
    const stderr = await new Response(child.stderr).text()
    return { exit: await child.exited, stdout, stderr }
  }

  try {
    const setup = await output(run(["setup"]))
    expect(setup.exit).toBe(0)
    const prepared = JSON.parse(setup.stdout.trim().split(/\r?\n/).at(-1)!) as { projectID: string }
    const killed = await output(run(["import-cut", prepared.projectID, "target-backed-up", "0"]))
    expect(killed.exit).not.toBe(0)
    const tamper = await output(run(["tamper-backup", prepared.projectID]))
    expect(tamper.exit).toBe(0)
    const tampered = JSON.parse(tamper.stdout.trim().split(/\r?\n/).at(-1)!) as { tampered: string }

    const recovery = await output(run(["inspect", prepared.projectID]))
    expect(recovery.exit).not.toBe(0)
    expect({
      error: recovery.stderr,
      preserved: await fs.readFile(path.join(tampered.tampered, "SKILL.md"), "utf8"),
    }).toEqual({
      error: expect.stringContaining("cannot prove rollback ownership"),
      preserved: expect.stringContaining("foreign backup mutation"),
    })
  } finally {
    await removeManagedDirectoryTree(runtimeRoot)
  }
}, 90_000)

test("recovery rejects a publication whose scratch paths are not derived from its occurrence", async () => {
  const runtimeRoot = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "skill-replacement-path-"))
  const fixture = path.join(import.meta.dir, "fixture", "skill-replacement-child.ts")
  const env = { ...process.env, OPENCORVUS_HOME: runtimeRoot }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  const run = (args: string[]) =>
    Bun.spawn([process.execPath, fixture, ...args], {
      cwd: path.join(import.meta.dir, ".."),
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
  const output = async (child: ReturnType<typeof run>) => {
    const stdout = await new Response(child.stdout).text()
    const stderr = await new Response(child.stderr).text()
    return { exit: await child.exited, stdout, stderr }
  }

  try {
    const setup = await output(run(["setup"]))
    expect(setup.exit).toBe(0)
    const prepared = JSON.parse(setup.stdout.trim().split(/\r?\n/).at(-1)!) as { projectID: string }
    const tied = await output(run(["revision-tie", prepared.projectID]))
    expect(tied.exit).toBe(0)
    const tiedRevisions = JSON.parse(tied.stdout.trim().split(/\r?\n/).at(-1)!) as { high: string; low: string }
    expect(new Set([tiedRevisions.high, tiedRevisions.low]).size).toBe(2)
    const forged = await output(run(["forge-path", prepared.projectID]))
    expect(forged.exit).toBe(0)
    const forgedEntry = JSON.parse(forged.stdout.trim().split(/\r?\n/).at(-1)!) as { target: string }

    const recovery = await output(run(["inspect", prepared.projectID]))
    expect(recovery.exit).not.toBe(0)
    expect({
      error: recovery.stderr,
      preserved: await fs.readFile(path.join(forgedEntry.target, "SKILL.md"), "utf8"),
    }).toEqual({
      error: expect.stringContaining("scratch paths do not match their occurrence identity"),
      preserved: expect.stringContaining("# old replacement-alpha"),
    })
  } finally {
    await removeManagedDirectoryTree(runtimeRoot)
  }
}, 90_000)
