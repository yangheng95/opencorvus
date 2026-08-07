import { $, semver } from "bun"
import path from "path"
import { computeNextVersion } from "./version"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = typeof rootPkg.packageManager === "string" ? rootPkg.packageManager.split("@")[1] : undefined

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const pattern = /^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/

function normalize(input?: string) {
  const value = input?.trim()
  if (!value) return undefined
  const version = value.replace(/^v(?=\d)/, "")
  if (!pattern.test(version)) {
    throw new Error(`Invalid OPENCORVUS_VERSION: ${value}`)
  }
  return version
}

const env = {
  CHANNEL: process.env["OPENCORVUS_CHANNEL"],
  BUMP: process.env["OPENCORVUS_BUMP"],
  VERSION: normalize(process.env["OPENCORVUS_VERSION"]),
  RELEASE: process.env["OPENCORVUS_RELEASE"],
}

const channel = await (async () => {
  if (env.CHANNEL) return env.CHANNEL
  if (env.BUMP) return "latest"
  if (env.VERSION && !env.VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()

const preview = channel !== "latest"

const version = await (async () => {
  if (env.VERSION) return env.VERSION
  if (preview) return `0.0.0-${channel}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`

  const latestVersion = await fetch("https://registry.npmjs.org/opencorvus-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data) => {
      if (!data || typeof data !== "object") throw new Error("invalid npm registry response")
      if (!("version" in data)) throw new Error("missing version in npm registry response")
      const next = data.version
      if (typeof next !== "string") throw new Error("invalid version in npm registry response")
      return next
    })

  return computeNextVersion(latestVersion, env.BUMP?.toLowerCase())
})()

const bot = ["dependabot[bot]", "github-actions[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]

export const Script = {
  get channel() {
    return channel
  },
  get version() {
    return version
  },
  get preview() {
    return preview
  },
  get release() {
    return !!env.RELEASE
  },
  get team() {
    return team
  },
}

console.log("opencorvus script", JSON.stringify(Script, null, 2))
