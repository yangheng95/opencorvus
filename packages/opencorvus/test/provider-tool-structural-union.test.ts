import { expect, test } from "bun:test"
import z from "zod"
import { materializeToolExecutionInput } from "../src/provider/tool-execution-input"

const target = z
  .object({
    filePath: z.string(),
    note: z.string().optional(),
  })
  .strict()
const input = z.union([target.extend({ content: z.string() }), target.extend({ attachmentUrl: z.string() })])

test("materializes both uniquely shaped object branches through the root Provider envelope", () => {
  const providerValues = [
    { operation: { filePath: "/project/report.txt", content: "Report", note: null } },
    {
      operation: {
        filePath: "/project/report.csv",
        attachmentUrl: "/attachment/project/report.csv",
        note: "Original bytes",
      },
    },
  ]
  expect(providerValues.map((value) => input.parse(materializeToolExecutionInput(input, value)))).toEqual([
    { filePath: "/project/report.txt", content: "Report" },
    { filePath: "/project/report.csv", attachmentUrl: "/attachment/project/report.csv", note: "Original bytes" },
  ])
})

test("retains canonical union validation for conflicting active fields", () => {
  const result = input.safeParse(
    materializeToolExecutionInput(input, {
      operation: {
        filePath: "/project/report.txt",
        content: "Report",
        attachmentUrl: "/attachment/project/report.csv",
      },
    }),
  )
  expect(result.error?.issues.map((issue) => issue.code)).toEqual(["invalid_union"])
})
