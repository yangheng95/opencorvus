import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { readExpertSquadInstallationMetadata } from "../src/expert-squad/installation-metadata"
import { InteractiveArtifactTimeline } from "../src/interactive-artifact/schema"
import { EvolutionArtifactSchemas } from "../../plugin/src/expert-squad-evolution-artifact"
import { isoDateTimeSchema } from "@opencorvus-ai/util/iso-date-time"

const utcTimes = ["2026-10-25T05:30Z", "2026-10-25T05:30:00Z", "2026-10-25T05:30:00.123Z"]

test("stored generation metadata retains its minute, second, and fractional-second timestamp values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "generation-timestamp-contract-"))
  try {
    for (const generated_at of [...utcTimes, "2026-10-25T13:30+08:00", "2026-10-25T13:30:00+08:00"]) {
      const metadata = {
        schema_version: 1,
        generation: {
          method: "sdk_authoring",
          generator_expert_squad_id: "squad-sdk",
          task_id: "task-timestamp",
          session_id: "session-timestamp",
          generated_at,
        },
      }
      await writeFile(path.join(directory, ".opencorvus-meta.json"), JSON.stringify(metadata))
      expect(await readExpertSquadInstallationMetadata(directory)).toEqual(metadata)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("timeline point timestamps preserve every declared precision and timezone offset", () => {
  for (const start of [...utcTimes, "2026-10-25T13:30+08:00", "2026-10-25T13:30:00+08:00"]) {
    const payload = {
      schemaVersion: "1",
      renderer: "timeline@1",
      title: "Timestamp contract",
      groups: [],
      items: [{ kind: "point", id: "point-1", content: "Observed", start }],
    }
    expect(InteractiveArtifactTimeline.parse(payload)).toEqual(payload)
  }
})

test("evolution evidence timestamps preserve UTC minute, second, and fractional-second precision", () => {
  for (const value of utcTimes) {
    const window = { started_at: value, ended_at: value }
    expect(EvolutionArtifactSchemas["evolution-lab/opportunity"].shape.data_window.parse(window)).toEqual(window)
    expect(EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].shape.last_activity_at.parse(value)).toBe(
      value,
    )
  }
})

test("timestamp schemas return their qualified-time error contract for invalid dates and timezone boundaries", () => {
  for (const [schema, value] of [
    [isoDateTimeSchema(), "2026-10-25T13:30+08:00"],
    [isoDateTimeSchema({ offset: true }), "2026-02-30T05:30Z"],
    [isoDateTimeSchema({ offset: true }), "2026-10-25T05:30"],
  ] as const) {
    const result = schema.safeParse(value)
    expect(result.error?.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid_union", path: [] },
    ])
  }
})
