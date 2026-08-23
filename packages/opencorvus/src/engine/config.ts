/**
 * EngineConfig — shared assistant runtime configuration.
 *
 * Runtime-wide activity and parallelism defaults are defined here and load
 * operator overrides from the `assistant` config object.
 *
 * 优先级：opencorvus.jsonc > 此处硬编码默认值
 *
 * 使用方式：
 *   import { EngineConfig } from "@/engine/config"
 *   const cfg = await EngineConfig.get()
 *   cfg.activity.session_llm_idle_ms
 *   cfg.activity.session_tool_idle_ms
 */
import { Config } from "@/config/config"

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

/**
 * ActivityConfig — chunk-driven inactivity thresholds.
 *
 * These drive `withStreamActivity` (util/stream-activity.ts) at every
 * streaming boundary. They are TCP-level "no-byte-moved" deadlines,
 * NOT agent-level turn budgets. Rule of thumb when tuning:
 *
 * `execution_progress_idle_ms` is the max no-activity window for one
 * Provider-backed execution — measured from the last observed chunk-driven
 * heartbeat, NOT from process start or an unconditional setInterval.
 */
interface ActivityConfig {
  session_llm_idle_ms: number
  session_tool_idle_ms: number
  execution_progress_idle_ms: number
}

export interface EngineConfigType {
  activity: ActivityConfig
  max_executor_groups: number
}

// ═══════════════════════════════════════════════════════════════════
// 默认值定义 — 所有硬编码常量的唯一来源
// ═══════════════════════════════════════════════════════════════════

const DEFAULTS: EngineConfigType = {
  activity: {
    // Reasoning models can stream reasoning deltas every few seconds;
    // 3 min of zero chunks is already anomalous (observed cases: TCP
    // hang to alibaba-coding-plan-cn, NAT-silenced connection).
    session_llm_idle_ms: 180_000,
    // Tool execution pauses Provider chunk-idle accounting. The pause remains
    // bounded by durable running Tool Part metadata rather than wall time.
    session_tool_idle_ms: 20 * 60_000,
    // Durable execution recovery compares against chunk-driven progress;
    // this is a real deadline, not a self-fed timer.
    execution_progress_idle_ms: 600_000,
  },
  max_executor_groups: 5,
}

// ═══════════════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════════════

export namespace EngineConfig {
  /** 所有默认值，用于展示 / 对比 / 文档 */
  export const defaults: Readonly<EngineConfigType> = DEFAULTS

  /**
   * 加载完整配置：默认值 ← opencorvus.jsonc
   *
   * Contract: this namespace holds NO module-level cache of its own. Each
   * call routes through `Config.get()`, which reacts to `Config.state.reset()`
   * inside `Config.update()` (see `PATCH /config` in server/routes/config.ts).
   * Consequence: UI-driven edits to opencorvus.jsonc take effect on the very
   * next call — no restart, no explicit reset here. If a future change adds
   * a memoized field to `EngineConfig`, add a matching reset and wire it
   * into `PATCH /config`, otherwise the UI-live guarantee breaks silently.
   */
  export async function get(): Promise<EngineConfigType> {
    const cfg = await Config.get()
    return merge(cfg.assistant)
  }

  /** Load the project-independent assistant runtime configuration. */
  export async function getGlobal(): Promise<EngineConfigType> {
    const cfg = await Config.getGlobal()
    return merge(cfg.assistant)
  }

  export function fromAssistantConfig(user?: Config.Info["assistant"]): EngineConfigType {
    return merge(user)
  }

  /** 同步获取硬编码默认值（不读取配置文件），用于模块初始化阶段无法 await 的场景 */
  export function getDefaults(): EngineConfigType {
    return { ...DEFAULTS }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 内部合并逻辑
// ═══════════════════════════════════════════════════════════════════

function merge(user?: Config.Info["assistant"]): EngineConfigType {
  return {
    activity: {
      session_llm_idle_ms: user?.activity?.session_llm_idle_ms ?? DEFAULTS.activity.session_llm_idle_ms,
      session_tool_idle_ms: user?.activity?.session_tool_idle_ms ?? DEFAULTS.activity.session_tool_idle_ms,
      execution_progress_idle_ms:
        user?.activity?.execution_progress_idle_ms ?? DEFAULTS.activity.execution_progress_idle_ms,
    },
    max_executor_groups: user?.max_executor_groups ?? DEFAULTS.max_executor_groups,
  }
}
