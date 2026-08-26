const [action, projectID, requestedCut, requestedIndex] = process.argv.slice(2)
if (!action)
  throw new Error(
    "usage: skill-replacement-child <setup|import|import-cut|import-hold|import-version|contend-version|mcp-write|revision-tie|forge-path|tamper-backup|inspect|watch-cache|hold-projection> [project-id] [cut-or-version] [index-or-policy]",
  )

const { Instance } = await import("../../src/project/instance")
const { ImplicitProject } = await import("../../src/project/implicit-project")
const { Project } = await import("../../src/project/project")
const { SkillManager } = await import("../../src/skill/manager")
const { SkillReplacementPublication } = await import("../../src/skill/replacement-publication")
const { Skill } = await import("../../src/skill/skill")
const { Config } = await import("../../src/config/config")
const { Global } = await import("../../src/global")
const fs = await import("node:fs/promises")
const path = await import("node:path")

const names = ["replacement-alpha", "replacement-beta"]

function files(version: "old" | "new") {
  return names.map((name) => ({
    path: `${name}/SKILL.md`,
    content: `---\nname: ${name}\ndescription: ${version} ${name}\n---\n\n# ${version} ${name}\n`,
  }))
}

async function importVersion(directory: string, version: "old" | "new", policy: "allow" | "deny") {
  return Instance.provide({
    directory,
    fn: () => SkillManager.importFile({ files: files(version), policy }),
  })
}

async function installedSnapshot(directory: string) {
  return Instance.provide({
    directory,
    fn: async () =>
      (await SkillManager.installed())
        .filter((skill) => names.includes(skill.name))
        .map((skill) => ({ name: skill.name, description: skill.description, policy: skill.policy }))
        .sort((left, right) => left.name.localeCompare(right.name)),
  })
}

if (action === "setup") {
  const anonymous = await ImplicitProject.create()
  await importVersion(anonymous.directory, "old", "allow")
  process.stdout.write(`${JSON.stringify({ projectID: anonymous.project.id, directory: anonymous.directory })}\n`)
} else {
  const project = Project.get(projectID!)
  if (!project) throw new Error(`Project not found: ${projectID}`)
  if (
    action === "import" ||
    action === "import-cut" ||
    action === "import-hold" ||
    action === "import-version" ||
    action === "contend-version"
  ) {
    if (action === "import-cut") {
      SkillManager.ReplacementTestHooks.setCutHook((cut, index) => {
        if (cut === requestedCut && (requestedIndex === undefined || Number(requestedIndex) === index)) {
          process.kill(process.pid, "SIGKILL")
        }
      })
    }
    if (action === "import-hold") {
      const runtimeRoot = process.env.OPENCORVUS_HOME
      if (!runtimeRoot) throw new Error("OPENCORVUS_HOME is required")
      SkillManager.ReplacementTestHooks.setCutHook(async (cut) => {
        if (cut !== requestedCut) return
        await fs.writeFile(path.join(runtimeRoot, `skill-replacement-${cut}-holder-ready`), "ready\n", "utf8")
        const resume = path.join(runtimeRoot, `skill-replacement-${cut}-holder-resume`)
        while (true) {
          const resumed = await fs.stat(resume).then(
            () => true,
            () => false,
          )
          if (resumed) break
          await Bun.sleep(10)
        }
      })
    }
    const version =
      (action === "import-version" || action === "contend-version") && requestedCut === "old" ? "old" : "new"
    const policy =
      (action === "import-version" || action === "contend-version") && requestedIndex === "allow" ? "allow" : "deny"
    if (action === "contend-version") {
      const runtimeRoot = process.env.OPENCORVUS_HOME
      if (!runtimeRoot) throw new Error("OPENCORVUS_HOME is required")
      await fs.writeFile(path.join(runtimeRoot, "skill-replacement-projection-attempt"), "attempt\n", "utf8")
    }
    await importVersion(project.worktree, version, policy)
    process.stdout.write(`${JSON.stringify({ imported: true, completedAt: Date.now() })}\n`)
  } else if (action === "mcp-write") {
    const runtimeRoot = process.env.OPENCORVUS_HOME
    if (!runtimeRoot) throw new Error("OPENCORVUS_HOME is required")
    const mcpName = requestedCut ?? "skill-replacement-race-mcp"
    await fs.writeFile(path.join(runtimeRoot, `skill-replacement-${mcpName}-attempt`), "attempt\n", "utf8")
    const configPath = await Config.resolveMcpConfigFile({
      baseDirectory: Global.Path.config,
      global: true,
    })
    await Config.writeMcpConfigEntry(mcpName, { type: "local", command: ["echo", "ready"] }, configPath)
    process.stdout.write(`${JSON.stringify({ configuredAt: Date.now() })}\n`)
  } else if (action === "revision-tie") {
    const target = path.join(project.worktree, ".opencorvus", "skill", names[0]!)
    const digest = await SkillReplacementPublication.digest(target)
    const recordTerminal = async (operationID: string) => {
      await SkillReplacementPublication.record({
        operationID,
        timeCreated: 1,
        targets: [
          {
            name: names[0]!,
            target,
            staging: path.join(path.dirname(target), `.skill-update-${operationID}-0`),
            backup: path.join(path.dirname(target), `.skill-replace-${operationID}-0`),
            beforeDigest: digest,
            afterDigest: digest,
          },
        ],
        requireExisting: true,
        configuration: { kind: "none" },
        globalConfigBeforeRevision: "tie",
      })
      await SkillReplacementPublication.settle(operationID, "committed")
      return SkillReplacementPublication.revision()
    }
    const high = await recordTerminal("ffffffff-ffff-4fff-bfff-ffffffffffff")
    const low = await recordTerminal("00000000-0000-4000-8000-000000000000")
    process.stdout.write(`${JSON.stringify({ high, low })}\n`)
  } else if (action === "forge-path") {
    const operationID = crypto.randomUUID()
    const target = path.join(project.worktree, ".opencorvus", "skill", names[0]!)
    const digest = await SkillReplacementPublication.digest(target)
    await SkillReplacementPublication.record({
      operationID,
      timeCreated: Date.now(),
      targets: [
        {
          name: names[0]!,
          target,
          staging: path.join(path.dirname(target), "foreign-staging"),
          backup: path.join(path.dirname(target), "foreign-backup"),
          beforeDigest: digest,
          afterDigest: digest,
        },
      ],
      requireExisting: true,
      configuration: { kind: "none" },
      globalConfigBeforeRevision: "forged",
    })
    process.stdout.write(`${JSON.stringify({ forged: operationID, target })}\n`)
  } else if (action === "tamper-backup") {
    const occurrence = await SkillReplacementPublication.open()
    if (!occurrence) throw new Error("No open Skill replacement")
    await fs.appendFile(path.join(occurrence.targets[0]!.backup, "SKILL.md"), "\nforeign backup mutation\n")
    process.stdout.write(`${JSON.stringify({ tampered: occurrence.targets[0]!.backup })}\n`)
  } else if (action === "watch-cache") {
    const runtimeRoot = process.env.OPENCORVUS_HOME
    if (!runtimeRoot) throw new Error("OPENCORVUS_HOME is required")
    const ready = path.join(runtimeRoot, "skill-replacement-cache-ready.json")
    const resume = path.join(runtimeRoot, "skill-replacement-cache-resume")
    const before = await installedSnapshot(project.worktree)
    await fs.writeFile(ready, JSON.stringify(before), "utf8")
    while (true) {
      const resumed = await fs.stat(resume).then(
        () => true,
        () => false,
      )
      if (resumed) break
      await Bun.sleep(10)
    }
    process.stdout.write(`${JSON.stringify({ before, after: await installedSnapshot(project.worktree) })}\n`)
  } else if (action === "hold-projection") {
    const runtimeRoot = process.env.OPENCORVUS_HOME
    if (!runtimeRoot) throw new Error("OPENCORVUS_HOME is required")
    const ready = path.join(runtimeRoot, "skill-replacement-projection-ready")
    const resume = path.join(runtimeRoot, "skill-replacement-projection-resume")
    const result = await Instance.provide({
      directory: project.worktree,
      fn: () =>
        SkillManager.withCatalogProjection(async () => {
          const descriptions = (await Skill.all())
            .filter((skill) => names.includes(skill.name))
            .map((skill) => skill.description)
            .sort()
          await fs.writeFile(ready, "ready\n", "utf8")
          while (true) {
            const resumed = await fs.stat(resume).then(
              () => true,
              () => false,
            )
            if (resumed) break
            await Bun.sleep(10)
          }
          return { descriptions, releasedAt: Date.now() }
        }),
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } else if (action === "inspect") {
    const result = await Instance.provide({
      directory: project.worktree,
      fn: async () => {
        const skills = (await Skill.all())
          .filter((skill) => names.includes(skill.name))
          .map((skill) => ({ name: skill.name, description: skill.description }))
          .sort((left, right) => left.name.localeCompare(right.name))
        const config = await Config.getGlobal()
        return {
          skills,
          policies: Object.fromEntries(names.map((name) => [name, config.skill_policy?.[name]])),
          mcpRaceTypes: {
            catalog: config.mcp?.["catalog-race-mcp"]?.type,
            configured: config.mcp?.["configured-race-mcp"]?.type,
          },
          occurrences: await SkillReplacementPublication.all(),
          contents: await Promise.all(
            names.map((name) =>
              fs.readFile(path.join(project.worktree, ".opencorvus", "skill", name, "SKILL.md"), "utf8"),
            ),
          ),
        }
      },
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } else {
    throw new Error(`unknown action: ${action}`)
  }
}
