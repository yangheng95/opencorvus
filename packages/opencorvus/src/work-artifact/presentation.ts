import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { requireTask } from "@/engine/store"
import { sessionBelongsToTask, type SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { Session } from "@/session"
import { AttachmentStore } from "@/storage/attachment-store"
import { Process } from "@/util/process"
import { isCompiledBinaryRuntime } from "@/runtime/compiled-binary"
import { requireRuntimePackage } from "@/runtime/package-require"
import { OFFICE_PRESENTATION_PROFILE_LIMITS, WorkArtifactProfileRegistry } from "@/work-artifact/profile-registry"
import { Uint8ArrayReader, ZipReader } from "@zip.js/zip.js"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import z from "zod"
import { promisify } from "node:util"
import {
  officeCliRuntimeIdentity,
  officeCliRuntime,
  parseWorkArtifactRuntimeLock,
  WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH,
  type WorkArtifactRuntimeLock,
} from "./runtime/runtime-lock"
import {
  verifyWorkArtifactTargetPackageManifest,
} from "./runtime/package-manifest"

// PPTX means PowerPoint Open XML Presentation.
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const MAX_PRESENTATION_BYTES = OFFICE_PRESENTATION_PROFILE_LIMITS.inputBytes
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_RECEIPT_BYTES = 1024 * 1024
const MAX_ZIP_ENTRIES = 2_000
const MAX_UNCOMPRESSED_BYTES = 120 * 1024 * 1024
const MAX_XML_PART_BYTES = 8 * 1024 * 1024
const OFFICECLI_INACTIVITY_TIMEOUT_MS = 45_000
export const WORK_ARTIFACT_VALIDATION_RECEIPT_MIME =
  "application/vnd.opencorvus.work-artifact-validation-receipt+json"
const SLIDE_WIDTH_CM = 33.867

function requireOperationBudget(deadline: number, wallClockMs: number, abort?: AbortSignal): number {
  if (abort?.aborted) throw new Error("Work Artifact operation was cancelled")
  const remaining = Math.floor(deadline - performance.now())
  if (remaining <= 0) throw new Error(`Work Artifact operation exceeded ${wallClockMs}ms`)
  return remaining
}

async function readBoundedFile(filename: string, maxBytes: number, label: string): Promise<Buffer> {
  const info = await fs.stat(filename)
  if (!info.isFile()) throw new Error(`${label} is not a regular file`)
  if (info.size > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`)
  const bytes = await fs.readFile(filename)
  if (bytes.byteLength > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`)
  return bytes
}
const SLIDE_HEIGHT_CM = 19.05
const MAX_IMAGE_DIMENSION = 10_000
const MAX_IMAGE_PIXELS = 40_000_000
const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")
declare const OPENCORVUS_LIBC: string | undefined
const execFileAsync = promisify(execFile)
let windowsUserSid: Promise<string> | undefined

async function currentWindowsUserSid(): Promise<string> {
  if (!windowsUserSid) {
    windowsUserSid = execFileAsync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
      timeout: 10_000,
      windowsHide: true,
    }).then(({ stdout }) => {
      const sid = stdout.match(/S-\d-(?:\d+-)+\d+/)?.[0]
      if (!sid) throw new Error("Unable to resolve the current Windows user SID for Work Artifact ACL isolation")
      return sid
    })
  }
  return windowsUserSid
}

export async function secureWorkArtifactPrivateDirectory(directory: string): Promise<void> {
  if (process.platform !== "win32") {
    await fs.chmod(directory, 0o700)
    return
  }
  const sid = await currentWindowsUserSid()
  await execFileAsync("icacls.exe", [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], {
    timeout: 10_000,
    windowsHide: true,
  })
}

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

export const AuthorWorkArtifactInput = z
  .object({
    profile: z.literal("office.presentation@1"),
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
      .max(OFFICE_PRESENTATION_PROFILE_LIMITS.pagesOrFrames),
  })
  .strict()
export type AuthorWorkArtifactInput = z.output<typeof AuthorWorkArtifactInput>

export const InspectWorkArtifactInput = z
  .object({
    profile: z.literal("office.presentation@1"),
    source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
  })
  .strict()

export const ValidateWorkArtifactInput = InspectWorkArtifactInput

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

const RuntimeReceiptIdentity = z
  .object({
    id: z.literal("officecli"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    lock_revision: z.string().regex(/^[a-f0-9]{64}$/),
    package_sha: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

const ValidationReceiptPayload = z
  .object({
    schema_version: z.literal(1),
    profile: z.literal("office.presentation@1"),
    source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    source_sha: z.string().regex(/^[a-f0-9]{64}$/),
    runtime: RuntimeReceiptIdentity,
    resource_usage: z
      .object({
        input_bytes: z.number().int().nonnegative(),
        runtime_output_bytes: z.number().int().nonnegative(),
        render_bytes: z.number().int().nonnegative(),
        wall_clock_ms: z.number().int().positive(),
      })
      .strict(),
    renders: z
      .array(
        z
          .object({
            slide: z.number().int().positive(),
            sha: z.string().regex(/^[a-f0-9]{64}$/),
            url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
          })
          .strict(),
      )
      .min(1)
      .max(OFFICE_PRESENTATION_PROFILE_LIMITS.pagesOrFrames),
  })
  .strict()

export const WorkArtifactValidationReceiptPayload = ValidationReceiptPayload
export type WorkArtifactValidationReceiptPayload = z.output<typeof WorkArtifactValidationReceiptPayload>
export type WorkArtifactValidationReceipt = {
  reference: AttachmentStore.Reference
  payload: WorkArtifactValidationReceiptPayload
}

export const DeliverWorkArtifactInput = z
  .object({
    profile: z.literal("office.presentation@1"),
    title: z.string().trim().min(1).max(160),
    source_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    validation_receipt_url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    validation_receipt_sha: z.string().regex(/^[a-f0-9]{64}$/),
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
      .max(OFFICE_PRESENTATION_PROFILE_LIMITS.pagesOrFrames),
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
  timeoutMs?: number
  maxOutputBytes?: number
}) => Promise<Process.Result>

export type WorkArtifactPresentationRuntimeIdentity = {
  id: "officecli"
  label: string
  version: string
  lockRevision: string
  packageSha: string
}

export type WorkArtifactPresentationDependencies = {
  officeCliPath(): Promise<string>
  runtimeIdentity(): Promise<WorkArtifactPresentationRuntimeIdentity>
  runOfficeCli: OfficeCliRunner
}

export function packagedOfficeCliPath(): string {
  return path.join(path.dirname(process.execPath), "bin", process.platform === "win32" ? "officecli.exe" : "officecli")
}

export function packagedWorkArtifactRuntimeLockPath(): string {
  return path.join(path.dirname(process.execPath), ...WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH.split("/"))
}

export async function prepareWorkArtifactRuntimeEnvironment(cwd: string): Promise<NodeJS.ProcessEnv> {
  const configuration = path.join(cwd, ".officecli-config")
  const cache = path.join(cwd, ".officecli-cache")
  const temporary = path.join(cwd, ".officecli-temp")
  await Promise.all([
    fs.mkdir(configuration, { recursive: true, mode: 0o700 }),
    fs.mkdir(cache, { recursive: true, mode: 0o700 }),
    fs.mkdir(temporary, { recursive: true, mode: 0o700 }),
  ])
  if (process.platform !== "win32") {
    await Promise.all([configuration, cache, temporary].map((directory) => fs.chmod(directory, 0o700)))
  }
  return {
    OFFICECLI_NO_AUTO_RESIDENT: "1",
    OFFICECLI_SKIP_UPDATE: "1",
    OFFICECLI_RESIDENT_FLUSH: "each",
    APPDATA: configuration,
    LOCALAPPDATA: cache,
    XDG_CONFIG_HOME: configuration,
    XDG_CACHE_HOME: cache,
    DOTNET_CLI_HOME: cache,
    HOME: configuration,
    USERPROFILE: configuration,
    TMP: temporary,
    TEMP: temporary,
    TMPDIR: temporary,
    DOTNET_BUNDLE_EXTRACT_BASE_DIR: path.join(cache, "dotnet-bundle"),
  }
}

let verifiedPackagedRuntime:
  | Promise<{ executable: string; identity: WorkArtifactPresentationRuntimeIdentity; lock: WorkArtifactRuntimeLock }>
  | undefined

function runtimeTargetABI(): "musl" | undefined {
  if (process.platform !== "linux") return undefined
  const built = typeof OPENCORVUS_LIBC === "string" ? OPENCORVUS_LIBC : undefined
  return (built || process.env.OPENCORVUS_LIBC || "glibc") === "musl" ? "musl" : undefined
}

async function verifyPackagedOfficeCliRuntime(): Promise<{
  executable: string
  identity: WorkArtifactPresentationRuntimeIdentity
  lock: WorkArtifactRuntimeLock
}> {
  if (verifiedPackagedRuntime) return verifiedPackagedRuntime
  verifiedPackagedRuntime = (async () => {
    const executable = packagedOfficeCliPath()
    const info = await fs.stat(executable).catch(() => undefined)
    if (!info?.isFile()) throw new Error(`Packaged OfficeCLI runtime is unavailable: ${executable}`)
    if (process.platform !== "win32" && (info.mode & 0o111) !== 0o111) {
      throw new Error(`Packaged OfficeCLI runtime is not executable: ${executable}`)
    }
    const root = path.dirname(process.execPath)
    const target = {
      os: process.platform as "darwin" | "linux" | "win32",
      arch: process.arch as "arm64" | "x64",
      ...(runtimeTargetABI() ? { abi: runtimeTargetABI() } : {}),
    }
    const lock = parseWorkArtifactRuntimeLock(JSON.parse(await fs.readFile(packagedWorkArtifactRuntimeLockPath(), "utf8")))
    const manifest = await verifyWorkArtifactTargetPackageManifest({ root, target, lock })
    const runtime = officeCliRuntime(lock)
    const asset = runtime.assets.find(
      (candidate) => candidate.os === target.os && candidate.arch === target.arch && candidate.abi === target.abi,
    )
    if (!asset) {
      throw new Error(`Packaged OfficeCLI runtime lock has no asset for ${process.platform}-${process.arch}`)
    }
    const packaged = manifest.files.find((file) => file.path === `bin/${process.platform === "win32" ? "officecli.exe" : "officecli"}`)
    if (!packaged || packaged.kind !== "executable") throw new Error("Work Artifact target package manifest omits OfficeCLI")
    const identity = officeCliRuntimeIdentity(lock)
    return {
      executable,
      lock,
      identity: {
        ...identity,
        packageSha: packaged.sha256,
      },
    }
  })()
  return verifiedPackagedRuntime
}

export const defaultWorkArtifactPresentationDependencies: WorkArtifactPresentationDependencies = {
  async officeCliPath() {
    return (await verifyPackagedOfficeCliRuntime()).executable
  },
  async runtimeIdentity() {
    return (await verifyPackagedOfficeCliRuntime()).identity
  },
  async runOfficeCli(input) {
    const executable = await defaultWorkArtifactPresentationDependencies.officeCliPath()
    const command = [executable, ...input.args]
    const options = {
      abort: input.abort,
      env: await prepareWorkArtifactRuntimeEnvironment(input.cwd),
      inactivityTimeoutMs: OFFICECLI_INACTIVITY_TIMEOUT_MS,
      inactivityTimeoutMessage: `OfficeCLI was inactive for ${OFFICECLI_INACTIVITY_TIMEOUT_MS}ms`,
      timeoutMs: input.timeoutMs ?? WorkArtifactProfileRegistry.require("office.presentation@1").limits.wallClockMs,
      maxOutputBytes:
        input.maxOutputBytes ?? WorkArtifactProfileRegistry.require("office.presentation@1").limits.outputBytes,
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
    throw new Error(`Work Artifact execution project identity does not match ${input.projectID}`)
  }
  let projectRoot = Instance.project.worktree
  if (authority.kind === "task") {
    const task = requireTask(authority.taskID)
    if (task.project_id !== input.projectID || !sessionBelongsToTask(authority.sessionID, authority.taskID)) {
      throw new Error(`Work Artifact Task ${authority.taskID} execution identity is inconsistent`)
    }
    projectRoot = taskPrimaryProjectRoot(authority.taskID, { activeProjectID: input.projectID })
  } else {
    const session = await Session.get(authority.sessionID)
    if (session.projectID !== input.projectID || path.resolve(session.directory) !== path.resolve(authority.directory)) {
      throw new Error(`Work Artifact conversation ${authority.sessionID} execution identity is inconsistent`)
    }
  }
  const root =
    process.platform === "win32"
      ? path.join(
          os.tmpdir(),
          "opencorvus-work-artifact",
          createHash("sha256").update(`${input.projectID}\0${authority.sessionID}`).digest("hex").slice(0, 20),
        )
      : ProjectRuntimePaths.rootSessionToolOutputDir(projectRoot, authority.sessionID)
  await fs.mkdir(root, { recursive: true, mode: 0o700 })
  await secureWorkArtifactPrivateDirectory(root)
  const directory = await fs.mkdtemp(path.join(root, ".work-artifact-"))
  await secureWorkArtifactPrivateDirectory(directory)
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

export async function assertWorkArtifactRenderPng(bytes: Buffer, label: string): Promise<void> {
  if (
    bytes.byteLength < 8 ||
    !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new Error(`${label} is not a PNG`)
  }
  const metadata = await sharp(bytes, { animated: true, limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" })
    .metadata()
    .catch((error) => {
      throw new Error(`${label} could not be decoded safely`, { cause: error })
    })
  if (metadata.pages !== undefined && metadata.pages !== 1) throw new Error(`${label} must be single-frame`)
  if (metadata.width !== 1280 || metadata.height !== 720) {
    throw new Error(`${label} must be exactly 1280x720, received ${metadata.width ?? 0}x${metadata.height ?? 0}`)
  }
}

async function stagePicture(input: {
  projectID: string
  sourceUrl: string
  directory: string
  index: number
  maxBytes: number
}): Promise<{ destination: string; bytes: number }> {
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: input.projectID,
    url: input.sourceUrl,
    maxBytes: Math.min(MAX_IMAGE_BYTES, input.maxBytes),
  })
  const { reference, bytes } = snapshot
  const extension = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ]).get(reference.mime)
  if (!extension) throw new Error(`presentation picture MIME is unsupported: ${reference.mime}`)
  if (reference.size > MAX_IMAGE_BYTES) throw new Error(`presentation picture exceeds ${MAX_IMAGE_BYTES} bytes`)
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
  await fs.writeFile(destination, bytes, { flag: "wx", mode: 0o600 })
  return { destination, bytes: bytes.byteLength }
}

async function authorCommands(
  input: AuthorWorkArtifactInput,
  directory: string,
  currentProjectID: string,
): Promise<OfficeCliCommand[]> {
  const commands: OfficeCliCommand[] = []
  let pictureIndex = 0
  let pictureInputBytes = 0
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
        const staged = await stagePicture({
          projectID: currentProjectID,
          sourceUrl: element.source_url,
          directory,
          index: ++pictureIndex,
          maxBytes: OFFICE_PRESENTATION_PROFILE_LIMITS.inputBytes - pictureInputBytes,
        })
        pictureInputBytes += staged.bytes
        if (pictureInputBytes > OFFICE_PRESENTATION_PROFILE_LIMITS.inputBytes) {
          throw new Error(`presentation picture inputs exceed ${OFFICE_PRESENTATION_PROFILE_LIMITS.inputBytes} bytes`)
        }
        commands.push({
          command: "add",
          parent,
          type: "picture",
          props: {
            ...base,
            src: staged.destination,
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

export function parseWorkArtifactRuntimeJson(stdout: Uint8Array, label: string): Record<string, unknown> {
  if (stdout.length > 2 * 1024 * 1024) throw new Error(`${label} returned excessive JSON output`)
  let value: unknown
  try {
    value = JSON.parse(Buffer.from(stdout).toString("utf8"))
  } catch (error) {
    throw new Error(`${label} returned invalid JSON`, { cause: error })
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} returned a non-object`)
  const record = value as Record<string, unknown>
  if (record.success !== true) throw new Error(`${label} did not report success`)
  return record
}

function parseJsonResult(result: Process.Result, label: string): Record<string, unknown> {
  return parseWorkArtifactRuntimeJson(result.stdout, label)
}

export function assertZeroWorkArtifactRuntimeIssueCount(result: Record<string, unknown>, label: string): void {
  const data = result.data
  if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).count !== 0) {
    throw new Error(`${label} reported presentation issues`)
  }
}

export async function authorWorkArtifactPresentation(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: WorkArtifactPresentationDependencies
}): Promise<{ reference: AttachmentStore.Reference; slideTitles: string[] }> {
  const operationStartedAt = performance.now()
  const parsed = AuthorWorkArtifactInput.parse(input.raw)
  const dependencies = input.dependencies ?? defaultWorkArtifactPresentationDependencies
  const limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const currentProjectID = projectID(input.extra)
  const deadline = operationStartedAt + limits.wallClockMs
  return withOfficeWorkspace({ executionAuthority: input.executionAuthority, projectID: currentProjectID }, async (directory) => {
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    let outputBytes = 0
    const run = async (args: string[]) => {
      const timeoutMs = Math.floor(deadline - performance.now())
      const maxOutputBytes = limits.outputBytes - outputBytes
      if (timeoutMs <= 0) throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
      if (maxOutputBytes <= 0) throw new Error(`Work Artifact operation output exceeded ${limits.outputBytes} bytes`)
      const result = await dependencies.runOfficeCli({
        executionAuthority: input.executionAuthority,
        args,
        cwd: directory,
        abort: input.abort,
        timeoutMs,
        maxOutputBytes,
      })
      outputBytes += result.stdout.byteLength + result.stderr.byteLength
      if (outputBytes > limits.outputBytes) {
        throw new Error(`Work Artifact operation output exceeded ${limits.outputBytes} bytes`)
      }
      return result
    }
    await dependencies.officeCliPath()
    const outputPath = path.join(directory, parsed.filename)
    const created = await run(["create", outputPath, "--type", "pptx", "--locale", parsed.locale, "--json"])
    parseJsonResult(created, "OfficeCLI create")
    const batchPath = path.join(directory, "authoring.json")
    await fs.writeFile(batchPath, JSON.stringify(await authorCommands(parsed, directory, currentProjectID)), {
      flag: "wx",
      mode: 0o600,
    })
    const batched = await run(["batch", outputPath, "--input", batchPath, "--stop-on-error", "--json"])
    parseJsonResult(batched, "OfficeCLI batch")
    const bytes = await readBoundedFile(outputPath, MAX_PRESENTATION_BYTES, "authored presentation")
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    if (bytes.byteLength > MAX_PRESENTATION_BYTES) {
      throw new Error(`authored presentation exceeds ${MAX_PRESENTATION_BYTES} bytes`)
    }
    const remainingMs = requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    await inspectPptxPackage(bytes, { abort: input.abort, timeoutMs: remainingMs })
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    const reference = await AttachmentStore.write(currentProjectID, bytes, PPTX_MIME, parsed.filename)
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    return {
      reference,
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
    /^ppt\/slides\/charts\/(?:chart|style|colors)[1-9][0-9]*\.xml$/.test(name) ||
    /^ppt\/slides\/charts\/_rels\/chart[1-9][0-9]*\.xml\.rels$/.test(name) ||
    /^ppt\/embeddings\/[A-Za-z0-9][A-Za-z0-9._-]*\.xlsx$/i.test(name) ||
    /^ppt\/media\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|webp)$/i.test(name)
  )
}

function isSupportedCreatedWorkbookPart(name: string): boolean {
  return (
    name === "[Content_Types].xml" ||
    name === "_rels/.rels" ||
    /^docProps\/(?:app|core|custom)\.xml$/.test(name) ||
    name === "xl/workbook.xml" ||
    name === "xl/_rels/workbook.xml.rels" ||
    name === "xl/styles.xml" ||
    name === "xl/sharedStrings.xml" ||
    /^xl\/theme\/theme[1-9][0-9]*\.xml$/.test(name) ||
    /^xl\/worksheets\/sheet[1-9][0-9]*\.xml$/.test(name) ||
    /^xl\/worksheets\/_rels\/sheet[1-9][0-9]*\.xml\.rels$/.test(name)
  )
}

type ReadableZipEntry = {
  filename: string
  encrypted?: boolean
  uncompressedSize: number
  getData?: (writer: { writable: WritableStream<Uint8Array> }) => Promise<unknown>
}

async function readZipEntryBounded(input: {
  entry: ReadableZipEntry
  name: string
  entryLimit: number
  addExpandedBytes: (bytes: number) => void
}): Promise<Buffer> {
  if (!input.entry.getData) throw new Error(`ZIP entry cannot be read: ${input.name}`)
  const chunks: Buffer[] = []
  let entryBytes = 0
  await input.entry.getData({
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        entryBytes += chunk.byteLength
        if (entryBytes > input.entryLimit) throw new Error(`part ${input.name} exceeds ${input.entryLimit} actual bytes`)
        input.addExpandedBytes(chunk.byteLength)
        chunks.push(Buffer.from(chunk))
      },
    }),
  })
  return Buffer.concat(chunks, entryBytes)
}

async function inspectEmbeddedWorkbook(bytes: Buffer, addExpandedBytes: (bytes: number) => void): Promise<void> {
  const reader = new ZipReader(new Uint8ArrayReader(Uint8Array.from(bytes)))
  try {
    const entries = await reader.getEntries()
    if (entries.length === 0 || entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`embedded workbook entry count ${entries.length} is outside the supported range`)
    }
    const names = new Set<string>()
    const normalized = new Set<string>()
    for (const entry of entries) {
      const name = entry.filename
      if (!name || name.includes("\\") || name.startsWith("/") || name.split("/").some((part) => part === "." || part === "..")) {
        throw new Error(`embedded workbook contains an unsafe ZIP entry: ${JSON.stringify(name)}`)
      }
      if (names.has(name) || normalized.has(name.toLowerCase())) throw new Error(`embedded workbook contains a duplicate ZIP entry: ${name}`)
      names.add(name)
      normalized.add(name.toLowerCase())
      if (entry.encrypted) throw new Error(`embedded workbook contains an encrypted ZIP entry: ${name}`)
      if (!isSupportedCreatedWorkbookPart(name)) throw new Error(`embedded workbook contains an unsupported create-only OOXML part: ${name}`)
      const data = await readZipEntryBounded({
        entry,
        name: `embedded workbook/${name}`,
        entryLimit: MAX_XML_PART_BYTES,
        addExpandedBytes,
      })
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data)
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(`embedded workbook contains a document type or entity declaration: ${name}`)
      if (/\.rels$/i.test(name) && /TargetMode\s*=\s*["']External["']/i.test(text)) {
        throw new Error(`embedded workbook contains an external package relationship: ${name}`)
      }
      if (/macroEnabled|vbaProject|activeX|oleObject/i.test(text)) {
        throw new Error(`embedded workbook declares unsupported executable, macro, OLE, or ActiveX content: ${name}`)
      }
    }
    for (const required of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"]) {
      if (!names.has(required)) throw new Error(`embedded workbook is missing required package entry: ${required}`)
    }
  } finally {
    await reader.close()
  }
}

export async function inspectPptxPackageUnsafe(bytes: Buffer): Promise<PptxInspection> {
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
      if (entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES - uncompressedBytes) {
        throw new Error(`PPTX uncompressed content exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`)
      }
      const entryLimit = /\.(xml|rels)$/i.test(name)
        ? MAX_XML_PART_BYTES
        : /^ppt\/media\//.test(name)
          ? MAX_IMAGE_BYTES
          : MAX_UNCOMPRESSED_BYTES
      const addExpandedBytes = (count: number) => {
        uncompressedBytes += count
        if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new Error(`PPTX actual uncompressed content exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`)
        }
      }
      const data = await readZipEntryBounded({ entry, name: `PPTX/${name}`, entryLimit, addExpandedBytes })
      if (/\.(xml|rels)$/i.test(name)) {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(data)
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
      if (/^ppt\/media\//.test(name)) {
        await assertSafeImageBytes(data, `PPTX media part ${name}`)
      }
      if (/^ppt\/embeddings\/.+\.xlsx$/i.test(name)) {
        await inspectEmbeddedWorkbook(data, addExpandedBytes)
      }
    }
    for (const required of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"]) {
      if (!names.has(required)) throw new Error(`PPTX is missing required package entry: ${required}`)
    }
    const slideCount = [...names].filter((name) => /^ppt\/slides\/slide[1-9][0-9]*\.xml$/.test(name)).length
    if (slideCount === 0 || slideCount > OFFICE_PRESENTATION_PROFILE_LIMITS.pagesOrFrames) {
      throw new Error(`PPTX slide count ${slideCount} is unsupported`)
    }
    return { slideCount, entryCount: entries.length, uncompressedBytes }
  } finally {
    await reader.close()
  }
}

export async function inspectPptxPackage(
  bytes: Buffer,
  options: { abort?: AbortSignal; timeoutMs?: number } = {},
): Promise<PptxInspection> {
  const timeoutMs = Math.min(
    options.timeoutMs ?? OFFICE_PRESENTATION_PROFILE_LIMITS.parserWallClockMs,
    OFFICE_PRESENTATION_PROFILE_LIMITS.parserWallClockMs,
  )
  if (options.abort?.aborted) throw new Error("Work Artifact PPTX inspection was cancelled")
  const command = isCompiledBinaryRuntime()
    ? [process.execPath]
    : [process.execPath, fileURLToPath(new URL("./presentation-inspector-process.ts", import.meta.url))]
  const result = await Process.runHost(command, {
    abort: options.abort,
    env: { OPENCORVUS_INTERNAL_WORK_ARTIFACT_INSPECTOR: "1" },
    timeoutMs,
    maxOutputBytes: 1024 * 1024,
    input: (async function* () { yield bytes })(),
  }).catch((error) => {
    if (error instanceof Error && error.message.includes(`timed out after ${timeoutMs}ms`)) {
      throw new Error(`Work Artifact PPTX inspection exceeded ${timeoutMs}ms`, { cause: error })
    }
    throw error
  })
  const response = z.object({
    ok: z.boolean(),
    value: z.object({ slideCount: z.number(), entryCount: z.number(), uncompressedBytes: z.number() }).optional(),
    error: z.string().optional(),
  }).parse(JSON.parse(result.stdout.toString("utf8")))
  if (!response.ok || !response.value) throw new Error(response.error ?? "PPTX inspection failed")
  return response.value
}

export async function inspectWorkArtifactPresentation(input: {
  raw: unknown
  abort?: AbortSignal
  extra?: Record<string, unknown>
}): Promise<{ source: AttachmentStore.Reference; inspection: PptxInspection }> {
  const startedAt = performance.now()
  const parsed = InspectWorkArtifactInput.parse(input.raw)
  const limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const deadline = startedAt + limits.wallClockMs
  const currentProjectID = projectID(input.extra)
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
    maxBytes: OFFICE_PRESENTATION_PROFILE_LIMITS.inputBytes,
  })
  const inspection = await inspectPptxPackage(snapshot.bytes, {
    abort: input.abort,
    timeoutMs: requireOperationBudget(deadline, limits.wallClockMs, input.abort),
  })
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  return {
    source: snapshot.reference,
    inspection,
  }
}

async function createValidationReceipt(input: {
  projectID: string
  sourceUrl: string
  sourceSha: string
  runtime: WorkArtifactPresentationRuntimeIdentity
  renders: z.output<typeof RenderReference>[]
  resourceUsage: WorkArtifactValidationReceiptPayload["resource_usage"]
}): Promise<WorkArtifactValidationReceipt> {
  const payload = ValidationReceiptPayload.parse({
    schema_version: 1,
    profile: "office.presentation@1",
    source_url: input.sourceUrl,
    source_sha: input.sourceSha,
    runtime: {
      id: input.runtime.id,
      version: input.runtime.version,
      lock_revision: input.runtime.lockRevision,
      package_sha: input.runtime.packageSha,
    },
    resource_usage: input.resourceUsage,
    renders: input.renders.map((render) => ({ slide: render.slide, sha: render.sha, url: render.url })),
  })
  const bytes = Buffer.from(JSON.stringify(payload), "utf8")
  const reference = await AttachmentStore.write(
    input.projectID,
    bytes,
    WORK_ARTIFACT_VALIDATION_RECEIPT_MIME,
    "work-artifact-validation-receipt.json",
  )
  return { reference, payload }
}

export async function validateWorkArtifactPresentation(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: WorkArtifactPresentationDependencies
  deadline?: number
}): Promise<{
  source: AttachmentStore.Reference
  inspection: PptxInspection
  validation: Record<string, unknown>
  issues: Record<string, unknown>
  renders: z.output<typeof RenderReference>[]
  resourceUsage: WorkArtifactValidationReceiptPayload["resource_usage"]
  receipt: WorkArtifactValidationReceipt
}> {
  const operationStartedAt = performance.now()
  const parsed = ValidateWorkArtifactInput.parse(input.raw)
  const dependencies = input.dependencies ?? defaultWorkArtifactPresentationDependencies
  const operationLimits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const operationDeadline = input.deadline ?? operationStartedAt + operationLimits.wallClockMs
  const currentProjectID = projectID(input.extra)
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
    maxBytes: operationLimits.inputBytes,
  })
  const { reference: source, bytes: sourceBytes } = snapshot
  const inspectionBudgetMs = Math.floor(operationDeadline - performance.now())
  if (inspectionBudgetMs <= 0) throw new Error(`Work Artifact operation exceeded ${operationLimits.wallClockMs}ms`)
  const inspection = await inspectPptxPackage(sourceBytes, {
    abort: input.abort,
    timeoutMs: inspectionBudgetMs,
  })
  return withOfficeWorkspace({ executionAuthority: input.executionAuthority, projectID: currentProjectID }, async (directory) => {
    const startedAt = operationStartedAt
    const limits = operationLimits
    const deadline = operationDeadline
    let runtimeOutputBytes = 0
    let renderBytes = 0
    await dependencies.officeCliPath()
    const sourcePath = path.join(directory, source.filename ?? "presentation.pptx")
    await fs.writeFile(sourcePath, sourceBytes, { flag: "wx", mode: 0o600 })
    const run = async (args: string[]) => {
      const timeoutMs = Math.floor(deadline - performance.now())
      const maxOutputBytes = limits.outputBytes - runtimeOutputBytes - renderBytes
      if (timeoutMs <= 0) throw new Error(`Work Artifact operation exceeded ${limits.wallClockMs}ms`)
      if (maxOutputBytes <= 0) throw new Error(`Work Artifact operation output exceeded ${limits.outputBytes} bytes`)
      const result = await dependencies.runOfficeCli({
        executionAuthority: input.executionAuthority,
        args,
        cwd: directory,
        abort: input.abort,
        timeoutMs,
        maxOutputBytes,
      })
      runtimeOutputBytes += result.stdout.byteLength + result.stderr.byteLength
      if (runtimeOutputBytes + renderBytes > limits.outputBytes) {
        throw new Error(`Work Artifact operation output exceeded ${limits.outputBytes} bytes`)
      }
      return result
    }
    const validation = parseJsonResult(await run(["validate", sourcePath, "--json"]), "OfficeCLI validate")
    assertZeroWorkArtifactRuntimeIssueCount(validation, "OfficeCLI validation")
    const issues = parseJsonResult(await run(["view", sourcePath, "issues", "--json"]), "OfficeCLI issues")
    assertZeroWorkArtifactRuntimeIssueCount(issues, "OfficeCLI issue inspection")
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
      const bytes = await readBoundedFile(renderPath, MAX_IMAGE_BYTES, `OfficeCLI rendered slide ${slide}`)
      requireOperationBudget(deadline, limits.wallClockMs, input.abort)
      renderBytes += bytes.byteLength
      if (runtimeOutputBytes + renderBytes > limits.outputBytes) {
        throw new Error(`Work Artifact operation output exceeded ${limits.outputBytes} bytes`)
      }
      await assertWorkArtifactRenderPng(bytes, `OfficeCLI rendered slide ${slide}`)
      const reference = await AttachmentStore.write(currentProjectID, bytes, "image/png", `slide-${slide}.png`)
      requireOperationBudget(deadline, limits.wallClockMs, input.abort)
      renders.push(RenderReference.parse({ slide, ...reference }))
    }
    const runtime = await dependencies.runtimeIdentity()
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    const resourceUsage = {
      input_bytes: sourceBytes.byteLength,
      runtime_output_bytes: runtimeOutputBytes,
      render_bytes: renderBytes,
      wall_clock_ms: Math.max(1, Math.ceil(performance.now() - startedAt)),
    }
    const receipt = await createValidationReceipt({
      projectID: currentProjectID,
      sourceUrl: source.url,
      sourceSha: source.sha,
      runtime,
      renders,
      resourceUsage,
    })
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
    return {
      source,
      inspection,
      validation,
      issues,
      renders,
      resourceUsage,
      receipt,
    }
  })
}

async function requireValidationReceipt(input: {
  projectID: string
  url: string
  sha: string
}): Promise<WorkArtifactValidationReceipt> {
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: input.projectID,
    url: input.url,
    mime: WORK_ARTIFACT_VALIDATION_RECEIPT_MIME,
    maxBytes: MAX_RECEIPT_BYTES,
  })
  const { reference, bytes } = snapshot
  if (reference.sha !== input.sha) throw new Error("validation receipt attachment digest mismatch")
  const payload = ValidationReceiptPayload.parse(JSON.parse(bytes.toString("utf8")))
  return { reference, payload }
}

export async function prepareWorkArtifactPresentationDeliverable(input: {
  raw: unknown
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: WorkArtifactPresentationDependencies
  deadline?: number
}): Promise<{
  parsed: z.output<typeof DeliverWorkArtifactInput>
  source: AttachmentStore.Reference
  renders: AttachmentStore.Reference[]
  receipt: WorkArtifactValidationReceipt
  priorReceiptPayload: WorkArtifactValidationReceiptPayload
}> {
  const startedAt = performance.now()
  const parsed = DeliverWorkArtifactInput.parse(input.raw)
  const limits = WorkArtifactProfileRegistry.require(parsed.profile).limits
  const deadline = input.deadline ?? startedAt + limits.wallClockMs
  const currentProjectID = projectID(input.extra)
  const receipt = await requireValidationReceipt({
    projectID: currentProjectID,
    url: parsed.validation_receipt_url,
    sha: parsed.validation_receipt_sha,
  })
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  const snapshot = await AttachmentStore.readVerifiedReference({
    projectID: currentProjectID,
    url: parsed.source_url,
    mime: PPTX_MIME,
    maxBytes: limits.inputBytes,
  })
  const { reference: source, bytes } = snapshot
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (source.url !== receipt.payload.source_url || source.sha !== receipt.payload.source_sha || digest !== receipt.payload.source_sha) {
    throw new Error("PPTX digest does not match the validation receipt candidate")
  }
  const inspection = await inspectPptxPackage(bytes, {
    abort: input.abort,
    timeoutMs: requireOperationBudget(deadline, limits.wallClockMs, input.abort),
  })
  if (inspection.slideCount !== parsed.slides.length) {
    throw new Error(
      `PPTX has ${inspection.slideCount} slides but delivery supplied ${parsed.slides.length} slide records`,
    )
  }
  const runtime = await (input.dependencies ?? defaultWorkArtifactPresentationDependencies).runtimeIdentity()
  if (
    receipt.payload.profile !== parsed.profile ||
    receipt.payload.runtime.id !== runtime.id ||
    receipt.payload.runtime.version !== runtime.version ||
    receipt.payload.runtime.lock_revision !== runtime.lockRevision ||
    receipt.payload.runtime.package_sha !== runtime.packageSha
  ) {
    throw new Error("validation receipt does not bind the current qualified Work Artifact runtime")
  }
  if (
    receipt.payload.renders.length !== parsed.slides.length ||
    receipt.payload.renders.some((render, index) => render.slide !== index + 1)
  ) {
    throw new Error("validation receipt renders do not bind the complete reviewed presentation")
  }
  const validated = await validateWorkArtifactPresentation({
    raw: { profile: "office.presentation@1", source_url: source.url },
    executionAuthority: input.executionAuthority,
    abort: input.abort,
    extra: input.extra,
    dependencies: input.dependencies,
    deadline,
  })
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
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
  requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  for (const priorRender of receipt.payload.renders) {
    const reference = await AttachmentStore.requireReference({
      projectID: currentProjectID,
      url: priorRender.url,
      mime: "image/png",
    })
    if (reference.sha !== priorRender.sha) throw new Error(`validation receipt render digest mismatch for slide ${priorRender.slide}`)
    requireOperationBudget(deadline, limits.wallClockMs, input.abort)
  }
  return { parsed, source, renders, receipt: validated.receipt, priorReceiptPayload: receipt.payload }
}
