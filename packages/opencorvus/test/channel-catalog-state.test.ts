import { describe, expect, test } from "bun:test"
import { ChannelFieldPlaceholder, buildChannelSchema, channelEnv, channelState } from "../src/channel/catalog"
import { ChannelRegistry } from "../src/channel/registry"

describe("channel catalog configuration facts", () => {
  test.each([
    { raw: undefined, expected: { enabled: true, status: "missing" } },
    { raw: { host: "127.0.0.1" }, expected: { enabled: true, status: "partial" } },
    { raw: { host: "127.0.0.1", nick: "owned-local" }, expected: { enabled: true, status: "configured" } },
    {
      raw: { enabled: false, host: "127.0.0.1", nick: "owned-local" },
      expected: { enabled: false, status: "disabled" },
    },
  ])("projects the explicit $expected.status configuration", ({ raw, expected }) => {
    const current = channelState("irc", raw, {})
    expect({ enabled: current.enabled, status: current.status }).toEqual(expected)
  })

  test("configured channel environment retains exact existing field identities", () => {
    expect(channelEnv("irc", { host: "127.0.0.1", nick: "owned-local", tls: true }, {})).toEqual({
      IRC_HOST: "127.0.0.1",
      IRC_NICK: "owned-local",
      IRC_TLS: "true",
    })
  })

  test("configuration schema preserves the original persisted field contract", () => {
    const value = { enabled: true, host: "127.0.0.1", nick: "owned-local", tls: true }
    expect(buildChannelSchema("irc", "OwnedIRC").parse(value)).toEqual(value)
  })

  test.each([
    { kind: "example", value: "irc.libera.chat" },
    { kind: "hint", key: "channel.placeholder.matrix.since" },
  ] as const)("accepts the public $kind placeholder descriptor", (value) => {
    expect(ChannelFieldPlaceholder.parse(value)).toEqual(value)
  })

  test("registry response keeps configuration and physical runtime as separate facts", () => {
    const value = {
      id: "irc",
      name: "IRC",
      docs_url: "https://docs.openclaw.ai/channels/irc",
      status: "configured",
      runtime_status: "unavailable",
      runtime_detail: "Owned runtime diagnostic",
      fields: [
        {
          key: "host",
          labelKey: "channel.field.irc.host",
          type: "text",
          placeholder: { kind: "example", value: "irc.libera.chat" },
        },
      ],
    }
    expect(ChannelRegistry.Info.parse(value)).toEqual(value)
  })
})
