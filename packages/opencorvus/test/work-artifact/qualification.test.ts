import { afterAll, expect, test } from "bun:test"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import sharp from "sharp"
import { TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { Session } from "../../src/session"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { secureWorkArtifactPrivateDirectory, type WorkArtifactPresentationDependencies } from "../../src/work-artifact/presentation"
import { inspectPptxPackage } from "../../src/work-artifact/presentation"
import {
  WorkArtifactTargetPackageManifestSchema,
  verifyWorkArtifactTargetPackageManifest,
  writeWorkArtifactTargetPackageManifest,
} from "../../src/work-artifact/runtime/package-manifest"
import { WORK_ARTIFACT_RUNTIME_LOCK } from "../../script/work-artifact-runtime-lock"
import { acquirePinnedRuntimeDownload } from "../../script/build-runtime-binaries"
import { assertNativeArchiveClosure, assertNativeArchiveEntry } from "../../../../script/package-native-binary"
import { Process } from "../../src/util/process"
import { requireWorkArtifactValidationAuthority } from "../../src/work-artifact/validation-authority"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { createWorkArtifactTools } from "../../src/tool/work-artifact"
import { Tool } from "../../src/tool/tool"

afterAll(async () => {
  await resetMemoryDatabase()
})

const execFileAsync = promisify(execFile)

async function minimalPresentationBytes(): Promise<Buffer> {
  const output = new Uint8ArrayWriter()
  const zip = new ZipWriter(output)
  await zip.add("[Content_Types].xml", new TextReader("<Types/>"))
  await zip.add("_rels/.rels", new TextReader("<Relationships/>"))
  await zip.add("ppt/presentation.xml", new TextReader('<p:presentation xmlns:p="urn:p"/>'))
  await zip.add("ppt/slides/slide1.xml", new TextReader('<p:sld xmlns:p="urn:p"/>'))
  await zip.close()
  return Buffer.from(output.getData())
}

async function presentationWithPart(name: string, payload: string): Promise<Buffer> {
  const output = new Uint8ArrayWriter()
  const zip = new ZipWriter(output)
  await zip.add("[Content_Types].xml", new TextReader("<Types/>"))
  await zip.add("_rels/.rels", new TextReader("<Relationships/>"))
  await zip.add("ppt/presentation.xml", new TextReader('<p:presentation xmlns:p="urn:p"/>'))
  await zip.add("ppt/slides/slide1.xml", new TextReader('<p:sld xmlns:p="urn:p"/>'))
  await zip.add(name, new TextReader(payload))
  await zip.close()
  return Buffer.from(output.getData())
}

test("canonical validation receipt authorizes a fresh delivery revalidation", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Work Artifact qualification" })
      const authority = {
        kind: "conversation" as const,
        sessionID: session.id,
        projectID: Instance.project.id,
        directory: project.path,
      }
      const operations: string[] = []
      const operationBudgets: Array<{ timeoutMs?: number; maxOutputBytes?: number }> = []
      const renderSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#fff"/><text x="80" y="140">Qualified</text></svg>',
      )
      const dependencies: WorkArtifactPresentationDependencies = {
        async officeCliPath() {
          return process.execPath
        },
        async runtimeIdentity() {
          return {
            id: "officecli",
            label: "OfficeCLI qualification fixture",
            version: "1.0.143",
            lockRevision: "a".repeat(64),
            packageSha: "b".repeat(64),
          }
        },
        async runOfficeCli(input) {
          operations.push([input.args[0], path.basename(input.args[1]!), input.args[2]].join(" "))
          operationBudgets.push({ timeoutMs: input.timeoutMs, maxOutputBytes: input.maxOutputBytes })
          if (input.args[0] === "create") {
            await fs.writeFile(input.args[1]!, await minimalPresentationBytes(), { mode: 0o600 })
          }
          if (input.args[0] === "view" && input.args[2] === "svg") {
            return { code: 0, stdout: renderSvg, stderr: Buffer.alloc(0) }
          }
          return {
            code: 0,
            stdout: Buffer.from(JSON.stringify({ success: true, data: { count: 0 } })),
            stderr: Buffer.alloc(0),
          }
        },
      }
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        parentID: "msg_work_artifact_qualification_user",
        role: "assistant",
        author: "orchestrator",
        time: { created: Date.now(), completed: Date.now() },
        agent: "orchestrator",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        finish: "tool-calls",
      })
      const tools = createWorkArtifactTools(dependencies)
      const context: Tool.Context = {
        sessionID: session.id,
        messageID: assistant.id,
        callID: "call_work_artifact_qualification",
        agent: "orchestrator",
        abort: new AbortController().signal,
        messages: [],
        executionAuthority: authority,
        executionSurface: Tool.executionSurface(Object.values(tools).map((tool) => tool.id), []),
        extra: { projectID: Instance.project.id },
        metadata() {},
      }
      const authored = await tools.author.init().then((tool) =>
        tool.execute(
          {
            profile: "office.presentation@1",
            filename: "qualification.pptx",
            locale: "en-US",
            aspect_ratio: "16:9",
            slides: [{ title: "Qualified", background: "#FFFFFF", elements: [] }],
          },
          context,
        ),
      )
      const source = JSON.parse(authored.output).source as { url: string; sha: string }
      const inspected = await tools.inspect.init().then((tool) =>
        tool.execute({ profile: "office.presentation@1", source_url: source.url }, context),
      )
      const validation = await tools.validate.init().then((tool) =>
        tool.execute({ profile: "office.presentation@1", source_url: source.url }, context),
      )
      const validated = JSON.parse(validation.output) as {
        validation_receipt: { url: string; sha: string }
        validation_receipt_payload: Record<string, unknown>
        renders: Array<{ url: string; sha: string }>
      }
      const validatedRender = await AttachmentStore.read(
        Instance.project.id,
        AttachmentStore.nameFromUrl(validated.renders[0]!.url)!.name,
      )
      const validatedRenderMetadata = await sharp(validatedRender).metadata()
      const receiptBytes = await AttachmentStore.read(
        Instance.project.id,
        AttachmentStore.nameFromUrl(validated.validation_receipt.url)!.name,
      )
      expect(JSON.parse(receiptBytes.toString("utf8"))).toEqual(validated.validation_receipt_payload)
      const validationTime = Date.now()
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: assistant.id,
        type: "tool",
        callID: "call_work_artifact_validate_qualification",
        tool: "work_artifact_validate",
        state: {
          status: "completed",
          input: { profile: "office.presentation@1", source_url: source.url },
          output: validation.output,
          title: "Validated qualification.pptx",
          metadata: { truncated: false },
          time: { start: validationTime, end: validationTime + 1 },
        },
      })
      expect(
        requireWorkArtifactValidationAuthority({
          sessionID: session.id,
          receiptUrl: validated.validation_receipt.url,
          receiptSha: validated.validation_receipt.sha,
        }),
      ).toEqual(validated.validation_receipt_payload)

      const delivered = await tools.deliver.init().then((tool) =>
        tool.execute({
          profile: "office.presentation@1",
          title: "Qualified presentation",
          source_url: source.url,
          validation_receipt_url: validated.validation_receipt.url,
          validation_receipt_sha: validated.validation_receipt.sha,
          slides: [{ slide: 1, title: "Qualified", markdown: "Freshly revalidated." }],
        }, context),
      )
      const deliveredOutput = JSON.parse(delivered.output)
      expect({
        authoredSourceSha: source.sha,
        inspectedSourceSha: JSON.parse(inspected.output).source.sha,
        deliveredSourceSha: deliveredOutput.source.sha,
        renderCount: deliveredOutput.renders.length,
        attachmentCount: delivered.attachments?.length,
        interactiveArtifact: delivered.display?.[0]?.type,
        validatedRenderSize: [validatedRenderMetadata.width, validatedRenderMetadata.height],
        boundedOperations: operationBudgets.every(
          (budget) =>
            typeof budget.timeoutMs === "number" &&
            budget.timeoutMs > 0 &&
            budget.timeoutMs <= 120_000 &&
            typeof budget.maxOutputBytes === "number" &&
            budget.maxOutputBytes > 0 &&
            budget.maxOutputBytes <= 80 * 1024 * 1024,
        ),
        operations,
      }).toEqual({
        authoredSourceSha: source.sha,
        inspectedSourceSha: source.sha,
        deliveredSourceSha: source.sha,
        renderCount: 1,
        attachmentCount: 3,
        interactiveArtifact: "interactive-artifact",
        validatedRenderSize: [1280, 720],
        boundedOperations: true,
        operations: [
          "create qualification.pptx --type",
          "batch qualification.pptx --input",
          "validate qualification.pptx --json",
          "view qualification.pptx issues",
          "view qualification.pptx svg",
          "validate qualification.pptx --json",
          "view qualification.pptx issues",
          "view qualification.pptx svg",
        ],
      })
    },
  })
}, 60_000)

test("PPTX parser supervision maps its wall-clock budget to a bounded error", async () => {
  await expect(inspectPptxPackage(await minimalPresentationBytes(), { timeoutMs: 1 })).rejects.toThrow(
    "Work Artifact PPTX inspection exceeded 1ms",
  )
})

test("PPTX inspection accepts the pinned OfficeCLI chart part closure", async () => {
  const inspection = await inspectPptxPackage(
    await presentationWithPart(
      "ppt/slides/charts/chart1.xml",
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>',
    ),
  )
  expect(inspection).toEqual({ slideCount: 1, entryCount: 5, uncompressedBytes: expect.any(Number) })
})

test("PPTX inspection maps corrupt, macro, and external relationship inputs to explicit errors", async () => {
  await expect(inspectPptxPackage(Buffer.from("not-a-zip"))).rejects.toThrow()
  await expect(inspectPptxPackage(await presentationWithPart("ppt/vbaProject.bin", "macro"))).rejects.toThrow(
    "unsupported create-only OOXML part: ppt/vbaProject.bin",
  )
  await expect(
    inspectPptxPackage(
      await presentationWithPart(
        "ppt/slides/_rels/slide1.xml.rels",
        '<Relationship TargetMode="External" Target="https://example.invalid"/>',
      ),
    ),
  ).rejects.toThrow("PPTX contains an external package relationship")
})

test("PPTX inspection bounds actual highly-compressed output instead of trusting directory sizes", async () => {
  const output = new Uint8ArrayWriter()
  const zip = new ZipWriter(output)
  await zip.add("[Content_Types].xml", new TextReader("<Types/>"))
  await zip.add("_rels/.rels", new TextReader("<Relationships/>"))
  await zip.add("ppt/presentation.xml", new TextReader('<p:presentation xmlns:p="urn:p"/>'))
  await zip.add("ppt/slides/slide1.xml", new TextReader(" ".repeat(8 * 1024 * 1024 + 1)))
  await zip.close()
  const forged = Buffer.from(output.getData())
  for (let offset = 0; offset + 46 <= forged.length; offset++) {
    if (forged.readUInt32LE(offset) !== 0x02014b50) continue
    const nameLength = forged.readUInt16LE(offset + 28)
    const extraLength = forged.readUInt16LE(offset + 30)
    const commentLength = forged.readUInt16LE(offset + 32)
    const name = forged.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")
    if (name === "ppt/slides/slide1.xml") {
      forged.writeUInt32LE(1, offset + 24)
      const localOffset = forged.readUInt32LE(offset + 42)
      if (forged.readUInt32LE(localOffset) === 0x04034b50) forged.writeUInt32LE(1, localOffset + 22)
    }
    offset += 45 + nameLength + extraLength + commentLength
  }
  await expect(inspectPptxPackage(forged)).rejects.toThrow(
    "PPTX/ppt/slides/slide1.xml exceeds 8388608 actual bytes",
  )
}, 30_000)

test("PPTX inspection recursively rejects executable content in a chart workbook", async () => {
  const workbookOutput = new Uint8ArrayWriter()
  const workbook = new ZipWriter(workbookOutput)
  await workbook.add("[Content_Types].xml", new TextReader("<Types/>"))
  await workbook.add("_rels/.rels", new TextReader("<Relationships/>"))
  await workbook.add("xl/workbook.xml", new TextReader("<workbook/>"))
  await workbook.add("xl/vbaProject.bin", new TextReader("macro"))
  await workbook.close()
  const output = new Uint8ArrayWriter()
  const zip = new ZipWriter(output)
  await zip.add("[Content_Types].xml", new TextReader("<Types/>"))
  await zip.add("_rels/.rels", new TextReader("<Relationships/>"))
  await zip.add("ppt/presentation.xml", new TextReader('<p:presentation xmlns:p="urn:p"/>'))
  await zip.add("ppt/slides/slide1.xml", new TextReader('<p:sld xmlns:p="urn:p"/>'))
  await zip.add("ppt/embeddings/workbook1.xlsx", new Uint8ArrayReader(workbookOutput.getData()))
  await zip.close()
  await expect(inspectPptxPackage(Buffer.from(output.getData()))).rejects.toThrow(
    "embedded workbook contains an unsupported create-only OOXML part: xl/vbaProject.bin",
  )
}, 45_000)

test("pinned runtime download bounds a chunked body before buffering the overrun", async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "work-artifact-download-"))
  try {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.enqueue(new Uint8Array([4, 5, 6]))
        controller.close()
      },
    }))
    await expect(acquirePinnedRuntimeDownload({
      cacheDir, filename: "bounded.bin", maxBytes: 4, sha256: "0".repeat(64),
      url: "https://example.invalid/bounded.bin", fetcher: async () => response,
    })).rejects.toThrow("bounded.bin contains more than 4 bytes")
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true })
  }
})

test("canonical attachment reads reject same-size digest tampering before Work Artifact parsing", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("AAAA"), "image/png", "integrity.png")
      const located = AttachmentStore.nameFromUrl(reference.url)!
      const absolute = AttachmentStore.resolveAbsolute(located.projectID, located.name)!
      await fs.writeFile(absolute, Buffer.from("BBBB"))
      await expect(AttachmentStore.requireReference({
        projectID: Instance.project.id,
        url: reference.url,
        mime: "image/png",
      })).rejects.toThrow("attachment blob digest does not match canonical metadata")
    },
  })
})

test("canonical attachment reads reject metadata-sized over-limit input before allocating its body", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const reference = await AttachmentStore.write(Instance.project.id, Buffer.from("12345"), "image/png", "bounded.png")
      await expect(AttachmentStore.readVerifiedReference({
        projectID: Instance.project.id,
        url: reference.url,
        mime: "image/png",
        maxBytes: 4,
      })).rejects.toThrow("attachment blob exceeds 4 bytes")
    },
  })
})

test("target package manifest binds binary architecture, digests, and deterministic file kinds", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-artifact-package-"))
  try {
    const executable = path.join(root, "bin", "officecli.exe")
    const dataFiles = WORK_ARTIFACT_RUNTIME_LOCK.runtimes[0].source.data_assets.map((asset) => ({
      asset,
      filename: path.join(root, ...asset.package_path.split("/")),
    }))
    const lock = path.join(root, "licenses", "WORK-ARTIFACT-RUNTIMES-LOCK.json")
    await fs.mkdir(path.dirname(executable), { recursive: true })
    await fs.mkdir(path.dirname(dataFiles[0]!.filename), { recursive: true })
    const pe = Buffer.alloc(512)
    pe.write("MZ", 0, "ascii")
    pe.writeUInt32LE(0x80, 0x3c)
    pe.write("PE\0\0", 0x80, "ascii")
    pe.writeUInt16LE(0x8664, 0x84)
    await fs.writeFile(executable, pe)
    await Promise.all(dataFiles.map(({ asset, filename }) => fs.writeFile(filename, asset.source_file)))
    await fs.writeFile(lock, `${JSON.stringify(WORK_ARTIFACT_RUNTIME_LOCK, undefined, 2)}\n`)
    const manifest = await writeWorkArtifactTargetPackageManifest({
      root,
      target: { os: "win32", arch: "x64" },
      lock: WORK_ARTIFACT_RUNTIME_LOCK,
    })
    await expect(
      verifyWorkArtifactTargetPackageManifest({
        root,
        target: { os: "win32", arch: "x64" },
        lock: WORK_ARTIFACT_RUNTIME_LOCK,
      }),
    ).resolves.toEqual(manifest)
    expect(manifest.files.map((file) => ({ path: file.path, kind: file.kind, mode: file.mode, target: file.binary_target }))).toEqual([
      { path: "bin/officecli.exe", kind: "executable", mode: null, target: { os: "win32", arch: "x64" } },
      { path: "licenses/OfficeCLI-LICENSE", kind: "data", mode: null, target: undefined },
      { path: "licenses/OfficeCLI-NOTICE", kind: "data", mode: null, target: undefined },
      { path: "licenses/OfficeCLI-THIRD-PARTY-NOTICES.txt", kind: "data", mode: null, target: undefined },
      { path: "licenses/WORK-ARTIFACT-RUNTIMES-LOCK.json", kind: "data", mode: null, target: undefined },
    ])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("container package smoke checks the unified Work Artifact lock and complete OfficeCLI notices", async () => {
  const dockerfile = await fs.readFile(path.resolve(import.meta.dir, "../../Dockerfile"), "utf8")
  for (const filename of [
    "WORK-ARTIFACT-RUNTIMES-LOCK.json",
    "OfficeCLI-LICENSE",
    "OfficeCLI-NOTICE",
    "OfficeCLI-THIRD-PARTY-NOTICES.txt",
  ]) expect(dockerfile).toContain(`test -f /opt/opencorvus/licenses/${filename}`)
})

test("POSIX manifest and archive contracts preserve executable 0755 and data 0644", () => {
  const manifest = WorkArtifactTargetPackageManifestSchema.parse({
    schema_version: 1,
    phase: "final",
    target: { os: "linux", arch: "x64" },
    runtime_lock_revision: "a".repeat(64),
    files: [
      { path: "bin/officecli", kind: "executable", sha256: "b".repeat(64), size: 1, mode: "0755", binary_target: { os: "linux", arch: "x64" }, signature: { status: "not_applicable", identity: null } },
      { path: "licenses/OfficeCLI-LICENSE", kind: "data", sha256: "c".repeat(64), size: 1, mode: "0644" },
    ],
  })
  expect(manifest.files.map((file) => file.mode)).toEqual(["0755", "0644"])
  const listing = [
    "-rwxr-xr-x user/group 1 2026-08-12 00:00 ./bin/officecli",
    "-rw-r--r-- user/group 1 2026-08-12 00:00 ./licenses/OfficeCLI-LICENSE",
    "-rw-r--r-- user/group 1 2026-08-12 00:00 ./work-artifact-target-package-manifest.json",
  ].join("\n")
  assertNativeArchiveEntry({ archive: "fixture.tar.gz", listing, path: "bin/officecli", kind: "executable", platform: "linux" })
  assertNativeArchiveEntry({ archive: "fixture.tar.gz", listing, path: "licenses/OfficeCLI-LICENSE", kind: "data", platform: "linux" })
  assertNativeArchiveEntry({ archive: "fixture.tar.gz", listing, path: "work-artifact-target-package-manifest.json", kind: "data", platform: "linux" })
  assertNativeArchiveClosure({
    archive: "fixture.tar.gz",
    listing: `drwxr-xr-x user/group 0 2026-08-12 00:00 ./\n${listing}`,
    platform: "linux",
  })
})

test("Windows archive path validation maps reserved and normalized-collision names to explicit errors", () => {
  expect(() =>
    assertNativeArchiveClosure({
      archive: "windows-fixture.tar.gz",
      listing: "-rw-r--r-- user/group 1 2026-08-12 00:00 ./safe/NUL.txt",
      platform: "win32",
    }),
  ).toThrow("unsafe Windows entry path: safe/NUL.txt")
  expect(() =>
    assertNativeArchiveClosure({
      archive: "windows-fixture.tar.gz",
      listing: [
        "-rw-r--r-- user/group 1 2026-08-12 00:00 ./Résumé.txt",
        "-rw-r--r-- user/group 1 2026-08-12 00:00 ./Résumé.txt",
      ].join("\n"),
      platform: "win32",
    }),
  ).toThrow("normalized path collision")
})

test.skipIf(process.platform !== "win32")(
  "Windows Work Artifact directory grants a non-inherited private ACL to the current user",
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-artifact-acl-"))
    try {
      await secureWorkArtifactPrivateDirectory(root)
      const { stdout } = await execFileAsync("icacls.exe", [root], { windowsHide: true })
      expect({ privateGrant: stdout.includes("(OI)(CI)(F)"), inheritedGrant: stdout.includes("(I)") }).toEqual({
        privateGrant: true,
        inheritedGrant: false,
      })
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  },
)

test("process runner enforces wall-clock and combined output limits independently of activity", async () => {
  await expect(
    Process.runHost([process.execPath, "-e", "setInterval(() => process.stdout.write('.'), 5)"], {
      timeoutMs: 75,
      maxOutputBytes: 1024,
    }),
  ).rejects.toThrow("Process timed out after 75ms")
  await expect(
    Process.runHost([process.execPath, "-e", "process.stdout.write('x'.repeat(4096))"], {
      timeoutMs: 10_000,
      maxOutputBytes: 1024,
    }),
  ).rejects.toThrow("Process output exceeded 1024 bytes")
})
