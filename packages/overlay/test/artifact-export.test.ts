import { expect, test } from "bun:test"
import { artifactCSV, artifactExports, artifactFilename, plainTerminalOutput } from "../src/services/artifact-export"
import type { InteractiveArtifactPayload } from "../src/services/interactive-artifact"

const base = { schemaVersion: "1" as const, title: "Acceptance" }

const mediaSource = {
  sha: "ad8d51e8c73773e89c4cfd92de5ac53ea04604410d4a2bae3173c9ede7a87d25",
  url: "/attachment/project/ad8d51e8c73773e89c4cfd92de5ac53ea04604410d4a2bae3173c9ede7a87d25.png",
  mime: "image/png",
  size: 10627,
}
const mediaReferences = [
  {
    filename: "图 #1 (& plan+.png",
    alt: "图 ] #1 &copy; *原文*",
    reference: "[图 \\] \\#1 \\&copy\\; \\*原文\\*](<%E5%9B%BE%20%231%20(%26%20plan%2B.png>)",
  },
  { filename: "photo #1.png", alt: "Photo", reference: "[Photo](<photo%20%231.png>)" },
  { filename: "literal%23.png", alt: "Original [23]", reference: "[Original \\[23\\]](<literal%2523.png>)" },
  { filename: "view(1).png", alt: "View", reference: "[View](<view(1).png>)" },
  { filename: "plain.png", alt: "line1\n\nline2", reference: "[line1&#10;&#10;line2](<plain.png>)" },
]

test.each(mediaReferences)(
  "Notebook media export preserves $filename and its plain label",
  ({ filename, alt, reference }) => {
    const files = artifactExports({
      ...base,
      renderer: "notebook@1",
      cells: [
        {
          kind: "code",
          language: "plaintext",
          source: "display only",
          outputs: [{ kind: "media", source: { ...mediaSource, filename }, alt }],
        },
      ],
    })
    const file = files[0]!
    const notebook = JSON.parse("text" in file ? file.text : "")
    expect({ media: notebook.cells[0].outputs, downloads: files.slice(1) }).toEqual({
      media: [{ output_type: "display_data", metadata: {}, data: { "text/markdown": reference } }],
      downloads: [{ filename, mime: mediaSource.mime, url: mediaSource.url }],
    })
  },
)

test.each(mediaReferences)(
  "Presentation media export preserves $filename and its plain label",
  ({ filename, alt, reference }) => {
    expect(
      artifactExports({
        ...base,
        renderer: "presentation@1",
        aspectRatio: "16:9",
        slides: [
          {
            id: "slide1",
            title: "Slide",
            markdown: "Authored body",
            notes: "Original notes",
            image: { ...mediaSource, filename },
            imageAlt: alt,
          },
        ],
      }),
    ).toEqual([
      {
        filename: "Acceptance.md",
        mime: "text/markdown",
        text: `# Slide\n\nAuthored body\n\n!${reference}\n\nOriginal notes`,
      },
      { filename, mime: mediaSource.mime, url: mediaSource.url },
    ])
  },
)
test("documents and edited code export their actual text and useful filenames", () => {
  expect(artifactExports({ ...base, renderer: "document@1", markdown: "# Delivery\n\nReady" })).toEqual([
    { filename: "Acceptance.md", mime: "text/markdown", text: "# Delivery\n\nReady" },
  ])
  expect(
    artifactExports({
      ...base,
      renderer: "code@1",
      language: "python",
      filename: "demo.py",
      source: "print(42)",
      editable: true,
    }),
  ).toEqual([{ filename: "demo.py", mime: "text/plain", text: "print(42)" }])
  expect(artifactFilename("folder/ready:report.txt")).toBe("ready_report.txt")
})

test("CSV preserves multiline cells, quotes, numbers and literal formula-like text", () => {
  expect(artifactCSV([["a,b", 'say "hello"', "line1\nline2", -2, "=SUM(A1)", null]])).toBe(
    '"a,b","say ""hello""","line1\nline2","-2","\'=SUM(A1)",""',
  )
  const output = artifactExports({
    ...base,
    renderer: "table@1",
    columns: [{ id: "n", label: "Name", dataType: "string" }],
    rows: [{ n: "One" }],
  })[0]
  expect(output).toEqual({ filename: "Acceptance.csv", mime: "text/csv;charset=utf-8", text: '"Name"\r\n"One"' })
})

test("attachment exports retain their canonical bytes locator and name", () => {
  const source = {
    filename: "report.pdf",
    mime: "application/pdf",
    url: "/attachment/project/report.pdf",
    sha: "a".repeat(64),
    size: 400,
  }
  expect(artifactExports({ ...base, renderer: "file-preview@1", kind: "pdf", source })).toEqual([
    { filename: "report.pdf", mime: "application/pdf", url: source.url },
  ])
})

test("notebooks export a standard notebook with actual cells and outputs", () => {
  const [file] = artifactExports({
    ...base,
    renderer: "notebook@1",
    cells: [
      {
        kind: "code",
        language: "python",
        source: "print(2)",
        executionCount: 1,
        outputs: [{ kind: "text", text: "2\n" }],
      },
    ],
  })
  const notebook = JSON.parse("text" in file ? file.text : "")
  expect(file.filename).toBe("Acceptance.ipynb")
  expect(notebook).toEqual({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        id: "cell-0",
        cell_type: "code",
        metadata: { language: "python" },
        source: "print(2)",
        execution_count: 1,
        outputs: [{ output_type: "display_data", metadata: {}, data: { "text/plain": "2\n" } }],
      },
    ],
  })
})

test("MCP exports actual completed result text and data", () => {
  const payload = {
    ...base,
    renderer: "mcp-app@1",
    tool: {
      lifecycle: {
        status: "completed",
        input: {},
        result: { content: [{ type: "text", text: "Ready\nTwo files" }], structuredContent: { count: 2 } },
      },
    },
  } as InteractiveArtifactPayload
  expect(artifactExports(payload)).toEqual([
    { filename: "Acceptance.txt", mime: "text/plain", text: "Ready\nTwo files" },
    { filename: "Acceptance.json", mime: "application/json", text: '{\n  "count": 2\n}' },
  ])
  expect(plainTerminalOutput("\u001b[32mready\u001b[0m\n")).toBe("ready\n")
})
