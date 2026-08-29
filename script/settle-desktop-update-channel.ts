#!/usr/bin/env bun

import fs from "node:fs/promises"
import { compare } from "semver"
import { desktopUpdateChannelTag, type DesktopUpdateChannel } from "./desktop-update-channel"
import {
  DesktopUpdateManifestValidationError,
  parseDesktopUpdateManifest,
  type DesktopUpdateManifest,
} from "./desktop-update-manifest"
import { releaseVersionMetadata } from "./release-version"

export type DesktopChannelSettlement = {
  kind: "current" | "promoted" | "superseded"
  version: string
  channel: DesktopUpdateChannel
}

export interface DesktopChannelAuthority {
  readManifest(): Promise<string | undefined>
  ensureRelease(): Promise<void>
  uploadManifest(content: string): Promise<void>
}

export class DesktopChannelSettlementError extends Error {
  constructor(
    readonly code: "desktop_channel_api_failure" | "desktop_channel_invalid_manifest" | "desktop_channel_unsettled",
    message: string,
  ) {
    super(message)
    this.name = "DesktopChannelSettlementError"
  }
}

function manifest(text: string, repository: string): DesktopUpdateManifest {
  try {
    return parseDesktopUpdateManifest(text, { repository })
  } catch (error) {
    if (!(error instanceof DesktopUpdateManifestValidationError)) throw error
    throw new DesktopChannelSettlementError("desktop_channel_invalid_manifest", error.message)
  }
}

export async function settleDesktopUpdateChannel(
  input: { version: string; channel: DesktopUpdateChannel; repository: string; candidate: string },
  authority: DesktopChannelAuthority,
): Promise<DesktopChannelSettlement> {
  const version = releaseVersionMetadata(input.version).version
  const candidate = manifest(input.candidate, input.repository)
  if (candidate.version !== version) {
    throw new DesktopChannelSettlementError(
      "desktop_channel_invalid_manifest",
      `Candidate channel manifest is ${candidate.version}, expected ${version}`,
    )
  }

  const currentText = await authority.readManifest()
  if (currentText !== undefined) {
    const current = manifest(currentText, input.repository)
    if (compare(current.version, version) > 0) {
      return { kind: "superseded", version: current.version, channel: input.channel }
    }
    if (current.version === version && currentText === input.candidate) {
      return { kind: "current", version, channel: input.channel }
    }
  }

  await authority.ensureRelease()
  await authority.uploadManifest(input.candidate)
  const settledText = await authority.readManifest()
  if (settledText === undefined) {
    throw new DesktopChannelSettlementError(
      "desktop_channel_unsettled",
      `Desktop ${input.channel} channel did not settle on ${version}`,
    )
  }
  manifest(settledText, input.repository)
  if (settledText !== input.candidate) {
    throw new DesktopChannelSettlementError(
      "desktop_channel_unsettled",
      `Desktop ${input.channel} channel did not settle on ${version}`,
    )
  }
  return { kind: "promoted", version, channel: input.channel }
}

type CommandResult = { exitCode: number; stdout: string; stderr: string }

async function gh(args: string[]): Promise<CommandResult> {
  const child = Bun.spawn(["gh", ...args], { env: process.env, stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

function status(result: CommandResult): number | undefined {
  const match = `${result.stdout}\n${result.stderr}`.match(/^HTTP\/\S+\s+(\d{3})\b/m)
  return match ? Number(match[1]) : undefined
}

function apiFailure(endpoint: string, result: CommandResult): DesktopChannelSettlementError {
  return new DesktopChannelSettlementError(
    "desktop_channel_api_failure",
    `GitHub API could not settle ${endpoint} (status=${status(result) ?? "unavailable"}, exit=${result.exitCode})`,
  )
}

export function parseDesktopChannelReleaseAuthority(
  tag: string,
  release: unknown,
): { assets: Array<{ id: number; name: string }> } {
  if (
    typeof release !== "object" ||
    release === null ||
    !("tag_name" in release) ||
    release.tag_name !== tag ||
    !("draft" in release) ||
    release.draft !== false ||
    !("prerelease" in release) ||
    release.prerelease !== true ||
    !("assets" in release) ||
    !Array.isArray(release.assets)
  ) {
    throw new DesktopChannelSettlementError(
      "desktop_channel_api_failure",
      `GitHub API returned an invalid channel authority for ${tag}`,
    )
  }
  const assets = release.assets.filter(
    (asset): asset is { id: number; name: string } =>
      typeof asset === "object" &&
      asset !== null &&
      "id" in asset &&
      typeof asset.id === "number" &&
      Number.isSafeInteger(asset.id) &&
      "name" in asset &&
      typeof asset.name === "string",
  )
  if (assets.length !== release.assets.length) {
    throw new DesktopChannelSettlementError(
      "desktop_channel_api_failure",
      `GitHub API returned invalid channel assets for ${tag}`,
    )
  }
  return { assets }
}

class GitHubDesktopChannelAuthority implements DesktopChannelAuthority {
  readonly tag: string
  readonly endpoint: string

  constructor(
    readonly repository: string,
    readonly channel: DesktopUpdateChannel,
    readonly candidatePath: string,
  ) {
    this.tag = desktopUpdateChannelTag(channel)
    this.endpoint = `repos/${repository}/releases/tags/${this.tag}`
  }

  private async release(): Promise<{ assets: Array<{ id: number; name: string }> } | undefined> {
    const probe = await gh(["api", "--include", "--silent", this.endpoint])
    const probeStatus = status(probe)
    if (probe.exitCode !== 0) {
      if (probeStatus === 404) return undefined
      throw apiFailure(this.endpoint, probe)
    }
    if (probeStatus !== 200) throw apiFailure(this.endpoint, probe)
    const read = await gh(["api", this.endpoint])
    if (read.exitCode !== 0) throw apiFailure(this.endpoint, read)
    let release: unknown
    try {
      release = JSON.parse(read.stdout)
    } catch {
      throw new DesktopChannelSettlementError(
        "desktop_channel_api_failure",
        `GitHub API returned invalid JSON for ${this.endpoint}`,
      )
    }
    return parseDesktopChannelReleaseAuthority(this.tag, release)
  }

  async readManifest(): Promise<string | undefined> {
    const release = await this.release()
    if (!release) return undefined
    const assets = release.assets.filter(({ name }) => name === "latest.json")
    if (assets.length === 0) return undefined
    if (assets.length !== 1) {
      throw new DesktopChannelSettlementError(
        "desktop_channel_api_failure",
        `Desktop channel ${this.tag} has ${assets.length} latest.json assets`,
      )
    }
    const endpoint = `repos/${this.repository}/releases/assets/${assets[0]!.id}`
    const download = await gh(["api", endpoint, "-H", "Accept: application/octet-stream"])
    if (download.exitCode !== 0) throw apiFailure(endpoint, download)
    return download.stdout
  }

  async ensureRelease(): Promise<void> {
    const endpoint = `repos/${this.repository}/releases`
    const create = await gh([
      "api",
      "--method",
      "POST",
      "--include",
      "--silent",
      endpoint,
      "-f",
      `tag_name=${this.tag}`,
      "-f",
      `name=OpenCorvus ${this.channel} desktop update channel`,
      "-f",
      "body=Mutable signed desktop update metadata. Installers remain in immutable versioned releases.",
      "-F",
      "draft=false",
      "-F",
      "prerelease=true",
    ])
    const createStatus = status(create)
    if (!((createStatus === 201 && create.exitCode === 0) || createStatus === 422)) {
      throw apiFailure(endpoint, create)
    }
    if (!(await this.release())) {
      throw new DesktopChannelSettlementError(
        "desktop_channel_api_failure",
        `Desktop channel Release ${this.tag} was not created`,
      )
    }
  }

  async uploadManifest(_content: string): Promise<void> {
    const upload = await gh(["release", "upload", this.tag, this.candidatePath, "--clobber", "--repo", this.repository])
    if (upload.exitCode !== 0) throw apiFailure(`${this.tag}/latest.json`, upload)
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

if (import.meta.main) {
  try {
    const version = requiredEnvironment("VERSION")
    const channel = requiredEnvironment("UPDATE_CHANNEL")
    if (channel !== "beta" && channel !== "stable") throw new Error(`Invalid UPDATE_CHANNEL ${channel}`)
    const candidatePath = requiredEnvironment("CANDIDATE_MANIFEST")
    const candidate = await fs.readFile(candidatePath, "utf8")
    const repository = requiredEnvironment("GITHUB_REPOSITORY")
    const result = await settleDesktopUpdateChannel(
      { version, channel, repository, candidate },
      new GitHubDesktopChannelAuthority(repository, channel, candidatePath),
    )
    const promoted = result.kind !== "superseded"
    await fs.appendFile(requiredEnvironment("GITHUB_OUTPUT"), `promoted=${String(promoted)}\n`)
    console.log(`Desktop ${channel} channel ${result.kind} at ${result.version}`)
  } catch (error) {
    if (error instanceof DesktopChannelSettlementError) console.error(`${error.code}: ${error.message}`)
    else console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
