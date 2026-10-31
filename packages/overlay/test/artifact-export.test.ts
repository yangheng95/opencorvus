import { expect, test } from "bun:test"
import {
  artifactCSV,
  artifactExports,
  artifactExportFilenames,
  artifactFilename,
  plainTerminalOutput,
} from "../src/services/artifact-export"
import type { InteractiveArtifactPayload } from "../src/services/interactive-artifact"

const base = { schemaVersion: "1" as const, title: "Acceptance" }

test("Current workbook filename collections use the shared allocation", () => {
  expect(artifactExportFilenames(["Book - Data<raw.csv", "Book - Data>raw.csv", "Book - Data_raw (2).csv"])).toEqual([
    "Book - Data_raw.csv",
    "Book - Data_raw (3).csv",
    "Book - Data_raw (2).csv",
  ])
})

test("A workbook exceeding the CSV cell limit returns its explicit export error", () => {
  expect(() =>
    artifactExports({
      ...base,
      renderer: "spreadsheet@1",
      editable: true,
      sheets: [
        {
          id: "limit",
          name: "Limit",
          rowCount: 2100,
          columnCount: 1000,
          frozenRows: 0,
          frozenColumns: 0,
          cells: [
            { address: "A1", value: "First" },
            { address: "ALL2100", value: "Last" },
          ],
        },
      ],
    }),
  ).toThrow(new Error("CSV export exceeds 2,000,000 cells. Reduce the used sheet range before exporting."))
})

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

const secondMediaSource = {
  sha: "df46e50c23cb2a1650972b0125a60903ae7babc19826fc6497880261766cd88a",
  url: "/attachment/project/df46e50c23cb2a1650972b0125a60903ae7babc19826fc6497880261766cd88a.png",
  mime: "image/png",
  size: 4821,
}

test.each([
  { first: "plot.png", second: "plot.png", names: ["plot.png", "plot (2).png"] },
  { first: "plot.png", second: "Plot.PNG", names: ["plot.png", "Plot (2).PNG"] },
  { first: "p:lot.png", second: "p?lot.png", names: ["p_lot.png", "p_lot (2).png"] },
])("Notebook references use the final distinct names for $first and $second", ({ first, second, names }) => {
  const files = artifactExports({
    ...base,
    renderer: "notebook@1",
    cells: [
      {
        kind: "code",
        language: "plaintext",
        source: "original code",
        outputs: [
          { kind: "media", source: { ...mediaSource, filename: first }, alt: "Alpha" },
          { kind: "media", source: { ...secondMediaSource, filename: second }, alt: "Bravo" },
          { kind: "media", source: { ...mediaSource, filename: "alias.png" }, alt: "Repeat" },
        ],
      },
    ],
  })
  const file = files[0]!
  const notebook = JSON.parse("text" in file ? file.text : "")
  expect({
    references: notebook.cells[0].outputs.map(
      (output: { data: Record<string, string> }) => output.data["text/markdown"],
    ),
    files: files.slice(1),
  }).toEqual({
    references: [
      `[Alpha](<${encodeURIComponent(names[0]!)}>)`,
      `[Bravo](<${encodeURIComponent(names[1]!)}>)`,
      `[Repeat](<${encodeURIComponent(names[0]!)}>)`,
    ],
    files: [
      { filename: names[0], mime: mediaSource.mime, url: mediaSource.url },
      { filename: names[1], mime: secondMediaSource.mime, url: secondMediaSource.url },
    ],
  })
})

test("Presentation references match both distinct companion downloads", () => {
  expect(
    artifactExports({
      ...base,
      renderer: "presentation@1",
      aspectRatio: "16:9",
      slides: [
        {
          id: "alpha",
          title: "Alpha",
          markdown: "Original alpha",
          image: { ...mediaSource, filename: "plot.png" },
          imageAlt: "Alpha",
          notes: "Alpha notes",
        },
        {
          id: "bravo",
          title: "Bravo",
          markdown: "Original bravo",
          image: { ...secondMediaSource, filename: "plot.png" },
          imageAlt: "Bravo",
          notes: "Bravo notes",
        },
      ],
    }),
  ).toEqual([
    {
      filename: "Acceptance.md",
      mime: "text/markdown",
      text: "# Alpha\n\nOriginal alpha\n\n![Alpha](<plot.png>)\n\nAlpha notes\n\n---\n\n# Bravo\n\nOriginal bravo\n\n![Bravo](<plot%20(2).png>)\n\nBravo notes",
    },
    { filename: "plot.png", mime: mediaSource.mime, url: mediaSource.url },
    { filename: "plot (2).png", mime: secondMediaSource.mime, url: secondMediaSource.url },
  ])
})

test("Media references retain the first canonical download name for a repeated URL", () => {
  const files = artifactExports(
    {
      ...base,
      renderer: "notebook@1",
      cells: [
        {
          kind: "code",
          language: "plaintext",
          source: "original code",
          outputs: [{ kind: "media", source: { ...mediaSource, filename: "alias.png" }, alt: "Original" }],
        },
      ],
    },
    [{ filename: "original.png", mime: mediaSource.mime, url: mediaSource.url }],
  )
  const notebook = JSON.parse("text" in files[1]! ? files[1].text : "")
  expect({
    original: files[0],
    count: files.length,
    reference: notebook.cells[0].outputs[0].data["text/markdown"],
  }).toEqual({
    original: { filename: "original.png", mime: mediaSource.mime, url: mediaSource.url },
    count: 2,
    reference: "[Original](<original.png>)",
  })
})

test("Export collision suffixes preserve names already declared by the delivery", () => {
  const files = artifactExports(
    {
      ...base,
      renderer: "notebook@1",
      cells: [
        {
          kind: "code",
          language: "plaintext",
          source: "original code",
          outputs: [
            { kind: "media", source: { ...mediaSource, filename: "plot.png" }, alt: "Alpha" },
            { kind: "media", source: { ...secondMediaSource, filename: "plot.png" }, alt: "Bravo" },
          ],
        },
      ],
    },
    [{ filename: "plot (2).png", mime: "image/png", url: "/resources/declared-plot.png" }],
  )
  expect(files.map((file) => file.filename)).toEqual(["plot (2).png", "Acceptance.ipynb", "plot.png", "plot (3).png"])
})

test("Spreadsheet exports retain every sheet under distinct sanitized filenames", () => {
  const files = artifactExports({
    ...base,
    renderer: "spreadsheet@1",
    editable: false,
    sheets: ["Data:raw", "Data?raw", "Data_raw (2)"].map((name, index) => ({
      id: `sheet-${index}`,
      name,
      rowCount: 1,
      columnCount: 1,
      frozenRows: 0,
      frozenColumns: 0,
      cells: [{ address: "A1", value: index + 1 }],
    })),
  })
  expect(files).toEqual([
    { filename: "Acceptance - Data_raw.csv", mime: "text/csv;charset=utf-8", text: '"1"' },
    { filename: "Acceptance - Data_raw (3).csv", mime: "text/csv;charset=utf-8", text: '"2"' },
    { filename: "Acceptance - Data_raw (2).csv", mime: "text/csv;charset=utf-8", text: '"3"' },
  ])
})

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
