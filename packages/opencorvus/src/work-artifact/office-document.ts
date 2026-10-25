import { AttachmentStore } from "@/storage/attachment-store"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { WorkArtifactProfileRegistry } from "./profile-registry"
import {
  defaultWorkArtifactPresentationDependencies,
  inspectOfficePackage,
  parseWorkArtifactRuntimeJson,
  assertCompleteWorkArtifactBatch,
  assertZeroWorkArtifactRuntimeIssueCount,
  projectID,
  readBoundedFile,
  requireOperationBudget,
  RuntimeReceiptIdentity,
  withOfficeWorkspace,
  WORK_ARTIFACT_VALIDATION_RECEIPT_MIME,
  type WorkArtifactPresentationDependencies,
} from "./presentation"
import { renderOfficeHtml } from "./office-html-render"

const Profile = z.enum(["office.document@1", "office.spreadsheet@1"])
const CanonicalUrl = z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/)
const Digest = z.string().regex(/^[a-f0-9]{64}$/)
const Text = z
  .string()
  .max(8_000)
  .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), "text must use valid XML characters")
const Locale = z
  .string()
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  .default("en-US")
function filename(extension: "docx" | "xlsx") {
  return z
    .string()
    .trim()
    .min(6)
    .max(120)
    .refine(
      (value) =>
        !/[<>:"/\\|?*\u0000-\u001f]/.test(value) &&
        !/^[. ]|[. ]$/.test(value) &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(value) &&
        value.toLowerCase().endsWith(`.${extension}`),
      `filename must be a safe ${extension} basename`,
    )
}
export const AuthorOfficeDocumentInput = z
  .object({
    profile: z.literal("office.document@1"),
    filename: filename("docx"),
    locale: Locale,
    paragraphs: z
      .array(
        z
          .object({
            kind: z.enum(["title", "heading", "paragraph"]),
            text: Text.min(1),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict()
const Cell = z.union([Text, z.number().finite(), z.boolean(), z.null()])
export const AuthorOfficeSpreadsheetInput = z
  .object({
    profile: z.literal("office.spreadsheet@1"),
    filename: filename("xlsx"),
    locale: Locale,
    sheets: z
      .array(
        z
          .object({
            name: z
              .string()
              .trim()
              .min(1)
              .max(31)
              .refine(
                (value) => !/[\[\]:*?/\\\u0000-\u001f]/.test(value) && !/^'|'$/.test(value),
                "sheet name must be an Excel tab name",
              ),
            columns: z.array(Text.min(1).max(120)).min(1).max(12),
            rows: z.array(z.array(Cell).min(1).max(12)).min(1).max(40),
          })
          .strict()
          .superRefine((sheet, ctx) => {
            sheet.rows.forEach((row, index) => {
              if (row.length !== sheet.columns.length)
                ctx.addIssue({ code: "custom", path: ["rows", index], message: "each row must match the column count" })
            })
          }),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (new Set(plan.sheets.map((sheet) => sheet.name.toLowerCase())).size !== plan.sheets.length)
      ctx.addIssue({ code: "custom", path: ["sheets"], message: "sheet names must be unique" })
  })
export const AuthorOfficeInput = z.discriminatedUnion("profile", [
  AuthorOfficeDocumentInput,
  AuthorOfficeSpreadsheetInput,
])
export const InspectOfficeInput = z.object({ profile: Profile, source_url: CanonicalUrl }).strict()
export const DeliverOfficeInput = z
  .object({
    profile: Profile,
    title: z.string().trim().min(1).max(160),
    source_url: CanonicalUrl,
    validation_receipt_url: CanonicalUrl,
    validation_receipt_sha: Digest,
  })
  .strict()
const ReviewRender = z.object({ page: z.number().int().positive(), url: CanonicalUrl, sha: Digest }).strict()
export const OfficeValidationReceiptPayload = z
  .object({
    schema_version: z.literal(1),
    profile: Profile,
    source_url: CanonicalUrl,
    source_sha: Digest,
    runtime: RuntimeReceiptIdentity,
    renderer: z
      .object({
        id: z.literal("officecli-html-browser@1"),
        version: z.string().min(1),
        playwright_version: z.string().min(1),
        node_version: z.string().min(1),
      })
      .strict(),
    resource_usage: z
      .object({
        input_bytes: z.number().int().nonnegative(),
        runtime_output_bytes: z.number().int().nonnegative(),
        render_bytes: z.number().int().nonnegative(),
        wall_clock_ms: z.number().int().positive(),
      })
      .strict(),
    renders: z.array(ReviewRender).min(1).max(40),
    preview: z.object({ url: CanonicalUrl, sha: Digest }).strict(),
  })
  .strict()
type Operation = {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: WorkArtifactPresentationDependencies
  deadline?: number
}
function format(profile: z.output<typeof Profile>) {
  return profile === "office.document@1" ? ("docx" as const) : ("xlsx" as const)
}
function mime(profile: z.output<typeof Profile>) {
  return WorkArtifactProfileRegistry.require(profile).mimeTypes[0]!
}

function runner(input: Operation, directory: string, deadline: number, outputLimit: number, wallClockMs: number) {
  let bytes = 0
  return {
    get bytes() {
      return bytes
    },
    async run(args: string[]) {
      const maxOutputBytes = outputLimit - bytes
      if (maxOutputBytes < 1) throw new Error(`Work Artifact operation output exceeded ${outputLimit} bytes`)
      const result = await (input.dependencies ?? defaultWorkArtifactPresentationDependencies).runOfficeCli({
        executionAuthority: input.executionAuthority,
        args,
        cwd: directory,
        abort: input.abort,
        timeoutMs: requireOperationBudget(deadline, wallClockMs, input.abort),
        maxOutputBytes,
      })
      bytes += result.stdout.byteLength + result.stderr.byteLength
      if (bytes > outputLimit) throw new Error(`Work Artifact operation output exceeded ${outputLimit} bytes`)
      requireOperationBudget(deadline, wallClockMs, input.abort)
      return result
    },
    async json(args: string[]) {
      return parseWorkArtifactRuntimeJson((await this.run(args)).stdout, "OfficeCLI")
    },
  }
}

export async function authorOfficeArtifact(input: Operation) {
  const plan = AuthorOfficeInput.parse(input.raw),
    profile = WorkArtifactProfileRegistry.require(plan.profile)
  const deadline = performance.now() + profile.limits.wallClockMs,
    currentProjectID = projectID(input.extra)
  return withOfficeWorkspace(
    { executionAuthority: input.executionAuthority, projectID: currentProjectID },
    async (directory) => {
      const native = runner(input, directory, deadline, profile.limits.outputBytes, profile.limits.wallClockMs)
      const output = path.join(directory, `candidate.${format(plan.profile)}`)
      await native.json(["create", output, "--type", format(plan.profile), "--locale", plan.locale, "--json"])
      const commands: Array<Record<string, unknown>> = []
      if (plan.profile === "office.document@1") {
        for (const style of new Set(
          plan.paragraphs
            .filter((paragraph) => paragraph.kind !== "paragraph")
            .map((paragraph) => (paragraph.kind === "title" ? "Title" : "Heading1")),
        )) {
          commands.push({
            command: "add",
            parent: "/styles",
            type: "style",
            props: { id: style, type: "paragraph", basedOn: "Normal" },
          })
        }
        for (const paragraph of plan.paragraphs) {
          const props: Record<string, string> = {
            text: paragraph.text,
            style: paragraph.kind === "title" ? "Title" : paragraph.kind === "heading" ? "Heading1" : "Normal",
            size: paragraph.kind === "title" ? "24pt" : paragraph.kind === "heading" ? "16pt" : "11pt",
            spaceAfter: paragraph.kind === "paragraph" ? "8pt" : "12pt",
            firstLineIndent: paragraph.kind === "paragraph" ? "22pt" : "0pt",
            bold: String(paragraph.kind !== "paragraph"),
          }
          commands.push({ command: "add", parent: "/body", type: "p", props })
        }
      } else {
        plan.sheets.forEach((sheet, index) => {
          commands.push(
            index === 0
              ? { command: "set", path: "/Sheet1", props: { name: sheet.name } }
              : { command: "add", parent: "/", type: "sheet", props: { name: sheet.name } },
          )
          const rows: Array<Array<z.output<typeof Cell>>> = [sheet.columns, ...sheet.rows]
          rows.forEach((row, rowIndex) =>
            row.forEach((value, columnIndex) => {
              if (value === null) return
              commands.push({
                command: "set",
                path: `/${sheet.name}/${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`,
                props: {
                  value: String(value),
                  type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
                  "font.size": "11pt",
                  ...(rowIndex === 0 ? { bold: "true", fill: "E8EEF8" } : {}),
                },
              })
            }),
          )
          commands.push({ command: "set", path: `/${sheet.name}`, props: { autofit: "true" } })
        })
      }
      const batch = path.join(directory, "authoring.json")
      await fs.writeFile(batch, JSON.stringify(commands), { flag: "wx", mode: 0o600 })
      // This new file is private to the operation. Publish the complete result
      // only after every command, package inspection and content readback pass.
      assertCompleteWorkArtifactBatch(
        await native.json(["batch", output, "--input", batch, "--stop-on-error", "--json"]),
        commands.length,
      )
      const bytes = await readBoundedFile(output, profile.limits.inputBytes, "authored Office file")
      await inspectOfficePackage(bytes, format(plan.profile), {
        abort: input.abort,
        timeoutMs: requireOperationBudget(deadline, profile.limits.wallClockMs, input.abort),
      })
      const readback = await native.json(["view", output, "text", "--json"])
      if (plan.profile === "office.document@1") {
        const content = z.object({ elements: z.array(z.object({ text: z.string() })) }).parse(readback.data)
        if (
          JSON.stringify(content.elements.map((element) => element.text)) !==
          JSON.stringify(plan.paragraphs.map((paragraph) => paragraph.text))
        )
          throw new Error("Office document readback does not match the complete paragraph plan")
      } else {
        const content = z
          .object({
            sheets: z.array(
              z.object({
                name: z.string(),
                rows: z.array(z.object({ row: z.number().int(), cells: z.record(z.string(), z.string()) })),
              }),
            ),
          })
          .parse(readback.data)
        if (content.sheets.length !== plan.sheets.length)
          throw new Error("Office spreadsheet readback does not match the worksheet count")
        plan.sheets.forEach((sheet, index) => {
          const actual = content.sheets[index]!
          if (actual.name !== sheet.name)
            throw new Error("Office spreadsheet readback does not match the worksheet order and names")
          ;[sheet.columns, ...sheet.rows].forEach((row, rowIndex) =>
            row.forEach((value, columnIndex) => {
              const expected =
                value === null ? "" : typeof value === "boolean" ? String(value).toUpperCase() : String(value)
              const address = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`
              if ((actual.rows.find((row) => row.row === rowIndex + 1)?.cells[address] ?? "") !== expected)
                throw new Error(
                  `Office spreadsheet readback differs from the typed plan at sheet ${index + 1} cell ${address}`,
                )
            }),
          )
        })
      }
      const reference = await AttachmentStore.write(currentProjectID, bytes, mime(plan.profile), plan.filename)
      requireOperationBudget(deadline, profile.limits.wallClockMs, input.abort)
      return { reference }
    },
  )
}

export async function inspectOfficeArtifact(input: Operation) {
  const parsed = InspectOfficeInput.parse(input.raw),
    limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const deadline = performance.now() + limits.wallClockMs
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: projectID(input.extra),
    url: parsed.source_url,
    mime: mime(parsed.profile),
    maxBytes: limits.inputBytes,
  })
  const inspected = await inspectOfficePackage(snapshot.bytes, format(parsed.profile), {
    abort: input.abort,
    timeoutMs: limits.parserWallClockMs,
  })
  const content = await withOfficeWorkspace(
    { executionAuthority: input.executionAuthority, projectID: projectID(input.extra) },
    async (directory) => {
      const sourcePath = path.join(directory, `candidate.${format(parsed.profile)}`)
      await fs.writeFile(sourcePath, snapshot.bytes, { flag: "wx", mode: 0o600 })
      return runner(input, directory, deadline, limits.outputBytes, limits.wallClockMs).json([
        "view",
        sourcePath,
        "text",
        "--json",
      ])
    },
  )
  return {
    source: snapshot.reference,
    content,
    inspection: {
      entryCount: inspected.entryCount,
      uncompressedBytes: inspected.uncompressedBytes,
      ...(parsed.profile === "office.spreadsheet@1" ? { sheetCount: inspected.unitCount } : {}),
    },
  }
}

export async function validateOfficeArtifact(input: Operation) {
  const started = performance.now(),
    parsed = InspectOfficeInput.parse(input.raw),
    limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const deadline = input.deadline ?? started + limits.wallClockMs,
    currentProjectID = projectID(input.extra)
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: mime(parsed.profile),
    maxBytes: limits.inputBytes,
  })
  const inspection = await inspectOfficePackage(snapshot.bytes, format(parsed.profile), {
    abort: input.abort,
    timeoutMs: requireOperationBudget(deadline, limits.wallClockMs, input.abort),
  })
  return withOfficeWorkspace(
    { executionAuthority: input.executionAuthority, projectID: currentProjectID },
    async (directory) => {
      const native = runner(input, directory, deadline, limits.outputBytes, limits.wallClockMs),
        sourcePath = path.join(directory, `candidate.${format(parsed.profile)}`)
      await fs.writeFile(sourcePath, snapshot.bytes, { flag: "wx", mode: 0o600 })
      const validation = await native.json(["validate", sourcePath, "--json"])
      assertZeroWorkArtifactRuntimeIssueCount(validation, "OfficeCLI validation")
      const issues = await native.json(["view", sourcePath, "issues", "--json"])
      assertZeroWorkArtifactRuntimeIssueCount(issues, "OfficeCLI issue inspection")
      const html = await native.run(["view", sourcePath, "html"])
      const rendered = await renderOfficeHtml({
        html: html.stdout.toString("utf8"),
        format: format(parsed.profile),
        directory,
        executionAuthority: input.executionAuthority,
        abort: input.abort,
        timeoutMs: requireOperationBudget(deadline, limits.wallClockMs, input.abort),
        maxBytes: limits.outputBytes - native.bytes,
        maxUnits: limits.pagesOrFrames,
      })
      if (parsed.profile === "office.spreadsheet@1" && rendered.renders.length !== inspection.unitCount)
        throw new Error("Office render does not cover every worksheet")
      let renderBytes = 0
      const renders: Array<AttachmentStore.Reference & { page: number }> = []
      for (const [index, render] of rendered.renders.entries()) {
        const bytes = await readBoundedFile(
          path.join(directory, render.name),
          limits.outputBytes - native.bytes - renderBytes,
          "Office rendered page",
        )
        if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          throw new Error("Office rendered page is not PNG")
        renderBytes += bytes.byteLength
        const reference = await AttachmentStore.write(
          currentProjectID,
          bytes,
          "image/png",
          `${format(parsed.profile)}-page-${index + 1}.png`,
        )
        renders.push({ page: index + 1, ...reference })
      }
      const pdf = await readBoundedFile(
        path.join(directory, "office-preview.pdf"),
        limits.outputBytes - native.bytes - renderBytes,
        "Office preview PDF",
      )
      if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Office derived preview is not PDF")
      renderBytes += pdf.byteLength
      const preview = await AttachmentStore.write(
        currentProjectID,
        pdf,
        "application/pdf",
        `${path.parse(snapshot.reference.filename ?? "office").name}-preview.pdf`,
      )
      const runtime = await (input.dependencies ?? defaultWorkArtifactPresentationDependencies).runtimeIdentity()
      const resourceUsage = {
        input_bytes: snapshot.bytes.byteLength,
        runtime_output_bytes: native.bytes,
        render_bytes: renderBytes,
        wall_clock_ms: Math.max(1, Math.ceil(performance.now() - started)),
      }
      const payload = OfficeValidationReceiptPayload.parse({
        schema_version: 1,
        profile: parsed.profile,
        source_url: snapshot.reference.url,
        source_sha: snapshot.reference.sha,
        runtime: {
          id: runtime.id,
          version: runtime.version,
          lock_revision: runtime.lockRevision,
          package_sha: runtime.packageSha,
        },
        renderer: {
          id: "officecli-html-browser@1",
          version: rendered.version,
          playwright_version: rendered.playwright_version,
          node_version: rendered.node_version,
        },
        resource_usage: resourceUsage,
        renders: renders.map(({ page, sha, url }) => ({ page, sha, url })),
        preview: { url: preview.url, sha: preview.sha },
      })
      const reference = await AttachmentStore.write(
        currentProjectID,
        Buffer.from(JSON.stringify(payload)),
        WORK_ARTIFACT_VALIDATION_RECEIPT_MIME,
        "work-artifact-validation-receipt.json",
      )
      requireOperationBudget(deadline, limits.wallClockMs, input.abort)
      return {
        source: snapshot.reference,
        inspection,
        validation,
        issues,
        renders,
        preview,
        resourceUsage,
        receipt: { reference, payload },
      }
    },
  )
}

export async function prepareOfficeDeliverable(input: Operation) {
  const parsed = DeliverOfficeInput.parse(input.raw),
    limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const deadline = input.deadline ?? performance.now() + limits.wallClockMs,
    currentProjectID = projectID(input.extra)
  const receipt = await AttachmentStore.readVerifiedReference({
    projectID: currentProjectID,
    url: parsed.validation_receipt_url,
    mime: WORK_ARTIFACT_VALIDATION_RECEIPT_MIME,
    maxBytes: 1024 * 1024,
  })
  if (receipt.reference.sha !== parsed.validation_receipt_sha)
    throw new Error("validation receipt attachment digest mismatch")
  const payload = OfficeValidationReceiptPayload.parse(JSON.parse(receipt.bytes.toString("utf8")))
  if (payload.profile !== parsed.profile || payload.source_url !== parsed.source_url)
    throw new Error("Office receipt does not bind the requested source and profile")
  const validated = await validateOfficeArtifact({
    ...input,
    raw: { profile: parsed.profile, source_url: parsed.source_url },
    deadline,
  })
  if (
    payload.source_sha !== validated.source.sha ||
    JSON.stringify(payload.runtime) !== JSON.stringify(validated.receipt.payload.runtime) ||
    JSON.stringify(payload.renderer) !== JSON.stringify(validated.receipt.payload.renderer) ||
    payload.renders.length !== validated.renders.length
  )
    throw new Error("Office receipt does not bind the final source, runtime and complete render")
  for (const [index, reference] of [...payload.renders, payload.preview].entries()) {
    const original = await AttachmentStore.readVerifiedReference({
      projectID: currentProjectID,
      url: reference.url,
      mime: index < payload.renders.length ? "image/png" : "application/pdf",
      maxBytes: limits.outputBytes,
    })
    if (original.reference.sha !== reference.sha) throw new Error("Office receipt review attachment digest mismatch")
  }
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  return { ...validated, parsed, priorReceiptPayload: payload }
}
