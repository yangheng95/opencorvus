import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { deleteBuildObservationRefs } from "@/engine/build-observation-ref"

describe("build-observation ref cleanup", () => {
  test("completes cleanup when the owning repository is already absent", async () => {
    const missingRepository = path.join(os.tmpdir(), `opencorvus-missing-repository-${randomUUID()}`)
    await expect(
      deleteBuildObservationRefs({
        worktreeDir: missingRepository,
        observationIDs: ["art_missing_repository_cleanup"],
      }),
    ).resolves.toBeUndefined()
  })
})
