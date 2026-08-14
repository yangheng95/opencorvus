import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  generateWorkArtifactQualificationMatrix,
  generateWorkArtifactQualificationMatrixResult,
  WORK_ARTIFACT_QUALIFICATION_MATRIX_PATH,
} from "../script/generate-work-artifact-qualification-matrix"

describe("Work Artifact qualification matrix generation", () => {
  test("repeated generation produces the canonical matrix", async () => {
    const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-work-artifact-matrix-"))
    const filename = path.join(packageRoot, WORK_ARTIFACT_QUALIFICATION_MATRIX_PATH)
    await fs.mkdir(path.dirname(filename), { recursive: true })

    try {
      expect(await generateWorkArtifactQualificationMatrixResult(packageRoot)).toEqual({ filename, status: "written" })
      expect(await generateWorkArtifactQualificationMatrixResult(packageRoot)).toEqual({ filename, status: "current" })
      expect(await generateWorkArtifactQualificationMatrix(packageRoot)).toBe(filename)

      const output = await fs.readFile(filename, "utf8")
      expect(output).toContain("export const GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX")
      expect(output).toContain('"profile": "office.presentation@1"')
      expect(output).toContain('"qualification": "office-presentation-packaged-lifecycle@1"')
    } finally {
      await fs.rm(packageRoot, { recursive: true, force: true })
    }
  })
})
