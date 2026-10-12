const INTERACTIVE_ARTIFACT_RENDERER_SELECTION = [
  "`document@1`: Markdown; `table@1`: filterable/sortable/paginated rows;",
  "`chart@1`: inline-data Vega-Lite; `diagram@1`: Mermaid; `code@1`/`diff@1`: source code;",
  "`candlestick@1`: Open, High, Low, Close, Volume (OHLCV);",
  "`media@1`/`file-preview@1`: canonical project attachments only;",
  "`map@1`: inline Geographic JavaScript Object Notation (GeoJSON);",
  "`notebook@1`: display-only cells/outputs; `presentation@1`: navigable slides;",
  "`spreadsheet@1`: multi-sheet cells/formulas; `dashboard@1`: coordinated metrics/filters/inline-data views;",
  "`timeline@1`: dated points/ranges/groups; `network@1`: typed nodes/edges; `tree@1`: searchable hierarchy;",
  "`terminal@1`: immutable ANSI transcripts; `model-3d@1`: canonical glTF/GLB attachments.",
].join(" ")

export const PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION = [
  "Publish an interactive artifact owned by and displayed inline in this assistant message.",
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
      title: "Issues by status",
      content: {
        renderer: "chart@1",
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
    },
  }),
  diagram: JSON.stringify({
    artifact: {
      schemaVersion: "1",
      title: "Request flow",
      content: {
        renderer: "diagram@1",
        source: "flowchart LR\n  User --> Chat\n  Chat --> Tool",
      },
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
  "- Put renderer-specific fields under `artifact.content`. Put chart rows in `artifact.content.data`; a Vega-Lite `spec` must not fetch an external data URL.",
  "- Put map features directly in `artifact.content.geojson`; do not add remote tiles or data sources.",
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
