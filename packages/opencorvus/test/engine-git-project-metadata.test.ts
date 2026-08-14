import { afterAll, afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { ensureGitProjectMetadata } from "../src/engine/git"
import { Instance } from "../src/project/instance"
import { Worktree } from "../src/worktree"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const testDirectories: string[] = []

afterAll(async () => {
  await Promise.all(testDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function runGit(directory: string, args: string[]) {
  const process = Bun.spawn(["git", ...args], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || `git ${args.join(" ")} failed`)
  return { stdout, stderr }
}

function validNulFreePdf(): Buffer {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n",
  ]
  const header = "%PDF-1.4\n"
  const offsets: number[] = []
  let body = header
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "ascii"))
    body += object
  }
  const xrefOffset = Buffer.byteLength(body, "ascii")
  const xref = [
    "xref",
    "0 4",
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    "<< /Size 4 /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join("\n")
  return Buffer.from(body + xref, "ascii")
}

test("project metadata preserves a NUL-free PDF byte-for-byte through autocrlf checkout", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-project-metadata-"))
  testDirectories.push(directory)

  await runGit(directory, ["init"])
  await runGit(directory, ["config", "core.autocrlf", "true"])
  await runGit(directory, ["config", "user.email", "test@opencorvus.local"])
  await runGit(directory, ["config", "user.name", "OpenCorvus Test"])
  await fs.writeFile(path.join(directory, ".gitattributes"), "*.json text eol=lf\n")

  await ensureGitProjectMetadata(directory)

  const attributes = await fs.readFile(path.join(directory, ".gitattributes"), "utf8")
  expect(attributes.startsWith("*.json text eol=lf\n")).toBe(true)
  expect(attributes).toContain("*.pdf binary\n")
  expect(attributes).toContain("*.docx binary\n")
  expect(attributes).toContain("*.xlsx binary\n")
  expect(attributes).toContain("*.pptx binary\n")

  const expected = Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj",
      "<< /Type /Catalog >>",
      "endobj",
      "xref",
      "0 2",
      "0000000000 65535 f ",
      "0000000010 00000 n ",
      "trailer",
      "<< /Size 2 /Root 1 0 R >>",
      "startxref",
      "42",
      "%%EOF",
      "",
    ].join("\n"),
    "ascii",
  )
  const pdfPath = path.join(directory, "decision-brief.pdf")
  await fs.writeFile(pdfPath, expected)

  await runGit(directory, ["add", ".gitattributes", ".gitignore", "decision-brief.pdf"])
  await runGit(directory, ["commit", "-m", "checkpoint binary deliverable"])
  await fs.unlink(pdfPath)
  await runGit(directory, ["checkout", "--", "decision-brief.pdf"])

  expect(await fs.readFile(pdfPath)).toEqual(expected)

  const check = await runGit(directory, [
    "check-attr",
    "binary",
    "text",
    "diff",
    "merge",
    "--",
    "decision-brief.pdf",
  ])
  expect(check.stdout).toContain("decision-brief.pdf: binary: set")
  expect(check.stdout).toContain("decision-brief.pdf: text: unset")
  expect(check.stdout).toContain("decision-brief.pdf: diff: unset")
  expect(check.stdout).toContain("decision-brief.pdf: merge: unset")
})

test("managed worktree merge materializes an exact parseable PDF in the primary project", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await runGit(project.path, ["config", "core.autocrlf", "true"])
      await ensureGitProjectMetadata(project.path)
      await runGit(project.path, ["add", ".gitattributes", ".gitignore"])
      await runGit(project.path, ["commit", "-m", "freeze project metadata"])

      const worktree = await Worktree.create({ name: `binary-publication-${crypto.randomUUID().slice(0, 8)}` })
      const expected = validNulFreePdf()
      const relativePath = "deliverables/decision-brief.pdf"
      const worktreePdf = path.join(worktree.directory, relativePath)
      await fs.mkdir(path.dirname(worktreePdf), { recursive: true })
      await fs.writeFile(worktreePdf, expected)
      await runGit(worktree.directory, ["add", relativePath])
      await runGit(worktree.directory, ["commit", "-m", "publish PDF deliverable"])

      expect(await Worktree.mergeSafely({ branch: worktree.branch, worktreeDir: worktree.directory })).toMatchObject({
        status: "merged",
      })

      const materialized = await fs.readFile(path.join(project.path, relativePath))
      expect(materialized).toEqual(expected)
      const pdfjsModule = path.resolve(import.meta.dir, "../../overlay/node_modules/pdfjs-dist/legacy/build/pdf.mjs")
      const pdfjs = await import(pathToFileURL(pdfjsModule).href)
      const document = await pdfjs.getDocument({ data: new Uint8Array(materialized) }).promise
      expect(document.numPages).toBe(1)
      await document.destroy()
    },
  })
}, 120_000)
