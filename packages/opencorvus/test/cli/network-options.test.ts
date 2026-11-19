import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import yargs from "yargs"
import { resolveNetworkOptions, withNetworkOptions } from "@/cli/network"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { DEFAULT_MDNS_DOMAIN, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from "@/server/defaults"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

async function resolveFrom(argv: string[], config: Config.Source = {}) {
  const root = await Global.createTemporaryDirectory("network-options-")
  try {
    return await Global.provideRoot(root, async () => {
      await mkdir(Global.Path.config, { recursive: true })
      await writeFile(path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME), JSON.stringify(config))
      Config.global.reset()
      const parser = withNetworkOptions(yargs(argv).parserConfiguration({ "populate--": true }))
      return resolveNetworkOptions(parser.parseSync())
    })
  } finally {
    await removeManagedDirectoryTree(root)
  }
}

afterEach(() => Config.global.reset())

const configured = {
  server: {
    hostname: "127.0.0.1",
    port: 40192,
    mdns: true,
    mdnsDomain: "configured.local",
    cors: ["https://configured.example"],
  },
}

describe.serial("CLI network option authority", () => {
  test.each([
    ["equals", ["--hostname=::1", "--port=0", "--mdns=false", "--mdns-domain=explicit.local", "--cors=https://explicit.example"]],
    ["separated", ["--hostname", "::1", "--port", "0", "--no-mdns", "--mdns-domain", "explicit.local", "--cors", "https://explicit.example"]],
  ])("%s syntax preserves explicit values and accumulates allowed origins", async (_label, argv) => {
    expect(await resolveFrom(argv, configured)).toEqual({
      hostname: "::1", port: 0, mdns: false, mdnsDomain: "explicit.local",
      cors: ["https://configured.example", "https://explicit.example"],
    })
  })

  test("global network values apply when CLI fields are omitted", async () => {
    expect(await resolveFrom(["--", "--port", "0"], configured)).toEqual(configured.server)
  })

  test("an unconfigured listener uses the shared defaults", async () => {
    expect(await resolveFrom([])).toEqual({
      hostname: DEFAULT_SERVER_HOST, port: DEFAULT_SERVER_PORT, mdns: false,
      mdnsDomain: DEFAULT_MDNS_DOMAIN, cors: [],
    })
  })

  test("mDNS uses the discovery host when no host is configured", async () => {
    expect(await resolveFrom(["--mdns"])).toEqual({
      hostname: "0.0.0.0", port: DEFAULT_SERVER_PORT, mdns: true,
      mdnsDomain: DEFAULT_MDNS_DOMAIN, cors: [],
    })
  })
})
