import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { requireTask } from "@/engine/store"
import { sessionBelongsToTask, type SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { Session } from "@/session"
import { AttachmentStore } from "@/storage/attachment-store"
import { Process } from "@/util/process"
import { requireRuntimePackage } from "@/runtime/package-require"
import { TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { officeCliRuntimeLabel, parseOfficeCliRuntimeLock, type OfficeCliRuntimeLock } from "./runtime/runtime-lock"

// PPTX means PowerPoint Open XML Presentation.
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const MAX_PRESENTATION_BYTES = 80 * 1024 * 1024
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRIES = 2_000
const MAX_UNCOMPRESSED_BYTES = 120 * 1024 * 1024
const OFFICECLI_INACTIVITY_TIMEOUT_MS = 45_000
const SLIDE_WIDTH_CM = 33.867
const SLIDE_HEIGHT_CM = 19.05
const MAX_IMAGE_DIMENSION = 10_000
const MAX_IMAGE_PIXELS = 40_000_000
const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")
declare const OPENCORVUS_LIBC: string | undefined

const Color = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const SafeText = z
  .string()
  .max(8_000)
  .refine((value) => !value.includes("\u0000"), "text must not contain NUL")
const NonEmptySafeText = z
  .string()
  .trim()
  .min(1)
  .max(8_000)
  .refine((value) => !value.includes("\u0000"), "text must not contain NUL")
const Position = z.number().finite().nonnegative()
const Dimension = z.number().finite().positive()
const BaseElement = z.object({
  x: Position,
  y: Position,
  width: Dimension,
  height: Dimension,
})

const TextElement = BaseElement.extend({
  kind: z.literal("text"),
  text: NonEmptySafeText,
  font_size: z.number().finite().min(8).max(72),
  color: Color,
  font: z.string().trim().min(1).max(120).default("Arial"),
  bold: z.boolean().default(false),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  valign: z.enum(["top", "middle", "bottom"]).default("top"),
  fill: z.union([Color, z.literal("none")]).default("none"),
  line: z.union([Color, z.literal("none")]).default("none"),
  geometry: z.enum(["rect", "roundRect", "ellipse", "triangle", "diamond", "rightArrow"]).default("rect"),
}).strict()

const ShapeElement = BaseElement.extend({
  kind: z.literal("shape"),
  geometry: z.enum(["rect", "roundRect", "ellipse", "triangle", "diamond", "rightArrow"]),
  fill: z.union([Color, z.literal("none")]),
  line: z.union([Color, z.literal("none")]).default("none"),
  opacity: z.number().finite().min(0).max(1).default(1),
  text: SafeText.optional(),
  font_size: z.number().finite().min(8).max(72).default(18),
  color: Color.default("#111827"),
  bold: z.boolean().default(false),
  align: z.enum(["left", "center", "right", "justify"]).default("center"),
  valign: z.enum(["top", "middle", "bottom"]).default("middle"),
}).strict()

const PictureElement = BaseElement.extend({
  kind: z.literal("picture"),
  source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
  alt: z.string().trim().min(1).max(500),
  crop: z
    .string()
    .regex(/^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){0,3}$/)
    .optional(),
}).strict()

const ChartLabel = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !/[,:;\r\n]/.test(value), "chart labels must not contain comma, colon, semicolon, or newline")

const ChartElement = BaseElement.extend({
  kind: z.literal("chart"),
  chart_type: z.enum(["bar", "column", "line", "pie", "doughnut", "area"]),
  title: z.string().trim().min(1).max(200),
  categories: z.array(ChartLabel).min(1).max(40),
  series: z
    .array(
      z
        .object({
          name: ChartLabel,
          values: z.array(z.number().finite()).min(1).max(40),
        })
        .strict(),
    )
    .min(1)
    .max(12),
  colors: z.array(Color).min(1).max(12),
  legend: z.enum(["none", "top", "bottom", "left", "right"]).default("bottom"),
  data_labels: z.enum(["none", "value", "percent", "category"]).default("none"),
}).strict()

export const PresentationElement = z
  .discriminatedUnion("kind", [TextElement, ShapeElement, PictureElement, ChartElement])
  .superRefine((element, ctx) => {
    if (element.x + element.width > SLIDE_WIDTH_CM || element.y + element.height > SLIDE_HEIGHT_CM) {
      ctx.addIssue({
        code: "custom",
        message: `element must stay inside the ${SLIDE_WIDTH_CM}cm x ${SLIDE_HEIGHT_CM}cm slide`,
      })
    }
    if (element.kind === "chart") {
      for (const series of element.series) {
        if (series.values.length !== element.categories.length) {
          ctx.addIssue({
            code: "custom",
            path: ["series"],
            message: `chart series ${series.name} must have one value per category`,
          })
        }
      }
      if (element.colors.length < element.series.length) {
        ctx.addIssue({
          code: "custom",
          path: ["colors"],
          message: "chart colors must cover every series",
        })
      }
    }
  })

export const AuthorOfficeArtifactInput = z
  .object({
    format: z.literal("presentation"),
    filename: z
      .string()
      .trim()
      .min(6)
      .max(120)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*\.pptx$/i)
      .refine((value) => path.basename(value) === value, "filename must be a basename"),
    locale: z
      .string()
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
      .default("en-US"),
    aspect_ratio: z.literal("16:9").default("16:9"),
    slides: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            background: Color.default("#FFFFFF"),
            elements: z.array(PresentationElement).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()
export type AuthorOfficeArtifactInput = z.output<typeof AuthorOfficeArtifactInput>

export const InspectOfficeArtifactInput = z
  .object({
    format: z.literal("presentation"),
    source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
  })
  .strict()

export const ValidateOfficeArtifactInput = InspectOfficeArtifactInput

export const RenderReference = z
  .object({
    slide: z.number().int().positive(),
    sha: z.string().regex(/^[a-f0-9]{64}$/),
    url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    mime: z.literal("image/png"),
    size: z.number().int().positive(),
    filename: z.string().trim().min(1),
  })
  .strict()

export const DeliverOfficeArtifactInput = z
  .object({
    format: z.literal("presentation"),
    title: z.string().trim().min(1).max(160),
    source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    source_sha: z.string().regex(/^[a-f0-9]{64}$/),
    slides: z
      .array(
        z
          .object({
            slide: z.number().int().positive(),
            title: z.string().trim().min(1).max(160),
            markdown: z.string().max(100_000).default(""),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()
  .superRefine((value, ctx) => {
    value.slides.forEach((slide, index) => {
      if (slide.slide !== index + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index],
          message: "slides must be contiguous and use a 1-based index",
        })
      }
    })
  })

type OfficeCliCommand = {
  command: "add"
  parent: string
  type: "slide" | "shape" | "picture" | "chart"
  props: Record<string, string>
}

export type OfficeCliRunner = (input: {
  executionAuthority: SessionExecutionAuthority
  args: string[]
  cwd: string
  abort: AbortSignal
}) => Promise<Process.Result>

export type OfficeArtifactDependencies = {
  officeCliPath(): Promise<string>
  runtimeIdentity(): Promise<{ label: string; lock: OfficeCliRuntimeLock }>
  runOfficeCli: OfficeCliRunner
}

export function packagedOfficeCliPath(): string {
  return path.join(path.dirname(process.execPath), "bin", process.platform === "win32" ? "officecli.exe" : "officecli")
}

export function packagedOfficeCliRuntimeLockPath(): string {
  return path.join(path.dirname(process.execPath), "licenses", "OfficeCLI-RUNTIME-LOCK.json")
}

let verifiedPackagedRuntime: Promise<{ executable: string; label: string; lock: OfficeCliRuntimeLock }> | undefined

function runtimeTargetABI(): "musl" | undefined {
  if (process.platform !== "linux") return undefined
  const built = typeof OPENCORVUS_LIBC === "string" ? OPENCORVUS_LIBC : undefined
  return (built || process.env.OPENCORVUS_LIBC || "glibc") === "musl" ? "musl" : undefined
}

async function verifyPackagedOfficeCliRuntime(): Promise<{
  executable: string
  label: string
  lock: OfficeCliRuntimeLock
}> {
  if (verifiedPackagedRuntime) return verifiedPackagedRuntime
  verifiedPackagedRuntime = (async () => {
    const executable = packagedOfficeCliPath()
    const info = await fs.stat(executable).catch(() => undefined)
    if (!info?.isFile()) throw new Error(`Packaged OfficeCLI runtime is unavailable: ${executable}`)
    if (process.platform !== "win32" && (info.mode & 0o111) !== 0o111) {
      throw new Error(`Packaged OfficeCLI runtime is not executable: ${executable}`)
    }
    const lock = parseOfficeCliRuntimeLock(JSON.parse(await fs.readFile(packagedOfficeCliRuntimeLockPath(), "utf8")))
    const asset = lock.assets.find(
      (candidate) =>
        candidate.os === process.platform && candidate.arch === process.arch && candidate.abi === runtimeTargetABI(),
    )
    if (!asset) {
      throw new Error(`Packaged OfficeCLI runtime lock has no asset for ${process.platform}-${process.arch}`)
    }
    const digest = createHash("sha256")
      .update(await fs.readFile(executable))
      .digest("hex")
    if (digest !== asset.sha256) {
      throw new Error(`Packaged OfficeCLI runtime digest mismatch: ${executable}`)
    }
    return { executable, label: officeCliRuntimeLabel(lock), lock }
  })()
  return verifiedPackagedRuntime
}

export const defaultOfficeArtifactDependencies: OfficeArtifactDependencies = {
  async officeCliPath() {
    return (await verifyPackagedOfficeCliRuntime()).executable
  },
  async runtimeIdentity() {
    const runtime = await verifyPackagedOfficeCliRuntime()
    return { label: runtime.label, lock: runtime.lock }
  },
  async runOfficeCli(input) {
    const executable = await defaultOfficeArtifactDependencies.officeCliPath()
    const configuration = path.join(input.cwd, ".officecli-config")
    const cache = path.join(input.cwd, ".officecli-cache")
    const temporary = path.join(input.cwd, ".officecli-temp")
    await Promise.all([
      fs.mkdir(configuration, { recursive: true }),
      fs.mkdir(cache, { recursive: true }),
      fs.mkdir(temporary, { recursive: true }),
    ])
    const command = [executable, ...input.args]
    const options = {
      abort: input.abort,
      env: {
        OFFICECLI_NO_AUTO_RESIDENT: "1",
        OFFICECLI_SKIP_UPDATE: "1",
        OFFICECLI_RESIDENT_FLUSH: "each",
        APPDATA: configuration,
        LOCALAPPDATA: cache,
        XDG_CONFIG_HOME: configuration,
        XDG_CACHE_HOME: cache,
        DOTNET_CLI_HOME: cache,
        TMP: temporary,
        TEMP: temporary,
        TMPDIR: temporary,
        DOTNET_BUNDLE_EXTRACT_BASE_DIR: path.join(cache, "dotnet-bundle"),
      },
      inactivityTimeoutMs: OFFICECLI_INACTIVITY_TIMEOUT_MS,
      inactivityTimeoutMessage: `OfficeCLI was inactive for ${OFFICECLI_INACTIVITY_TIMEOUT_MS}ms`,
    }
    return input.executionAuthority.kind === "task"
      ? Process.runTask({ taskID: input.executionAuthority.taskID, cwd: input.cwd }, command, options)
      : Process.runHost(command, { ...options, cwd: input.cwd })
  },
}

function projectID(ctxExtra?: Record<string, unknown>): string {
  return typeof ctxExtra?.projectID === "string" ? ctxExtra.projectID : Instance.project.id
}

async function withOfficeWorkspace<T>(
  input: { executionAuthority: SessionExecutionAuthority; projectID: string },
  fn: (directory: string) => Promise<T>,
): Promise<T> {
  const authority = input.executionAuthority
  if (authority.projectID !== input.projectID || authority.projectID !== Instance.project.id) {
    throw new Error(`Office Artifact execution project identity does not match ${input.projectID}`)
  }
  let projectRoot = Instance.project.worktree
  if (authority.kind === "task") {
    const task = requireTask(authority.taskID)
    if (task.project_id !== input.projectID || !sessionBelongsToTask(authority.sessionID, authority.taskID)) {
      throw new Error(`Office Artifact Task ${authority.taskID} execution identity is inconsistent`)
    }
    projectRoot = taskPrimaryProjectRoot(authority.taskID, { activeProjectID: input.projectID })
  } else {
    const session = await Session.get(authority.sessionID)
    if (session.projectID !== input.projectID || path.resolve(session.directory) !== path.resolve(authority.rootDirectory)) {
      throw new Error(`Office Artifact conversation ${authority.sessionID} execution identity is inconsistent`)
    }
  }
  const root = ProjectRuntimePaths.rootSessionToolOutputDir(projectRoot, authority.sessionID)
  await fs.mkdir(root, { recursive: true })
  const directory = await fs.mkdtemp(path.join(root, ".office-artifact-"))
  try {
    return await fn(directory)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

function cm(value: number): string {
  return `${value}cm`
}

function stripColor(value: string): string {
  return value.startsWith("#") ? value.slice(1) : value
}

async function assertSafeImageBytes(bytes: Buffer, label: string): Promise<void> {
  const metadata = await sharp(bytes, {
    animated: true,
    limitInputPixels: MAX_IMAGE_PIXELS,
    failOn: "warning",
  })
    .metadata()
    .catch((error) => {
      throw new Error(`${label} could not be decoded safely`, { cause: error })
    })
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const pages = metadata.pages ?? 1
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(
      `${label} dimensions ${width}x${height} exceed ${MAX_IMAGE_DIMENSION}px or ${MAX_IMAGE_PIXELS} pixels`,
    )
  }
  if (pages !== 1) throw new Error(`${label} must be a single-frame image, found ${pages} frames`)
}

async function stagePicture(input: {
  projectID: string
  sourceUrl: string
  directory: string
  index: number
}): Promise<string> {
  const reference = await AttachmentStore.requireReference({ projectID: input.projectID, url: input.sourceUrl })
  const extension = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ]).get(reference.mime)
  if (!extension) throw new Error(`presentation picture MIME is unsupported: ${reference.mime}`)
  if (reference.size > MAX_IMAGE_BYTES) throw new Error(`presentation picture exceeds ${MAX_IMAGE_BYTES} bytes`)
  const located = AttachmentStore.nameFromUrl(reference.url)
  if (!located) throw new Error(`presentation picture URL is not canonical: ${reference.url}`)
  const bytes = await AttachmentStore.read(located.projectID, located.name)
  const validImage =
    (reference.mime === "image/png" &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (reference.mime === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (reference.mime === "image/gif" && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) ||
    (reference.mime === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP")
  if (!validImage) throw new Error(`presentation picture bytes do not match declared MIME: ${reference.mime}`)
  await assertSafeImageBytes(bytes, "presentation picture")
  const destination = path.join(input.directory, `picture-${input.index}.${extension}`)
  await fs.writeFile(destination, bytes, { flag: "wx" })
  return destination
}

async function authorCommands(
  input: AuthorOfficeArtifactInput,
  directory: string,
  currentProjectID: string,
): Promise<OfficeCliCommand[]> {
  const commands: OfficeCliCommand[] = []
  let pictureIndex = 0
  for (const [slideIndex, slide] of input.slides.entries()) {
    commands.push({
      command: "add",
      parent: "/",
      type: "slide",
      props: {
        layout: "Blank",
        background: stripColor(slide.background),
      },
    })
    const parent = `/slide[${slideIndex + 1}]`
    for (const element of slide.elements) {
      const base = {
        x: cm(element.x),
        y: cm(element.y),
        width: cm(element.width),
        height: cm(element.height),
      }
      if (element.kind === "picture") {
        const source = await stagePicture({
          projectID: currentProjectID,
          sourceUrl: element.source_url,
          directory,
          index: ++pictureIndex,
        })
        commands.push({
          command: "add",
          parent,
          type: "picture",
          props: {
            ...base,
            src: source,
            alt: element.alt,
            ...(element.crop ? { crop: element.crop } : {}),
          },
        })
        continue
      }
      if (element.kind === "chart") {
        commands.push({
          command: "add",
          parent,
          type: "chart",
          props: {
            ...base,
            chartType: element.chart_type,
            title: element.title,
            categories: element.categories.join(","),
            data: element.series.map((series) => `${series.name}:${series.values.join(",")}`).join(";"),
            colors: element.colors.map(stripColor).join(","),
            legend: element.legend,
            dataLabels: element.data_labels,
          },
        })
        continue
      }
      commands.push({
        command: "add",
        parent,
        type: "shape",
        props: {
          ...base,
          geometry: element.geometry,
          fill: element.fill === "none" ? "none" : stripColor(element.fill),
          line: element.line === "none" ? "none" : stripColor(element.line),
          ...(element.kind === "shape" ? { opacity: String(element.opacity) } : {}),
          ...(element.text ? { text: element.text } : {}),
          size: String(element.font_size),
          color: stripColor(element.color),
          bold: String(element.bold),
          align: element.align,
          valign: element.valign,
          ...(element.kind === "text" ? { font: element.font } : {}),
        },
      })
    }
  }
  return commands
}

function parseJsonResult(result: Process.Result, label: string): Record<string, unknown> {
  if (result.stdout.length > 2 * 1024 * 1024) throw new Error(`${label} returned excessive JSON output`)
  let value: unknown
  try {
    value = JSON.parse(result.stdout.toString("utf8"))
  } catch (error) {
    throw new Error(`${label} returned invalid JSON`, { cause: error })
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} returned a non-object`)
  const record = value as Record<string, unknown>
  if (record.success !== true) throw new Error(`${label} did not report success`)
  return record
}

function assertZeroOfficeCliIssueCount(result: Record<string, unknown>, label: string): void {
  const data = result.data
  if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).count !== 0) {
    throw new Error(`${label} reported presentation issues`)
  }
}

export async function authorOfficeArtifact(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: OfficeArtifactDependencies
}): Promise<{ reference: AttachmentStore.Reference; slideTitles: string[] }> {
  const parsed = AuthorOfficeArtifactInput.parse(input.raw)
  const dependencies = input.dependencies ?? defaultOfficeArtifactDependencies
  const currentProjectID = projectID(input.extra)
  return withOfficeWorkspace({ executionAuthority: input.executionAuthority, projectID: currentProjectID }, async (directory) => {
    await dependencies.officeCliPath()
    const outputPath = path.join(directory, parsed.filename)
    const created = await dependencies.runOfficeCli({
      executionAuthority: input.executionAuthority,
      args: ["create", outputPath, "--type", "pptx", "--locale", parsed.locale, "--json"],
      cwd: directory,
      abort: input.abort,
    })
    parseJsonResult(created, "OfficeCLI create")
    const batchPath = path.join(directory, "authoring.json")
    await fs.writeFile(batchPath, JSON.stringify(await authorCommands(parsed, directory, currentProjectID)), {
      flag: "wx",
    })
    const batched = await dependencies.runOfficeCli({
      executionAuthority: input.executionAuthority,
      args: ["batch", outputPath, "--input", batchPath, "--stop-on-error", "--json"],
      cwd: directory,
      abort: input.abort,
    })
    parseJsonResult(batched, "OfficeCLI batch")
    const bytes = await fs.readFile(outputPath)
    if (bytes.byteLength > MAX_PRESENTATION_BYTES) {
      throw new Error(`authored presentation exceeds ${MAX_PRESENTATION_BYTES} bytes`)
    }
    await inspectPptxPackage(bytes)
    return {
      reference: await AttachmentStore.write(currentProjectID, bytes, PPTX_MIME, parsed.filename),
      slideTitles: parsed.slides.map((slide) => slide.title),
    }
  })
}

export type PptxInspection = {
  slideCount: number
  entryCount: number
  uncompressedBytes: number
}

function isSupportedCreatedPptxPart(name: string): boolean {
  return (
    name === "[Content_Types].xml" ||
    name === "_rels/.rels" ||
    /^docProps\/(?:app|core|custom)\.xml$/.test(name) ||
    name === "ppt/presentation.xml" ||
    name === "ppt/_rels/presentation.xml.rels" ||
    /^ppt\/theme\/theme[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/slideMasters\/slideMaster[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/slideMasters\/_rels\/slideMaster[1-9][0-9]*\.xml\.rels$/.test(name) ||
    /^ppt\/slideLayouts\/slideLayout[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/slideLayouts\/_rels\/slideLayout[1-9][0-9]*\.xml\.rels$/.test(name) ||
    /^ppt\/slides\/slide[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/slides\/_rels\/slide[1-9][0-9]*\.xml\.rels$/.test(name) ||
    /^ppt\/slides\/charts\/chart[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/media\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|webp)$/i.test(name)
  )
}

export async function inspectPptxPackage(bytes: Buffer): Promise<PptxInspection> {
  if (bytes.byteLength > MAX_PRESENTATION_BYTES) throw new Error(`PPTX exceeds ${MAX_PRESENTATION_BYTES} bytes`)
  // Copy into a zero-offset Uint8Array because Buffer instances may expose a
  // pooled backing ArrayBuffer that contains unrelated bytes outside the view.
  const reader = new ZipReader(new Uint8ArrayReader(Uint8Array.from(bytes)))
  try {
    const entries = await reader.getEntries()
    if (entries.length === 0 || entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`PPTX entry count ${entries.length} is outside the supported range`)
    }
    const names = new Set<string>()
    const normalizedNames = new Set<string>()
    let uncompressedBytes = 0
    for (const entry of entries) {
      const name = entry.filename
      if (
        !name ||
        name.includes("\\") ||
        name.startsWith("/") ||
        name.split("/").some((segment) => segment === "." || segment === "..")
      ) {
        throw new Error(`PPTX contains an unsafe ZIP entry: ${JSON.stringify(name)}`)
      }
      if (names.has(name)) throw new Error(`PPTX contains a duplicate ZIP entry: ${name}`)
      names.add(name)
      const normalizedName = name.toLowerCase()
      if (normalizedNames.has(normalizedName)) {
        throw new Error(`PPTX contains a case-insensitive duplicate ZIP entry: ${name}`)
      }
      normalizedNames.add(normalizedName)
      if (entry.encrypted) throw new Error(`PPTX contains an encrypted ZIP entry: ${name}`)
      if (!isSupportedCreatedPptxPart(name)) {
        throw new Error(`PPTX contains an unsupported create-only OOXML part: ${name}`)
      }
      uncompressedBytes += entry.uncompressedSize
      if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error(`PPTX uncompressed content exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`)
      }
      if (/\.(xml|rels)$/i.test(name) && entry.getData) {
        const text = await entry.getData(new TextWriter())
        if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
          throw new Error(`PPTX contains a document type or entity declaration: ${name}`)
        }
        if (/\.rels$/i.test(name) && /TargetMode\s*=\s*["']External["']/i.test(text)) {
          throw new Error(`PPTX contains an external package relationship: ${name}`)
        }
        if (
          (name === "[Content_Types].xml" || /\.rels$/i.test(name)) &&
          /macroEnabled|vbaProject|activeX|oleObject/i.test(text)
        ) {
          throw new Error(`PPTX declares unsupported executable, macro, OLE, or ActiveX content: ${name}`)
        }
      }
      if (/^ppt\/media\//.test(name) && entry.getData) {
        const media = Buffer.from(await entry.getData(new Uint8ArrayWriter()))
        if (media.byteLength > MAX_IMAGE_BYTES) {
          throw new Error(`PPTX media part ${name} exceeds ${MAX_IMAGE_BYTES} bytes`)
        }
        await assertSafeImageBytes(media, `PPTX media part ${name}`)
      }
    }
    for (const required of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"]) {
      if (!names.has(required)) throw new Error(`PPTX is missing required package entry: ${required}`)
    }
    const slideCount = [...names].filter((name) => /^ppt\/slides\/slide[1-9][0-9]*\.xml$/.test(name)).length
    if (slideCount === 0 || slideCount > 40) throw new Error(`PPTX slide count ${slideCount} is unsupported`)
    return { slideCount, entryCount: entries.length, uncompressedBytes }
  } finally {
    await reader.close()
  }
}

function attachmentBytes(reference: AttachmentStore.Reference): Promise<Buffer> {
  const located = AttachmentStore.nameFromUrl(reference.url)
  if (!located) throw new Error(`attachment URL is not canonical: ${reference.url}`)
  return AttachmentStore.read(located.projectID, located.name)
}

export async function inspectOfficeArtifact(input: {
  raw: unknown
  extra?: Record<string, unknown>
}): Promise<{ source: AttachmentStore.Reference; inspection: PptxInspection }> {
  const parsed = InspectOfficeArtifactInput.parse(input.raw)
  const currentProjectID = projectID(input.extra)
  const source = await AttachmentStore.requireReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
  })
  return { source, inspection: await inspectPptxPackage(await attachmentBytes(source)) }
}

export async function validateOfficeArtifact(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: OfficeArtifactDependencies
}): Promise<{
  source: AttachmentStore.Reference
  inspection: PptxInspection
  validation: Record<string, unknown>
  issues: Record<string, unknown>
  renders: z.output<typeof RenderReference>[]
}> {
  const parsed = ValidateOfficeArtifactInput.parse(input.raw)
  const dependencies = input.dependencies ?? defaultOfficeArtifactDependencies
  const currentProjectID = projectID(input.extra)
  const source = await AttachmentStore.requireReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
  })
  const sourceBytes = await attachmentBytes(source)
  const inspection = await inspectPptxPackage(sourceBytes)
  return withOfficeWorkspace({ executionAuthority: input.executionAuthority, projectID: currentProjectID }, async (directory) => {
    await dependencies.officeCliPath()
    const sourcePath = path.join(directory, source.filename ?? "presentation.pptx")
    await fs.writeFile(sourcePath, sourceBytes, { flag: "wx" })
    const run = (args: string[]) =>
      dependencies.runOfficeCli({ executionAuthority: input.executionAuthority, args, cwd: directory, abort: input.abort })
    const validation = parseJsonResult(await run(["validate", sourcePath, "--json"]), "OfficeCLI validate")
    assertZeroOfficeCliIssueCount(validation, "OfficeCLI validation")
    const issues = parseJsonResult(await run(["view", sourcePath, "issues", "--json"]), "OfficeCLI issues")
    assertZeroOfficeCliIssueCount(issues, "OfficeCLI issue inspection")
    const renders: z.output<typeof RenderReference>[] = []
    for (let slide = 1; slide <= inspection.slideCount; slide++) {
      const renderPath = path.join(directory, `slide-${slide}.png`)
      await run([
        "view",
        sourcePath,
        "screenshot",
        "--out",
        renderPath,
        "--page",
        String(slide),
        "--render",
        "html",
        "--screenshot-width",
        "1280",
        "--screenshot-height",
        "720",
      ])
      const bytes = await fs.readFile(renderPath)
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`OfficeCLI rendered slide ${slide} above the ${MAX_IMAGE_BYTES} byte limit`)
      }
      if (
        bytes.byteLength < 8 ||
        !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        throw new Error(`OfficeCLI did not render slide ${slide} as PNG`)
      }
      const reference = await AttachmentStore.write(currentProjectID, bytes, "image/png", `slide-${slide}.png`)
      renders.push(RenderReference.parse({ slide, ...reference }))
    }
    return { source, inspection, validation, issues, renders }
  })
}

export async function prepareOfficeArtifactDeliverable(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: OfficeArtifactDependencies
}): Promise<{
  parsed: z.output<typeof DeliverOfficeArtifactInput>
  source: AttachmentStore.Reference
  renders: AttachmentStore.Reference[]
}> {
  const parsed = DeliverOfficeArtifactInput.parse(input.raw)
  const currentProjectID = projectID(input.extra)
  const source = await AttachmentStore.requireReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
  })
  const bytes = await attachmentBytes(source)
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (source.sha !== parsed.source_sha || digest !== parsed.source_sha) {
    throw new Error("PPTX digest does not match the validated candidate")
  }
  const inspection = await inspectPptxPackage(bytes)
  if (inspection.slideCount !== parsed.slides.length) {
    throw new Error(
      `PPTX has ${inspection.slideCount} slides but delivery supplied ${parsed.slides.length} slide records`,
    )
  }
  const validated = await validateOfficeArtifact({
    raw: { format: "presentation", source_url: source.url },
    executionAuthority: input.executionAuthority,
    abort: input.abort,
    extra: input.extra,
    dependencies: input.dependencies,
  })
  if (validated.source.sha !== source.sha || validated.inspection.slideCount !== inspection.slideCount) {
    throw new Error("final OfficeCLI validation did not bind to the requested PPTX candidate")
  }
  const renders = await Promise.all(
    validated.renders.map((render) =>
      AttachmentStore.requireReference({
        projectID: currentProjectID,
        url: render.url,
        mime: "image/png",
      }),
    ),
  )
  return { parsed, source, renders }
}
