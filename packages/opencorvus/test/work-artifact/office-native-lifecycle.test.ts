import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { Process } from "../../src/util/process"
import { runPackagedWorkArtifactAcceptance } from "../../src/work-artifact/packaged-acceptance"
import { authorOfficeArtifact, validateOfficeArtifact } from "../../src/work-artifact/office-document"
import {
  prepareWorkArtifactRuntimeEnvironment,
  type WorkArtifactPresentationDependencies,
} from "../../src/work-artifact/presentation"
import {
  WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST,
  WorkArtifactTargetPackageManifestSchema,
  verifyWorkArtifactTargetPackageManifest,
} from "../../src/work-artifact/runtime/package-manifest"
import {
  parseWorkArtifactRuntimeLock,
  WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH,
} from "../../src/work-artifact/runtime/runtime-lock"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = process.env.OPENCORVUS_WORK_ARTIFACT_PACKAGE_ROOT
const selectedProfile = process.env.OPENCORVUS_WORK_ARTIFACT_PROFILE
afterAll(resetMemoryDatabase)

for (const profile of ["office.document@1", "office.spreadsheet@1"] as const) {
  const nativeTest = packageRoot && (!selectedProfile || selectedProfile === profile) ? test : test.skip
  nativeTest(
    `${profile} native author, inspect, validate and receipt-authorized delivery`,
    async () => {
      const root = path.resolve(packageRoot!)
      const manifest = WorkArtifactTargetPackageManifestSchema.parse(
        JSON.parse(await fs.readFile(path.join(root, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST), "utf8")),
      )
      const lock = parseWorkArtifactRuntimeLock(
        JSON.parse(await fs.readFile(path.join(root, WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH), "utf8")),
      )
      await verifyWorkArtifactTargetPackageManifest({ root, target: manifest.target, lock })
      const entry = manifest.files.find((file) => file.kind === "executable")!
      const executable = path.join(root, entry.path)
      const dependencies: WorkArtifactPresentationDependencies = {
        async officeCliPath() {
          return executable
        },
        async runtimeIdentity() {
          return {
            id: "officecli",
            label: `OfficeCLI v${lock.runtimes[0].version}`,
            version: lock.runtimes[0].version,
            lockRevision: manifest.runtime_lock_revision,
            packageSha: entry.sha256,
          }
        },
        async runOfficeCli(input) {
          const result = await Process.runHost([executable, ...input.args], {
            cwd: input.cwd,
            abort: input.abort,
            env: await prepareWorkArtifactRuntimeEnvironment(input.cwd),
            timeoutMs: input.timeoutMs,
            maxOutputBytes: input.maxOutputBytes,
            inactivityTimeoutMs: 45_000,
          })
          return result
        },
      }
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const result = await runPackagedWorkArtifactAcceptance({ profile, dependencies })
          expect({ source: result.source_sha, delivered: result.delivered_sha, display: result.display }).toEqual({
            source: result.source_sha,
            delivered: result.source_sha,
            display: "interactive-artifact",
          })
          const data = (result.content as { data: unknown }).data
          if (profile === "office.spreadsheet@1") {
            const column = JSON.parse(
              (
                await Process.runHost(
                  [
                    executable,
                    "get",
                    AttachmentStore.resolveAbsolute(Instance.project.id, `${result.source_sha}.xlsx`)!,
                    "/工时汇总/col[A]",
                    "--depth",
                    "0",
                    "--json",
                  ],
                  {
                    cwd: project.path,
                    env: await prepareWorkArtifactRuntimeEnvironment(project.path),
                    timeoutMs: 30_000,
                    maxOutputBytes: 100_000,
                    inactivityTimeoutMs: 30_000,
                  },
                )
              ).stdout.toString(),
            )
            expect(column.data.results[0].format.customWidth).toBe(true)
            expect(column.data.results[0].format.width).toBeGreaterThan(10)
            const sheets = (
              data as { sheets: Array<{ name: string; rows: Array<{ row: number; cells: Record<string, string> }> }> }
            ).sheets
            expect(sheets.map((sheet) => sheet.name)).toEqual(["工时汇总", "类型"])
            expect(sheets[0]!.rows.find((row) => row.row === 6)?.cells).toEqual({
              A6: "合计",
              B6: "36",
              C6: "25",
              D6: "-11",
            })
            expect(sheets[1]!.rows.find((row) => row.row === 2)?.cells).toEqual({ A2: "001", B2: "=1+1", C2: "TRUE" })
          } else {
            const document = data as { elements: Array<{ text: string }> }
            expect(document.elements.map((element) => element.text)).toEqual([
              "工时周报",
              "本周进展",
              "四模块进展：设计完成、实现完成、验证进行中、交付待确认。",
              "计划36小时，实际25小时，差值−11小时。",
              "来源 sales.csv，净金额35.60；退款金额-2.05。",
            ])
            const sourcePath = AttachmentStore.resolveAbsolute(Instance.project.id, `${result.source_sha}.docx`)!
            const zip = new ZipReader(new Uint8ArrayReader(Uint8Array.from(await fs.readFile(sourcePath))))
            try {
              const entries = await zip.getEntries()
              const entry = entries.find((entry) => entry.filename === "word/document.xml")!
              const xml = await entry.getData!(new TextWriter())
              const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0])
              for (const paragraph of paragraphs.slice(0, 2)) {
                expect(paragraph).toMatch(/<w:keepNext(?:\s+w:val="(?:true|1|on)")?\s*\/>/)
                expect(paragraph).toMatch(/<w:keepLines(?:\s+w:val="(?:true|1|on)")?\s*\/>/)
              }
            } finally {
              await zip.close()
            }

            // Native document acceptance, not a product UI/browser test: the
            // output is an editable DOCX, rendered PNGs and a searchable PDF.
            const paragraphs = [
              { kind: "title", text: "Pagination acceptance" },
              {
                kind: "paragraph",
                text: Array.from(
                  { length: 55 },
                  (_, index) =>
                    `Opening ${index + 1}: This paragraph keeps every original sentence in its supplied order.`,
                ).join(" "),
              },
              { kind: "heading", text: "Review details" },
              { kind: "heading", text: "Continuous heading" },
              {
                kind: "paragraph",
                text: Array.from(
                  { length: 80 },
                  (_, index) =>
                    `Entry ${index + 1}: Long paragraphs flow across pages with all source characters preserved.`,
                ).join(" "),
              },
              { kind: "heading", text: "Closing review" },
              { kind: "paragraph", text: "The final body ends here, with the source total 35.60 and refund -2.05." },
            ] as const
            const session = await Session.create({ kind: "orchestrator", title: "Native pagination acceptance" })
            const operation = {
              executionAuthority: {
                kind: "conversation" as const,
                sessionID: session.id,
                projectID: Instance.project.id,
                directory: project.path,
              },
              abort: new AbortController().signal,
              extra: { projectID: Instance.project.id },
              dependencies,
            }
            const authored = await authorOfficeArtifact({
              ...operation,
              raw: { profile, filename: "pagination.docx", locale: "zh-CN", paragraphs },
            })
            const validation = await validateOfficeArtifact({
              ...operation,
              raw: { profile, source_url: authored.reference.url },
            })
            const pdfjs = await import(
              pathToFileURL(
                path.resolve(import.meta.dir, "../../../overlay/node_modules/pdfjs-dist/legacy/build/pdf.mjs"),
              ).href
            )
            const pdf = await pdfjs.getDocument({
              data: new Uint8Array(
                await fs.readFile(
                  AttachmentStore.resolveAbsolute(Instance.project.id, `${validation.preview.sha}.pdf`)!,
                ),
              ),
            }).promise
            try {
              const pages: string[] = []
              for (let page = 1; page <= pdf.numPages; page++) {
                const nativePage = await pdf.getPage(page)
                expect(Math.abs(nativePage.view[2] - nativePage.view[0] - 595.3)).toBeLessThan(0.5)
                expect(Math.abs(nativePage.view[3] - nativePage.view[1] - 841.9)).toBeLessThan(0.5)
                const content = await nativePage.getTextContent()
                pages.push(content.items.map((item: { str?: string }) => item.str ?? "").join(""))
              }
              const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, "")
              expect(normalize(pages.join(""))).toBe(normalize(paragraphs.map((paragraph) => paragraph.text).join("")))
              expect(pdf.numPages).toBeGreaterThan(2)
              expect(validation.renders.length).toBe(pdf.numPages)
              expect(validation.receipt.payload.renderer.version.split("; ")[1]).toBe("pagedjs@0.4.3")
              expect(validation.receipt.payload.renderer.version.split("; ")[2]).toBe("layout@1")
              const details = pages.find((page) => page.includes("Review details"))!
              expect(details).toContain("Continuous heading")
              expect(details).toContain("Entry 1:")
              const closing = pages.find((page) => page.includes("Closing review"))!
              expect(closing).toContain("The final body ends here")
            } finally {
              await pdf.destroy()
            }
          }
        },
      })
    },
    180_000,
  )
}
