import { beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ChannelAdapter, IncomingMessage } from "../src/adapter"
import { SessionCoordinator } from "../src/session-coordinator"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

function adapter(sent: string[] = []): ChannelAdapter {
  return {
    platform: "slack",
    start: async () => {},
    stop: async () => {},
    sendMessage: async (_channel, _thread, text) => {
      sent.push(text)
    },
    uploadImage: async () => {},
    onMessage: () => {},
  }
}

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), "opencorvus-channel-runtime-"))
}

function incoming(thread: string, text: string): IncomingMessage {
  return {
    id: `slack-event-${thread}-${text}`,
    platform: "slack",
    channel: "C1",
    thread,
    user: "U1",
    text,
  }
}

beforeEach(() => {
  process.env.OPENCORVUS_SHARED_SESSION_MODE = "0"
})

describe("channel runtime session isolation", () => {
  test("creates separate sessions for separate slack threads when shared mode is off", async () => {
    const createCalls: Array<{ title: string }> = []
    const promptCalls: Array<{ sessionID: string; text: string }> = []
    const ids = ["session_1", "session_2"]
    const a = adapter()

    const core = new ChannelRuntime() as unknown as {
      adapters: ChannelAdapter[]
      session: SessionCoordinator<{ sessionId: string; adapter: ChannelAdapter; channel: string; thread: string }>
      client: {
        session: {
          create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
          prompt(input: {
            sessionID: string
            parts: Array<{ type: "text"; text: string }>
            system: string
          }): Promise<{ error?: unknown; data: { taskID: string } }>
        }
      }
      handleMessage(msg: IncomingMessage): Promise<void>
    }

    core.adapters = [a]
    core.client = {
      session: {
        create: async (input) => {
          createCalls.push(input)
          const id = ids.shift()
          if (!id) throw new Error("unexpected extra session.create call")
          return { data: { id } }
        },
        prompt: async (input) => {
          promptCalls.push({
            sessionID: input.sessionID,
            text: input.parts[0]?.text ?? "",
          })
          return { data: { taskID: `task_${input.sessionID}` } }
        },
      },
    }

    await core.handleMessage(incoming("T1", "hello one"))
    await core.handleMessage(incoming("T2", "hello two"))

    expect(createCalls).toHaveLength(2)
    expect(promptCalls).toHaveLength(2)
    expect(promptCalls[0]?.sessionID).not.toBe(promptCalls[1]?.sessionID)
  })

  test("shared mode rejects corrupt shared session file without replacement session", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      await writeFile(sharedFile, "{")
      const sent: string[] = []
      const createCalls: Array<{ title: string }> = []
      const promptCalls: Array<{ sessionID: string; text: string }> = []
      const a = adapter(sent)

      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }

      core.adapters = [a]
      core.client = {
        session: {
          create: async (input) => {
            createCalls.push(input)
            return { data: { id: "shared_corrupt_replacement" } }
          },
          prompt: async (input) => {
            promptCalls.push({
              sessionID: input.sessionID,
              text: input.parts[0]?.text ?? "",
            })
            return { data: { taskID: "task_unexpected" } }
          },
        },
      }

      await core.handleMessage(incoming("T-corrupt", "hello corrupt"))

      expect(createCalls).toEqual([])
      expect(promptCalls).toEqual([])
      expect(sent).toEqual(["Failed to initialize shared session."])
      expect(await readFile(sharedFile, "utf8")).toBe("{")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test.each([
    ["missing session_id", "{}\n"],
    ["non-string session_id", '{"session_id": 123}\n'],
    ["empty session_id", '{"session_id": "   "}\n'],
  ])("shared mode rejects invalid shared session file shape: %s", async (_name, content) => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      await writeFile(sharedFile, content)
      const sent: string[] = []
      const createCalls: Array<{ title: string }> = []
      const promptCalls: Array<{ sessionID: string; text: string }> = []
      const a = adapter(sent)

      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }

      core.adapters = [a]
      core.client = {
        session: {
          create: async (input) => {
            createCalls.push(input)
            return { data: { id: "shared_invalid_replacement" } }
          },
          prompt: async (input) => {
            promptCalls.push({
              sessionID: input.sessionID,
              text: input.parts[0]?.text ?? "",
            })
            return { data: { taskID: "task_unexpected" } }
          },
        },
      }

      await core.handleMessage(incoming("T-invalid", "hello invalid"))

      expect(createCalls).toEqual([])
      expect(promptCalls).toEqual([])
      expect(sent).toEqual(["Failed to initialize shared session."])
      expect(await readFile(sharedFile, "utf8")).toBe(content)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("shared mode fails before session create when shared file directory is unusable", async () => {
    const dir = await tempDir()
    try {
      const blocker = path.join(dir, "not-a-directory")
      await writeFile(blocker, "block")
      const sharedFile = path.join(blocker, "shared-session.json")
      const sent: string[] = []
      const createCalls: Array<{ title: string }> = []
      const promptCalls: Array<{ sessionID: string; text: string }> = []
      const a = adapter(sent)

      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }

      core.adapters = [a]
      core.client = {
        session: {
          create: async (input) => {
            createCalls.push(input)
            return { data: { id: "shared_unwritable_replacement" } }
          },
          prompt: async (input) => {
            promptCalls.push({
              sessionID: input.sessionID,
              text: input.parts[0]?.text ?? "",
            })
            return { data: { taskID: "task_unexpected" } }
          },
        },
      }

      await core.handleMessage(incoming("T-unwritable", "hello unwritable"))

      expect(createCalls).toEqual([])
      expect(promptCalls).toEqual([])
      expect(sent).toEqual(["Failed to initialize shared session."])
      expect(await readFile(blocker, "utf8")).toBe("block")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("shared mode persists a new shared session before using it", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "nested", "shared-session.json")
      const createCalls: Array<{ title: string }> = []
      const promptCalls: Array<{ sessionID: string; text: string }> = []
      const a = adapter()

      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }

      core.adapters = [a]
      core.client = {
        session: {
          create: async (input) => {
            createCalls.push(input)
            return { data: { id: "shared_persisted" } }
          },
          prompt: async (input) => {
            expect(JSON.parse(await readFile(sharedFile, "utf8")).session_id).toBe(input.sessionID)
            promptCalls.push({
              sessionID: input.sessionID,
              text: input.parts[0]?.text ?? "",
            })
            return { data: { taskID: `task_${input.sessionID}` } }
          },
        },
      }

      await core.handleMessage(incoming("T1", "first shared"))
      expect(JSON.parse(await readFile(sharedFile, "utf8")).session_id).toBe("shared_persisted")

      const secondCore = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }
      secondCore.adapters = [a]
      secondCore.client = core.client

      await secondCore.handleMessage(incoming("T2", "second shared"))

      expect(createCalls).toHaveLength(1)
      expect(promptCalls.map((item) => item.sessionID)).toEqual(["shared_persisted", "shared_persisted"])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("two runtime owners atomically claim one shared session", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      const createCalls: string[] = []
      const promptCalls: string[] = []
      const makeCore = () => {
        const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
          adapters: ChannelAdapter[]
          client: {
            session: {
              create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
              prompt(input: {
                sessionID: string
                parts: Array<{ type: "text"; text: string }>
              }): Promise<{ error?: unknown; data: { taskID: string } }>
            }
          }
          handleMessage(msg: IncomingMessage): Promise<void>
        }
        core.adapters = [adapter()]
        core.client = {
          session: {
            create: async (input) => {
              createCalls.push(input.title)
              await new Promise<void>((resolve) => setTimeout(resolve, 20))
              return { data: { id: "shared_single_owner" } }
            },
            prompt: async (input) => {
              promptCalls.push(input.sessionID)
              return { data: { taskID: `task_${input.sessionID}` } }
            },
          },
        }
        return core
      }

      const first = makeCore()
      const second = makeCore()
      await Promise.all([
        first.handleMessage(incoming("T-owner-1", "first owner")),
        second.handleMessage(incoming("T-owner-2", "second owner")),
      ])

      expect(createCalls).toHaveLength(1)
      expect(promptCalls).toEqual(["shared_single_owner", "shared_single_owner"])
      expect(JSON.parse(await readFile(sharedFile, "utf8")).session_id).toBe("shared_single_owner")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("atomic shared-session publication never exposes partial JSON to concurrent readers", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      await writeFile(sharedFile, '{"session_id":"seed","updated_at":0}\n')
      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        writeSharedSessionFile(file: string, sessionId: string): Promise<void>
      }
      let writing = true
      let invalidReads = 0
      let reads = 0
      const reader = (async () => {
        while (writing) {
          const value = await readFile(sharedFile, "utf8")
          reads += 1
          try {
            const parsed = JSON.parse(value) as { session_id?: unknown }
            if (typeof parsed.session_id !== "string" || !parsed.session_id) invalidReads += 1
          } catch {
            invalidReads += 1
          }
        }
      })()

      await Promise.all(
        Array.from({ length: 100 }, (_, index) => core.writeSharedSessionFile(sharedFile, `shared_atomic_${index}`)),
      )
      writing = false
      await reader

      expect(reads).toBeGreaterThan(0)
      expect(invalidReads).toBe(0)
      expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("failed atomic publication preserves the canonical target and removes temporary files", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      await mkdir(sharedFile)
      await writeFile(path.join(sharedFile, "owner"), "canonical")
      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        writeSharedSessionFile(file: string, sessionId: string): Promise<void>
      }

      await expect(core.writeSharedSessionFile(sharedFile, "unpublished")).rejects.toThrow()

      expect(await readFile(path.join(sharedFile, "owner"), "utf8")).toBe("canonical")
      expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("shared mode does not bind or prompt when post-create shared file write fails", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      const sent: string[] = []
      const createCalls: Array<{ title: string }> = []
      const promptCalls: Array<{ sessionID: string; text: string }> = []
      const a = adapter(sent)

      const core = new ChannelRuntime({ sharedMode: true, sharedFile }) as unknown as {
        adapters: ChannelAdapter[]
        sharedSessionId?: string
        writeSharedSessionFile(file: string, sessionId: string): Promise<void>
        client: {
          session: {
            create(input: { title: string }): Promise<{ error?: unknown; data: { id: string } }>
            prompt(input: {
              sessionID: string
              parts: Array<{ type: "text"; text: string }>
              system: string
            }): Promise<{ error?: unknown; data: { taskID: string } }>
          }
        }
        handleMessage(msg: IncomingMessage): Promise<void>
      }

      core.adapters = [a]
      core.writeSharedSessionFile = async () => {
        throw new Error("write denied")
      }
      core.client = {
        session: {
          create: async (input) => {
            createCalls.push(input)
            return { data: { id: "shared_unpersisted" } }
          },
          prompt: async (input) => {
            promptCalls.push({
              sessionID: input.sessionID,
              text: input.parts[0]?.text ?? "",
            })
            return { data: { taskID: "task_unexpected" } }
          },
        },
      }

      await core.handleMessage(incoming("T-write-fail", "hello write fail"))

      expect(createCalls).toHaveLength(1)
      expect(promptCalls).toEqual([])
      expect(core.sharedSessionId).toBeUndefined()
      expect(sent).toEqual(["Failed to initialize shared session."])
      await expect(Bun.file(sharedFile).exists()).resolves.toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("start rejects corrupt shared session file before starting adapters", async () => {
    const dir = await tempDir()
    try {
      const sharedFile = path.join(dir, "shared-session.json")
      await writeFile(sharedFile, "{")
      let started = 0
      const a = {
        ...adapter(),
        start: async () => {
          started += 1
        },
      }
      const core = new ChannelRuntime({
        baseUrl: "http://127.0.0.1:17777",
        directory: dir,
        sharedMode: true,
        sharedFile,
      })
      core.register(a)

      await expect(core.start()).rejects.toThrow("Invalid shared session file JSON")
      expect(started).toBe(0)
      expect((core as unknown as { running: boolean }).running).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
