import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { SkillManager } from "@/skill/manager"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

const cases = [
  ["official-https", "https://github.com/openai/skills.git", "official"],
  ["official-https-default-port", "https://github.com:443/anthropics/skills", "official"],
  ["official-scp", "git@github.com:openai/skills.git", "official"],
  ["official-ssh", "ssh://git@github.com/anthropics/skills.git", "official"],
  ["official-ssh-default-port", "ssh://git@github.com:22/openai/skills", "official"],
  ["curated-skills-sh", "https://skills.sh/catalog/example/", "curated"],
  ["curated-skillstore", "https://skillstore.io/skills/example", "curated"],
  ["community-skills-pub", "https://skills.pub/catalog/example", "community"],
  ["unknown-http-official", "http://github.com/openai/skills", "unknown"],
  ["unknown-http-market", "http://skills.pub/catalog/example", "unknown"],
  ["unknown-similar-host", "https://github.com.evil.invalid/openai/skills", "unknown"],
  ["unknown-userinfo-host", "https://github.com@evil.invalid/openai/skills", "unknown"],
  ["unknown-empty-userinfo", "https://@github.com/openai/skills", "unknown"],
  ["unknown-userinfo-market", "https://user@skills.sh/catalog/example", "unknown"],
  ["unknown-query", "https://github.com/openai/skills?redirect=evil", "unknown"],
  ["unknown-empty-query", "https://github.com/openai/skills?", "unknown"],
  ["unknown-fragment", "https://skills.pub/catalog/example#trusted", "unknown"],
  ["unknown-empty-fragment", "https://github.com/openai/skills#", "unknown"],
  ["unknown-dot-segment", "https://github.com/evil/../openai/skills", "unknown"],
  ["unknown-encoded-dot-segment", "https://github.com/evil/%2e%2e/openai/skills", "unknown"],
  ["unknown-extra-path", "https://github.com/openai/skills/releases", "unknown"],
  ["unknown-non-default-port", "https://skills.sh:8443/catalog/example", "unknown"],
  ["unknown-ssh-user", "ssh://root@github.com/openai/skills.git", "unknown"],
  ["unknown-ssh-password", "ssh://git:secret@github.com/openai/skills.git", "unknown"],
  ["unknown-ssh-query", "ssh://git@github.com/openai/skills.git?ref=main", "unknown"],
  ["unknown-scp-host", "git@github.com.evil.invalid:openai/skills.git", "unknown"],
  ["unknown-scheme", "git://github.com/openai/skills.git", "unknown"],
] as const

async function writeSkill(root: string, name: string, source?: string) {
  const directory = path.join(root, name)
  await mkdir(directory, { recursive: true })
  await writeFile(
    path.join(directory, "SKILL.md"),
    ["---", `name: ${name}`, `description: ${name} trust fixture`, "---", "", `# ${name}`, ""].join("\n"),
  )
  if (source !== undefined) {
    await writeFile(
      path.join(directory, ".opencorvus-skill-source.json"),
      JSON.stringify({ kind: "git", source, installed_at: Date.now() }),
    )
  }
}

describe.serial("Skill source trust identity", () => {
  test("production installed inventory classifies exact source identities", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = path.join(project.path, `skill-trust-${crypto.randomUUID()}`)
        for (const [name, source] of cases) await writeSkill(root, name, source)
        await writeSkill(root, "local-without-source")

        await SkillManager.install({ kind: "path", value: root, policy: "allow" })
        const installed = new Map((await SkillManager.installed()).map((skill) => [skill.name, skill]))

        expect(
          cases.map(([name, source, trust]) => ({
            name,
            source: installed.get(name)?.source,
            trust: installed.get(name)?.trust,
            expected: trust,
          })),
        ).toEqual(cases.map(([name, source, trust]) => ({ name, source, trust, expected: trust })))
        expect(installed.get("local-without-source")).toMatchObject({
          name: "local-without-source",
          source_type: "config_path",
          trust: "local",
        })
      },
    })
  })
})
