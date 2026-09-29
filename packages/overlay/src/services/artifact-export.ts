import { createTwoFilesPatch } from "diff"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

export type ArtifactExport = { filename: string; mime: string } & ({ text: string } | { url: string })

export function artifactFilename(name: string): string {
  return (name.split(/[\\/]/).at(-1)?.trim() || "artifact").replace(/[<>:"|?*\u0000-\u001f]/g, "_")
}

export function artifactCSV(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? "" : String(value)
          // Preserve string cells as text when opened by a spreadsheet application.
          const literal = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text
          return `"${literal.replaceAll('"', '""')}"`
        })
        .join(","),
    )
    .join("\r\n")
}

export function plainTerminalOutput(value: string): string {
  return value.replace(/\u001B(?:[@-_][0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, "")
}

export const CODE_EXTENSIONS = {
  plaintext: "txt",
  css: "css",
  html: "html",
  javascript: "js",
  json: "json",
  markdown: "md",
  python: "py",
  typescript: "ts",
} as const

/** Export actual content in a named, reusable format, never an internal envelope. */
export function artifactExports(payload: InteractiveArtifactPayload): ArtifactExport[] {
  const name = artifactFilename(payload.title)
  const text = (extension: string, content: string, mime = "text/plain"): ArtifactExport[] => [
    { filename: `${name}.${extension}`, mime, text: content },
  ]
  const json = (value: unknown, extension = "json") =>
    text(extension, JSON.stringify(value, null, 2), "application/json")
  const csv = (rows: unknown[][]) => text("csv", artifactCSV(rows), "text/csv;charset=utf-8")
  switch (payload.renderer) {
    case "document@1":
      return text("md", payload.markdown, "text/markdown")
    case "code@1":
      return [
        {
          filename: artifactFilename(payload.filename || `${name}.${CODE_EXTENSIONS[payload.language]}`),
          mime: "text/plain",
          text: payload.source,
        },
      ]
    case "diagram@1":
      return text("mmd", payload.source)
    case "diff@1":
      return text(
        "patch",
        createTwoFilesPatch(
          payload.originalLabel || "original",
          payload.modifiedLabel || "modified",
          payload.original,
          payload.modified,
        ),
        "text/x-diff",
      )
    case "terminal@1":
      return text("txt", plainTerminalOutput(payload.output))
    case "table@1":
      return csv([
        payload.columns.map((column) => column.label),
        ...payload.rows.map((row) => payload.columns.map((column) => row[column.id])),
      ])
    case "candlestick@1":
      return csv([
        ["time", "open", "high", "low", "close", "volume"],
        ...payload.series.map((point) => [point.time, point.open, point.high, point.low, point.close, point.volume]),
      ])
    case "chart@1":
      return json({ ...payload.spec, data: { values: payload.data } }, "vl.json")
    case "map@1":
      return json(payload.geojson, "geojson")
    case "media@1":
    case "file-preview@1":
    case "model-3d@1":
      return [
        {
          filename: artifactFilename(payload.source.filename || payload.source.url),
          mime: payload.source.mime,
          url: payload.source.url,
        },
      ]
    case "notebook@1":
      return [
        ...json(
          {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {},
            cells: payload.cells.map((cell, index) =>
              cell.kind === "markdown"
                ? { id: `cell-${index}`, cell_type: "markdown", metadata: {}, source: cell.markdown }
                : {
                    id: `cell-${index}`,
                    cell_type: "code",
                    metadata: { language: cell.language },
                    source: cell.source,
                    execution_count: cell.executionCount ?? null,
                    outputs: cell.outputs.map((output) => ({
                      output_type: "display_data",
                      metadata: {},
                      data:
                        output.kind === "text"
                          ? { "text/plain": output.text }
                          : output.kind === "markdown"
                            ? { "text/markdown": output.markdown }
                            : {
                                "text/markdown": `[${output.alt}](${encodeURI(artifactFilename(output.source.filename || output.source.url))})`,
                              },
                    })),
                  },
            ),
          },
          "ipynb",
        ),
        ...payload.cells.flatMap((cell) =>
          cell.kind === "code"
            ? cell.outputs.flatMap((output) =>
                output.kind === "media"
                  ? [
                      {
                        filename: artifactFilename(output.source.filename || output.source.url),
                        mime: output.source.mime,
                        url: output.source.url,
                      },
                    ]
                  : [],
              )
            : [],
        ),
      ]
    case "presentation@1":
      return [
        ...text(
          "md",
          payload.slides
            .map(
              (slide) =>
                `# ${slide.title}\n\n${slide.markdown}${slide.image ? `\n\n![${slide.imageAlt}](${encodeURI(artifactFilename(slide.image.filename || slide.image.url))})` : ""}${slide.notes ? `\n\n${slide.notes}` : ""}`,
            )
            .join("\n\n---\n\n"),
          "text/markdown",
        ),
        ...payload.slides.flatMap((slide) =>
          slide.image
            ? [
                {
                  filename: artifactFilename(slide.image.filename || slide.image.url),
                  mime: slide.image.mime,
                  url: slide.image.url,
                },
              ]
            : [],
        ),
      ]
    case "spreadsheet@1":
      return payload.sheets.map((sheet) => {
        const cells = sheet.cells.map((cell) => {
          const letters = cell.address.match(/^[A-Z]+/)![0]
          return {
            row: Number(cell.address.slice(letters.length)) - 1,
            column: [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1,
            value: cell.computed ?? cell.value ?? cell.formula,
          }
        })
        const lastRow = Math.max(-1, ...cells.map((cell) => cell.row))
        const lastColumn = Math.max(-1, ...cells.map((cell) => cell.column))
        if ((lastRow + 1) * (lastColumn + 1) > 2_000_000)
          throw new Error("CSV export exceeds 2,000,000 cells. Reduce the used sheet range before exporting.")
        const rows: unknown[][] = Array.from({ length: lastRow + 1 }, () => Array(lastColumn + 1).fill(""))
        for (const cell of cells) rows[cell.row][cell.column] = cell.value
        return {
          filename: `${name} - ${artifactFilename(sheet.name)}.csv`,
          mime: "text/csv;charset=utf-8",
          text: artifactCSV(rows),
        }
      })
    case "timeline@1":
      return csv([
        ["id", "content", "start", "end", "group"],
        ...payload.items.map((item) => [item.id, item.content, item.start, "end" in item ? item.end : "", item.group]),
      ])
    case "network@1":
      return json({ nodes: payload.nodes, edges: payload.edges })
    case "tree@1":
      return json(payload.nodes)
    case "dashboard@1":
      return json({ metrics: payload.metrics, filters: payload.filters, views: payload.views, data: payload.data })
    case "mcp-app@1": {
      const lifecycle = payload.tool.lifecycle
      if (lifecycle.status !== "completed") return []
      const resultText = lifecycle.result.content
        .filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text)
        .join("\n\n")
      return [
        ...(resultText ? text("txt", resultText) : []),
        ...(lifecycle.result.structuredContent ? json(lifecycle.result.structuredContent) : []),
      ]
    }
  }
}
