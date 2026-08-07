import { describe, expect, test } from "bun:test"
import { runFileMime } from "../../src/cli/cmd/run-file"

describe("Run file attachment MIME", () => {
  test("preserves an Excel workbook as a binary Office attachment", async () => {
    expect(await runFileMime("Online Retail.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
  })
})
