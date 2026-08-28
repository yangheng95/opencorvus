import { describe, expect, spyOn, test } from "bun:test"
import { Config } from "../src/config/config"
import { EngineConfig } from "../src/engine/config"
import {
  createSchedulerExecutionInactivityFence,
  SchedulerExecutionInactivityError,
} from "../src/scheduler/execution-inactivity"

describe("execution progress inactivity configuration ownership", () => {
  test("projects the global assistant inactivity timeout through EngineConfig", async () => {
    const getGlobal = spyOn(Config, "getGlobal").mockResolvedValue({
      assistant: {
        activity: {
          session_llm_idle_ms: 321,
          session_tool_idle_ms: 543,
          execution_progress_idle_ms: 654,
        },
      },
    } as Config.Info)
    try {
      expect(await EngineConfig.getGlobal()).toMatchObject({
        activity: {
          session_llm_idle_ms: 321,
          session_tool_idle_ms: 543,
          execution_progress_idle_ms: 654,
        },
      })
    } finally {
      getGlobal.mockRestore()
    }
  })

  test("arms the global execution fence without a Project instance context", async () => {
    const getGlobal = spyOn(EngineConfig, "getGlobal").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: {
        ...EngineConfig.defaults.activity,
        execution_progress_idle_ms: 25,
      },
    })
    try {
      using fence = await createSchedulerExecutionInactivityFence({
        occurrence: "Automation fire global-config-contract",
        signals: [],
        initialPhase: "claimed",
        configurationOwner: "global",
      })
      const reason = await new Promise<unknown>((resolve) => {
        const observe = () => resolve(fence.signal.reason)
        if (fence.signal.aborted) observe()
        else fence.signal.addEventListener("abort", observe, { once: true })
      })
      expect({ reads: getGlobal.mock.calls.length, reason }).toMatchObject({
        reads: 1,
        reason: {
          name: "SchedulerExecutionInactivityError",
          occurrence: "Automation fire global-config-contract",
          phase: "claimed",
          inactivityTimeoutMilliseconds: 25,
        } satisfies Partial<SchedulerExecutionInactivityError>,
      })
    } finally {
      getGlobal.mockRestore()
    }
  })

  test("preserves the Project configuration owner for Event fires", async () => {
    const get = spyOn(EngineConfig, "get").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: {
        ...EngineConfig.defaults.activity,
        execution_progress_idle_ms: 25,
      },
    })
    try {
      using fence = await createSchedulerExecutionInactivityFence({
        occurrence: "Event fire project-config-contract",
        signals: [],
        initialPhase: "claimed",
        configurationOwner: "project",
      })
      const reason = await new Promise<unknown>((resolve) => {
        const observe = () => resolve(fence.signal.reason)
        if (fence.signal.aborted) observe()
        else fence.signal.addEventListener("abort", observe, { once: true })
      })
      expect({ reads: get.mock.calls.length, reason }).toMatchObject({
        reads: 1,
        reason: {
          name: "SchedulerExecutionInactivityError",
          occurrence: "Event fire project-config-contract",
          phase: "claimed",
          inactivityTimeoutMilliseconds: 25,
        } satisfies Partial<SchedulerExecutionInactivityError>,
      })
    } finally {
      get.mockRestore()
    }
  })

  test("delegates Provider and Tool execution, then rearms the scheduler settlement window", async () => {
    const getGlobal = spyOn(EngineConfig, "getGlobal").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: {
        ...EngineConfig.defaults.activity,
        execution_progress_idle_ms: 25,
      },
    })
    try {
      using fence = await createSchedulerExecutionInactivityFence({
        occurrence: "Automation fire delegated-provider-contract",
        signals: [],
        initialPhase: "claimed",
        configurationOwner: "global",
      })
      const receipt = await fence.runDelegated("provider-owned execution", async () => {
        await Bun.sleep(50)
        fence.signal.throwIfAborted()
        return { kind: "durable_provider_terminal_receipt" as const }
      })
      const reason = await new Promise<unknown>((resolve) => {
        const observe = () => resolve(fence.signal.reason)
        if (fence.signal.aborted) observe()
        else fence.signal.addEventListener("abort", observe, { once: true })
      })
      expect({ receipt, reason }).toMatchObject({
        receipt: { kind: "durable_provider_terminal_receipt" },
        reason: {
          name: "SchedulerExecutionInactivityError",
          phase: "provider-owned execution",
          inactivityTimeoutMilliseconds: 25,
        },
      })
    } finally {
      getGlobal.mockRestore()
    }
  })

  test("keeps concurrent delegated owners active until the final owner settles", async () => {
    const getGlobal = spyOn(EngineConfig, "getGlobal").mockResolvedValue({
      ...EngineConfig.defaults,
      activity: { ...EngineConfig.defaults.activity, execution_progress_idle_ms: 25 },
    })
    try {
      using fence = await createSchedulerExecutionInactivityFence({
        occurrence: "Automation fire concurrent-target-contract",
        signals: [],
        initialPhase: "targets reserved",
        configurationOwner: "global",
      })
      let settleFirst!: () => void
      let settleSecond!: () => void
      const firstGate = new Promise<void>((resolve) => (settleFirst = resolve))
      const secondGate = new Promise<void>((resolve) => (settleSecond = resolve))
      const first = fence.runDelegated("target one Session owner", async () => {
        await firstGate
        return "target-one-settled" as const
      })
      const second = fence.runDelegated("target two Session owner", async () => {
        await secondGate
        return "target-two-settled" as const
      })
      await Bun.sleep(40)
      settleFirst()
      await Bun.sleep(40)
      settleSecond()
      const receipts = await Promise.all([first, second])
      const reason = await new Promise<unknown>((resolve) => {
        const observe = () => resolve(fence.signal.reason)
        if (fence.signal.aborted) observe()
        else fence.signal.addEventListener("abort", observe, { once: true })
      })
      expect({ receipts, reason }).toMatchObject({
        receipts: ["target-one-settled", "target-two-settled"],
        reason: { name: "SchedulerExecutionInactivityError", phase: "target two Session owner" },
      })
    } finally {
      getGlobal.mockRestore()
    }
  })
})
