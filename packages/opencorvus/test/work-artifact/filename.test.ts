import { expect, test } from "bun:test"
import { AuthorWorkArtifactInput } from "../../src/work-artifact/presentation"
import { AuthorOfficeDocumentInput, AuthorOfficeSpreadsheetInput } from "../../src/work-artifact/office-document"

const formats = [
  {
    extension: "pptx",
    schema: AuthorWorkArtifactInput,
    plan: { profile: "office.presentation@1", slides: [{ title: "原始内容", elements: [] }] },
  },
  {
    extension: "docx",
    schema: AuthorOfficeDocumentInput,
    plan: { profile: "office.document@1", paragraphs: [{ kind: "paragraph", text: "原始内容" }] },
  },
  {
    extension: "xlsx",
    schema: AuthorOfficeSpreadsheetInput,
    plan: { profile: "office.spreadsheet@1", sheets: [{ name: "明细", columns: ["原始值"], rows: [["001"]] }] },
  },
] as const

for (const { extension, schema, plan } of formats) {
  for (const basename of ["销售经理简报", "Résumé - 核对", "sales-review"]) {
    test(`${extension} author preserves the portable filename ${basename}`, () => {
      const filename = `${basename}.${extension === "pptx" && basename === "sales-review" ? "PPTX" : extension}`
      expect(schema.parse({ ...plan, filename }).filename).toBe(filename)
    })
  }
  for (const basename of ["CON", "COM¹", "LPT²", "报告:原文", "../报告"]) {
    test(`${extension} author maps ${basename} to its explicit filename error`, () => {
      const result = schema.safeParse({ ...plan, filename: `${basename}.${extension}` })
      expect(result.error?.issues.map(({ code, path, message }) => ({ code, path, message }))).toEqual([
        { code: "custom", path: ["filename"], message: `filename must be a safe ${extension} basename` },
      ])
    })
  }
}
