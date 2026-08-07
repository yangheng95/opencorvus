const INTERACTIVE_ARTIFACT_RENDERER_SELECTION = [
  "`document@1` for substantial Markdown documents;",
  "`table@1` for filterable, sortable, paginated rows;",
  "`chart@1` for inline-data Vega-Lite charts;",
  "`diagram@1` for Mermaid diagrams;",
  "`code@1` or `diff@1` for source code;",
  "`candlestick@1` for Open, High, Low, Close, and Volume (OHLCV) market data;",
  "`media@1` or `file-preview@1` only for canonical project attachments;",
  "`map@1` for inline Geographic JavaScript Object Notation (GeoJSON);",
  "`notebook@1` for display-only cells and outputs;",
  "`presentation@1` for navigable slide decks;",
  "`spreadsheet@1` for multi-sheet cells and formulas;",
  "`dashboard@1` for coordinated metrics, filters, and inline-data views;",
  "`timeline@1` for dated points, ranges, and grouped schedules;",
  "`network@1` for typed node-edge graphs;",
  "`tree@1` for searchable hierarchical data;",
  "`terminal@1` for immutable ANSI terminal transcripts;",
  "and `model-3d@1` for canonical glTF or GLB model attachments.",
].join(" ")

export const PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION = [
  "Publish a message-owned interactive artifact and display it inline in this assistant message.",
  "Choose",
  INTERACTIVE_ARTIFACT_RENDERER_SELECTION,
].join(" ")

export const CHAT_INTERACTIVE_ARTIFACT_GUIDANCE_HEADING = "# Interactive artifacts"

const MCP_STRUCTURED_RESULT_ARTIFACT_GUIDANCE =
  "After a connected Model Context Protocol (MCP) tool returns structured multi-item data, prefer the appropriate native interactive artifact when filtering, comparison, or item-by-item review materially improves the response."

const MCP_APP_SINGLE_PRESENTATION_GUIDANCE =
  "Treat an automatically produced `mcp-app@1` as the sole interactive presentation for that tool result."

export const CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS = {
  chart: JSON.stringify({
    artifact: {
      schemaVersion: "1",
      renderer: "chart@1",
      title: "Issues by status",
      spec: {
        mark: "bar",
        encoding: {
          x: { field: "status", type: "nominal" },
          y: { field: "count", type: "quantitative" },
        },
      },
      data: [
        { status: "Open", count: 8 },
        { status: "Closed", count: 5 },
      ],
    },
  }),
  diagram: JSON.stringify({
    artifact: {
      schemaVersion: "1",
      renderer: "diagram@1",
      title: "Request flow",
      source: "flowchart LR\n  User --> Chat\n  Chat --> Tool",
    },
  }),
} as const

export const CHAT_INTERACTIVE_ARTIFACT_GUIDANCE = [
  CHAT_INTERACTIVE_ARTIFACT_GUIDANCE_HEADING,
  "",
  "Use `publish_interactive_artifact` when a structured or interactive presentation materially improves the answer. Keep ordinary explanations, short lists, and small code snippets as normal assistant text.",
  "",
  "Publish the artifact in the same assistant turn as the answer it supports. After the tool succeeds, briefly tell the user what the artifact contains and how to use its controls; do not duplicate the full artifact content in prose.",
  "",
  "Renderer selection:",
  INTERACTIVE_ARTIFACT_RENDERER_SELECTION,
  "",
  "Source and safety boundaries:",
  `- ${MCP_STRUCTURED_RESULT_ARTIFACT_GUIDANCE}`,
  `- ${MCP_APP_SINGLE_PRESENTATION_GUIDANCE}`,
  "- Put chart rows in `artifact.data`; a Vega-Lite `spec` must not fetch an external data URL.",
  "- Put map features directly in `artifact.geojson`; do not add remote tiles or data sources.",
  "- A notebook is a presentation of cells and existing outputs. It never executes code.",
  "- Presentation slides are ordered Markdown content, not arbitrary Hypertext Markup Language (HTML) or scripts. Speaker notes remain local to the deck.",
  "- Spreadsheet formulas are declarative cell content. Do not publish macros, scripts, external workbook links, or hidden execution.",
  "- Dashboard rows and every view specification are inline. Timeline, network, and tree data are fully embedded and must use explicit stable IDs.",
  "- A terminal artifact replays existing American National Standards Institute (ANSI) output. It never starts a shell, process, socket, or pseudoterminal.",
  "- Media, file previews, presentation images, notebook media outputs, and three-dimensional (3D) models require a canonical attachment object with its 64-character SHA-256 (Secure Hash Algorithm 256-bit) digest, `/attachment/<projectID>/<name>` URL, Multipurpose Internet Mail Extensions (MIME) type, byte size, and optional filename. Never guess an attachment reference, publish raw remote URLs, or embed base64 bytes.",
  "- A JavaScript Object Notation (JSON) glTF attachment must be version 2.0 and contain only internally embedded resources; relative or remote buffer, image, and extension resource references are rejected.",
  "- Never publish Model Context Protocol (MCP) App HTML yourself. A real MCP tool that declares `_meta.ui.resourceUri` automatically produces one server-bound App for its real input, result, cancellation, or failure lifecycle.",
  "",
  "Minimal chart example:",
  `Call \`publish_interactive_artifact\` with \`${CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS.chart}\`.`,
  "",
  "Minimal diagram example:",
  `Call \`publish_interactive_artifact\` with \`${CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS.diagram}\`.`,
].join("\n")
