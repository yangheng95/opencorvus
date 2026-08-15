import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import type { ChannelAdapter, IncomingMessage } from "../src/adapter"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)
mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")
let oldFetch: typeof globalThis.fetch

function installFetchMock(
  handler: (...args: Parameters<typeof globalThis.fetch>) => ReturnType<typeof globalThis.fetch>,
) {
  globalThis.fetch = Object.assign(handler, { preconnect: oldFetch.preconnect })
}

function adapter(
  platform: "slack" | "telegram" | "discord" | "feishu" | "googlechat",
  sent: string[],
  uploads: Array<{ channel: string; thread: string; filename: string; title?: string }>,
  urlUploads?: Array<{ channel: string; thread: string; url: string; filename: string; title?: string }>,
): ChannelAdapter {
  return {
    platform,
    start: async () => {},
    stop: async () => {},
    sendMessage: async (channel, thread, text) => {
      sent.push(`${channel}:${thread}:${text}`)
    },
    uploadImage: async (channel, thread, _imageBuffer, filename, title) => {
      uploads.push({ channel, thread, filename, title })
    },
    ...(urlUploads
      ? {
          uploadImageUrl: async (channel, thread, url, filename, title) => {
            urlUploads.push({ channel, thread, url, filename, title })
          },
        }
      : {}),
    onMessage: () => {},
  }
}

function incoming(platform: "slack" | "telegram" | "discord" | "googlechat", text: string): IncomingMessage {
  return {
    id: `${platform}-event-${text}`,
    platform,
    channel: platform === "telegram" ? "chat-1" : platform === "googlechat" ? "spaces/AAA" : "ch-1",
    thread: platform === "telegram" ? "101" : platform === "googlechat" ? "spaces/AAA/threads/t-1" : "root-1",
    user: "u-1",
    text,
  }
}

beforeEach(() => {
  oldFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = oldFetch
})

describe("channel runtime channel protocol", () => {
  test("routes telegram messages through channel.message and uploads image attachments", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const calls: Array<unknown> = []
    const a = adapter("telegram", sent, uploads)
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      client: {
        channel: {
          message(input: unknown): Promise<{
            error?: unknown
            data: {
              kind: "panel_response"
              message_id: string
              control_session_id: string
              task_id: string
              attachments: Array<{ mime: string; url: string; filename?: string }>
            }
          }>
        }
        session: {
          message(input: unknown): Promise<{
            error?: unknown
            data: { parts: Array<{ type: "text"; text: string }> }
          }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      channel: {
        message: async (input) => {
          calls.push(input)
          return {
            data: {
              kind: "panel_response",
              message_id: "msg_control_final",
              control_session_id: "ses_control",
              task_id: "task_1",
              attachments: [
                {
                  mime: "image/png",
                  filename: "opencorvus-gui.png",
                  url: "data:image/png;base64,aGVsbG8=",
                },
              ],
            },
          }
        },
      },
      session: {
        message: async (input) => {
          calls.push(input)
          return {
            data: {
              parts: [{ type: "text", text: "Captured OpenCorvus GUI." }],
            },
          }
        },
      },
    }

    await core.handleMessage({ ...incoming("telegram", "send gui"), id: "telegram-event-101" })

    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual({
      platform: "telegram",
      channel: "chat-1",
      thread: "101",
      text: "send gui",
      user_id: "u-1",
      request_id: "telegram-event-101",
      source: "telegram",
      allow_create: true,
    })
    expect(calls[1]).toEqual({
      sessionID: "ses_control",
      messageID: "msg_control_final",
    })
    expect(sent).toEqual(["chat-1:101:Captured OpenCorvus GUI."])
    expect(uploads).toEqual([
      {
        channel: "chat-1",
        thread: "101",
        filename: "opencorvus-gui.png",
        title: "Captured OpenCorvus GUI.",
      },
    ])
  })

  test("surfaces channel ingress failure after sending a visible failure notice", async () => {
    const sent: string[] = []
    const a = adapter("slack", sent, [])
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      client: {
        channel: {
          message(input: unknown): Promise<{ error: { message: string } }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      channel: {
        message: async () => ({ error: { message: "temporary database failure" } }),
      },
    }

    await expect(core.handleMessage({ ...incoming("slack", "retry on failure"), id: "slack-event-1" })).rejects.toThrow(
      "temporary database failure",
    )
    expect(sent).toEqual(["ch-1:root-1:Failed to handle message."])
  })

  test("publishes Task completion back to the bound discord thread", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const a = adapter("discord", sent, uploads)
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      client: {
        channel: {
          message(input: unknown): Promise<{
            error?: unknown
            data: {
              kind: "created"
              message: string
              task_id: string
            }
          }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
      handleEvent(event: unknown): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      channel: {
        message: async () => ({
          data: {
            kind: "created",
            message: "Task accepted: `task_2`",
            task_id: "task_2",
          },
        }),
      },
    }

    await core.handleMessage(incoming("discord", "run evaluation"))
    await core.handleEvent({
      type: "task.completed",
      properties: {
        taskID: "task_2",
        status: "completed",
        summary: "All checks passed",
      },
    })

    expect(sent).toEqual(["ch-1:root-1:Task accepted: `task_2`", "ch-1:root-1:Task completed: All checks passed"])
    expect(uploads).toHaveLength(0)
  })

  test("hydrates task completion bindings from durable task bindings after runtime restart", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const a = adapter("discord", sent, uploads)
    const bindingCalls: Array<unknown> = []
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      client: {
        task: {
          bindings(input: unknown): Promise<{
            error?: unknown
            data?: Array<{
              id: string
              task_id: string
              platform: string
              channel: string
              thread: string
            }>
          }>
        }
      }
      handleEvent(event: unknown): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      task: {
        bindings: async (input) => {
          bindingCalls.push(input)
          return {
            data: [
              {
                id: "binding_1",
                task_id: "task_3",
                platform: "discord",
                channel: "ch-durable",
                thread: "root-durable",
              },
            ],
          }
        },
      },
    }

    await core.handleEvent({
      type: "task.completed",
      properties: {
        taskID: "task_3",
        status: "completed",
        summary: "Accepted after restart",
      },
    })

    expect(bindingCalls).toEqual([{ taskID: "task_3" }])
    expect(sent).toEqual(["ch-durable:root-durable:Task completed: Accepted after restart"])
    expect(uploads).toHaveLength(0)
  })

  test("routes feishu messages through the shared channel protocol", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const calls: Array<unknown> = []
    const a = adapter("feishu", sent, uploads)
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      client: {
        channel: {
          message(input: unknown): Promise<{
            error?: unknown
            data: {
              kind: "panel_response"
              message: string
              attachments: Array<{ mime: string; url: string; filename?: string }>
            }
          }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      channel: {
        message: async (input) => {
          calls.push(input)
          return {
            data: {
              kind: "panel_response",
              message: "Captured OpenCorvus GUI.",
              attachments: [
                {
                  mime: "image/png",
                  filename: "overlay.png",
                  url: "data:image/png;base64,aGVsbG8=",
                },
              ],
            },
          }
        },
      },
    }

    await core.handleMessage({
      id: "feishu-event-om-1",
      platform: "feishu",
      channel: "oc_1",
      thread: "om_1",
      user: "ou_1",
      text: "send gui",
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      platform: "feishu",
      channel: "oc_1",
      thread: "om_1",
      text: "send gui",
      user_id: "ou_1",
      request_id: "feishu-event-om-1",
      source: "feishu",
      allow_create: true,
    })
    expect(sent).toEqual(["oc_1:om_1:Captured OpenCorvus GUI."])
    expect(uploads).toEqual([
      {
        channel: "oc_1",
        thread: "om_1",
        filename: "overlay.png",
        title: "Captured OpenCorvus GUI.",
      },
    ])
  })

  test("publishes URL attachments for channels that require remote image URLs", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const urlUploads: Array<{ channel: string; thread: string; url: string; filename: string; title?: string }> = []
    const calls: Array<unknown> = []
    const a = adapter("googlechat", sent, uploads, urlUploads)
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      serverUrl: string
      directory: string
      client: {
        channel: {
          message(input: unknown): Promise<{
            error?: unknown
            data: {
              kind: "panel_response"
              message: string
              attachments: Array<{ mime: string; url: string; filename?: string }>
            }
          }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.serverUrl = "http://127.0.0.1:7878"
    core.directory = "D:/repo/runtime"
    core.client = {
      channel: {
        message: async (input) => {
          calls.push(input)
          return {
            data: {
              kind: "panel_response",
              message: "Captured OpenCorvus GUI.",
              attachments: [
                {
                  mime: "image/png",
                  filename: "overlay.png",
                  url: "data:image/png;base64,aGVsbG8=",
                },
              ],
            },
          }
        },
      },
    }
    installFetchMock(async (input, init) => {
      const url = new URL(String(input))
      expect(url.origin).toBe("http://127.0.0.1:7878")
      expect(url.pathname).toBe("/channel/attachment")
      expect(url.searchParams.get("directory")).toBe("D:/repo/runtime")
      expect(init?.method).toBe("POST")
      return Response.json({
        id: "att_test",
        url: "https://public.opencorvus.dev/channel/attachment/att_test?e=1&s=1",
        mime: "image/png",
        filename: "overlay.png",
        expires_at: 1,
      })
    })

    await core.handleMessage(incoming("googlechat", "send gui"))

    expect(calls).toHaveLength(1)
    expect(sent).toEqual(["spaces/AAA:spaces/AAA/threads/t-1:Captured OpenCorvus GUI."])
    expect(uploads).toHaveLength(0)
    expect(urlUploads).toEqual([
      {
        channel: "spaces/AAA",
        thread: "spaces/AAA/threads/t-1",
        url: "https://public.opencorvus.dev/channel/attachment/att_test?e=1&s=1",
        filename: "overlay.png",
        title: "Captured OpenCorvus GUI.",
      },
    ])
  })

  test("surfaces URL attachment upload failures instead of uploading binary copy", async () => {
    const sent: string[] = []
    const uploads: Array<{ channel: string; thread: string; filename: string; title?: string }> = []
    const a: ChannelAdapter = {
      ...adapter("googlechat", sent, uploads),
      uploadImageUrl: async () => {
        throw new Error("url upload failed")
      },
    }
    const core = new ChannelRuntime({ channelProtocol: true }) as unknown as {
      adapters: ChannelAdapter[]
      serverUrl: string
      directory: string
      client: {
        channel: {
          message(input: unknown): Promise<{
            data: {
              kind: "panel_response"
              message: string
              attachments: Array<{ mime: string; url: string; filename?: string }>
            }
          }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.serverUrl = "http://127.0.0.1:7878"
    core.directory = "D:/repo/runtime"
    core.client = {
      channel: {
        message: async () => ({
          data: {
            kind: "panel_response",
            message: "Captured OpenCorvus GUI.",
            attachments: [
              {
                mime: "image/png",
                filename: "overlay.png",
                url: "data:image/png;base64,aGVsbG8=",
              },
            ],
          },
        }),
      },
    }
    installFetchMock(async () =>
      Response.json({
        id: "att_test",
        url: "https://public.opencorvus.dev/channel/attachment/att_test?e=1&s=1",
        mime: "image/png",
        filename: "overlay.png",
        expires_at: 1,
      }),
    )

    await expect(core.handleMessage(incoming("googlechat", "send gui"))).rejects.toThrow("url upload failed")
    expect(uploads).toHaveLength(0)
  })
})
