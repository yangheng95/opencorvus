import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  monitorEvolutionBenchmarkInactivity,
  type EvolutionBenchmarkCheckpoint,
  type EvolutionBenchmarkInactivityClock,
} from "../script/benchmark/expert-squad-evolution"

test("benchmark inactivity observation waits through an early timer wake", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-evolution-inactivity-"))
  try {
    const checkpointPath = path.join(root, "checkpoint.json")
    const cursor = {
      mission_id: "mission-inactivity",
      session_id: "session-inactivity",
      source: "engine_artifact" as const,
      id: "artifact-inactivity",
      time_updated: 100,
      activity_sha256: "a".repeat(64),
      tasks: [],
    }
    const initial: EvolutionBenchmarkCheckpoint = {
      schema_version: 1,
      config_sha256: "b".repeat(64),
      run_id: "inactivity-contract",
      mission_id: cursor.mission_id,
      session_id: cursor.session_id,
      cursor,
      inactivity_deadline_ms: 110,
    }
    let now = 100
    const sleeps: number[] = []
    const clock: EvolutionBenchmarkInactivityClock = {
      now: () => now,
      async sleep(durationMs) {
        sleeps.push(durationMs)
        now += sleeps.length === 1 ? durationMs - 1 : durationMs
      },
    }
    const client = {
      mission: {
        async activityCursor() {
          return { data: cursor }
        },
      },
    }
    const settled = await monitorEvolutionBenchmarkInactivity({
      client: client as never,
      launch: { run_id: initial.run_id, mission_id: initial.mission_id, inactivity_window_ms: 10 } as never,
      checkpointPath,
      configSHA256: initial.config_sha256,
      initial,
      exited: new Promise<number>(() => {}),
      clock,
    })
    expect({ outcome: settled.outcome, sleeps }).toEqual({
      outcome: {
        status: "inactive",
        reason: "inactivity_timeout",
        observed_at_ms: 110,
        inactivity_deadline_ms: 110,
        inactivity_delta_ms: 0,
      },
      sleeps: [10, 1],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
