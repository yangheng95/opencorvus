import { afterAll, describe, expect, test } from "bun:test"
import { createServer, type Server } from "node:http"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Discovery } from "@/skill/discovery"
import { Skill } from "@/skill/skill"
import { SkillManager } from "@/skill/manager"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

type RemoteSkillFixture = {
  server: Server
  source: string
  requestCount: (path: string) => number
}

const fixtures: RemoteSkillFixture[] = []

afterAll(async () => {
  await Promise.all(fixtures.map((fixture) => new Promise<void>((resolve) => fixture.server.close(() => resolve()))))
})

async function remoteSkillFixture(input: {
  name: string
  supportingContent: string
  truncateFirstSupportingResponse?: boolean
}): Promise<RemoteSkillFixture> {
  const requests = new Map<string, number>()
  const skill = [
    "---",
    `name: ${input.name}`,
    `description: ${input.name} remote publication fixture`,
    "---",
    "",
    `# ${input.name}`,
    "",
    "Read references/guide.md before acting.",
  ].join("\n")
  const index = JSON.stringify({
    skills: [{ name: input.name, description: `${input.name} fixture`, files: ["SKILL.md", "references/guide.md"] }],
  })
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://fixture.invalid").pathname.replace(/^\/skills\.pub/, "")
    const count = (requests.get(pathname) ?? 0) + 1
    requests.set(pathname, count)
    if (pathname === "/index.json") {
      response.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(index) })
      response.end(index)
      return
    }
    if (pathname === `/${encodeURIComponent(input.name)}/SKILL.md`) {
      response.writeHead(200, { "content-type": "text/markdown", "content-length": Buffer.byteLength(skill) })
      response.end(skill)
      return
    }
    if (pathname === `/${encodeURIComponent(input.name)}/references/guide.md`) {
      if (input.truncateFirstSupportingResponse && count === 1) {
        response.writeHead(200, {
          "content-type": "text/markdown",
          "content-length": Buffer.byteLength(input.supportingContent) + 32,
        })
        response.write(input.supportingContent.slice(0, Math.max(1, Math.floor(input.supportingContent.length / 2))))
        response.destroy()
        return
      }
      response.writeHead(200, {
        "content-type": "text/markdown",
        "content-length": Buffer.byteLength(input.supportingContent),
      })
      response.end(input.supportingContent)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Remote Skill fixture did not bind a TCP port")
  const fixture = {
    server,
    source: `http://127.0.0.1:${address.port}/skills.pub/`,
    requestCount: (requestPath: string) => requests.get(requestPath) ?? 0,
  }
  fixtures.push(fixture)
  return fixture
}

describe.serial("Remote Skill cache publication", () => {
  test("a failed stream retries every file and installs one verified production snapshot", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
    const name = `remote-publication-${crypto.randomUUID()}`
    const supportingContent = "# Complete guide\n\nUse the fully published supporting evidence.\n"
    const fixture = await remoteSkillFixture({ name, supportingContent, truncateFirstSupportingResponse: true })
    const firstIssues: string[] = []
    await Discovery.pull(fixture.source, (issue) => firstIssues.push(issue))
    expect(firstIssues).toEqual([
      expect.stringContaining(`Remote Skill ${JSON.stringify(name)} from ${fixture.source} was ignored`),
    ])

    const retryIssues: string[] = []
    const retrySnapshots = await Discovery.pull(fixture.source, (issue) => retryIssues.push(issue))
    if (retrySnapshots.length !== 1) throw new Error(`Retry did not publish one snapshot: ${JSON.stringify(retryIssues)}`)
    expect({
      skillRequests: fixture.requestCount(`/${encodeURIComponent(name)}/SKILL.md`),
      supportingRequests: fixture.requestCount(`/${encodeURIComponent(name)}/references/guide.md`),
    }).toEqual({ skillRequests: 2, supportingRequests: 2 })
    const installation = await SkillManager.install({ kind: "url", value: fixture.source, policy: "allow" })
    Config.global.reset()
    await Config.state.resetAll()
    await Skill.state.resetAll()
    const configured = await Config.getGlobal()
    const installedInventory = (await SkillManager.installed()).find((skill) => skill.name === name)
    if (!installedInventory) throw new Error(`Installed Remote Skill ${name} is absent from the production inventory`)
    await expect(SkillManager.update({ name, source: "server" })).rejects.toThrow(
      `Skill is not writable for server update: ${name}`,
    )
    const root = path.dirname(installedInventory.location)
    if (!root) throw new Error(`Installed Remote Skill ${name} has no published directory`)
    const manifest = await Discovery.requirePublishedSnapshot(root, { source: fixture.source, skill: name })
    const runtime = await Skill.globalSummaries()
    const installed = runtime.skills.find((skill) => skill.name === name)
    if (!installed) throw new Error(`Installed Remote Skill ${name} is absent from the production catalog`)
    const materialized = installedInventory.location
    await Skill.materialize({
      name,
      description: installed.description,
      aliases: [],
      platforms: [],
      builtin: false,
      location: materialized,
      content: await Filesystem.readText(materialized),
      priority: 0,
      required_tools: [],
    })
    expect({
      installation,
      configuredUrls: configured.skills?.urls,
      installed,
      runtime,
      manifest,
      supportingContent: await readFile(path.join(path.dirname(materialized), "references", "guide.md"), "utf8"),
    }).toMatchObject({
      installation: { source: fixture.source, kind: "url" },
      configuredUrls: expect.arrayContaining([fixture.source]),
      installed: { name },
      runtime: { skills: expect.arrayContaining([{ name, description: `${name} remote publication fixture` }]) },
      manifest: {
        schema_version: 1,
        source: fixture.source,
        skill: name,
        files: [
          { path: "SKILL.md", bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
          { path: "references/guide.md", bytes: Buffer.byteLength(supportingContent), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
        ],
        snapshot_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      supportingContent,
    })
    expect(installedInventory).toMatchObject({
      name,
      source_type: "config_url",
      source: fixture.source,
      location: materialized,
      writable: false,
      trust: "community",
    })
    } })
  }, 30_000)

  test("same-named Skills from different URLs publish source-separated verified snapshots", async () => {
    const name = `remote-source-identity-${crypto.randomUUID()}`
    const left = await remoteSkillFixture({ name, supportingContent: "left source bytes" })
    const right = await remoteSkillFixture({ name, supportingContent: "right source bytes" })
    const leftIssues: string[] = []
    const rightIssues: string[] = []
    const [leftRoots, rightRoots] = await Promise.all([
      Discovery.pull(left.source, (issue) => leftIssues.push(issue)),
      Discovery.pull(right.source, (issue) => rightIssues.push(issue)),
    ])
    const leftRoot = leftRoots[0]
    const rightRoot = rightRoots[0]
    if (!leftRoot || !rightRoot) {
      throw new Error(`Both Remote Skill sources must publish a snapshot: ${JSON.stringify({ leftIssues, rightIssues })}`)
    }
    const [leftManifest, rightManifest] = await Promise.all([
      Discovery.requirePublishedSnapshot(leftRoot, { source: left.source, skill: name }),
      Discovery.requirePublishedSnapshot(rightRoot, { source: right.source, skill: name }),
    ])
    const hash = (value: string) => createHash("sha256").update(value).digest("hex")
    expect({
      left: { root: leftRoot, source: leftManifest.source, digest: leftManifest.snapshot_digest },
      right: { root: rightRoot, source: rightManifest.source, digest: rightManifest.snapshot_digest },
    }).toEqual({
      left: {
        root: path.join(
          Discovery.dir(),
          "sources",
          hash(left.source),
          "skills",
          hash(name),
          "snapshots",
          leftManifest.snapshot_digest,
        ),
        source: left.source,
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      right: {
        root: path.join(
          Discovery.dir(),
          "sources",
          hash(right.source),
          "skills",
          hash(name),
          "snapshots",
          rightManifest.snapshot_digest,
        ),
        source: right.source,
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    })
  }, 30_000)
})
