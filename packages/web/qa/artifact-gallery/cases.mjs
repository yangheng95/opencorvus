/**
 * One real case per Interactive Artifact renderer.
 *
 * "Real" means two things here. The data is fetched or computed during the run — World Bank
 * indicators, Coinbase candles, USGS quakes, the npm registry, GitHub releases — never invented.
 * And the office deliverables are actually built: the workspace has exceljs / docx / pdfkit /
 * pptxgenjs installed, so the .xlsx, .docx, .pdf and .pptx exist as files on disk before any
 * artifact describes them.
 *
 * `attachment` names a reference prepared by the driver; the Host re-hashes those bytes on publish,
 * so a model-transcribed digest would simply be rejected.
 */

/**
 * The orchestrator's instinct on a data-heavy brief is to open a Task and delegate; one case burned
 * ten minutes on a workspace identity conflict doing exactly that and published nothing. So the
 * prohibition is explicit about Tasks, not just about sub-agents.
 */
const HOUSE_RULES =
  "Do all of this yourself, inline, in this session. Do not create a Task, do not delegate to a sub-agent " +
  "or an expert squad, and do not call the question tool — if something is ambiguous, take the most " +
  "defensible reading and say which in your closing sentence. Run the commands, then call " +
  "publish_interactive_artifact once and stop."

/** Every macro case reads the same real series, so the numbers across the gallery agree. */
const WORLD_BANK =
  "Fetch real data from the World Bank open API (no key needed), for example " +
  "`curl -s \"https://api.worldbank.org/v2/country/CHN;USA;DEU;JPN;IND/indicator/NY.GDP.PCAP.CD?format=json&per_page=400\"` " +
  "for GDP per capita in current USD. The response is [metadata, rows]; each row has country.value, date and value, " +
  "and recent years can be null — drop the nulls rather than filling them in."

export const cases = [
  // ── Office deliverables: files first, artifacts second ────────────────────────────────────────
  {
    // No renderer: this case exists to put four real office files on disk. Holding research-studio it
    // runs as a Task, and a Task's artifacts live in a sub-agent conversation the sidebar cannot
    // reach — so the terminal frame is earned by the short `terminal` case below instead.
    id: "deliverables",
    produces: ["report.pdf", "model.xlsx", "brief.docx", "deck.pptx"],
    title: "Building the FY deliverables",
    request: [
      WORLD_BANK,
      "Then write ONE script `build-deliverables.mjs` in this project and run it with `bun build-deliverables.mjs`.",
      "The project already has exceljs, docx, pdfkit and pptxgenjs installed — use them.",
      "The script must write four real files from the real series you fetched:",
      "`report.pdf` (pdfkit: a titled 2-3 page brief with a table of the latest year per country),",
      "`model.xlsx` (exceljs: one sheet of year x country values plus a CAGR column computed with a real formula),",
      "`brief.docx` (docx: headings, a paragraph of findings and a table), and",
      "`deck.pptx` (pptxgenjs: a 5-slide readout with a title slide, two data slides and a takeaways slide).",
      "Have the script log its real progress as it goes — the endpoint it called, how many rows and how many",
      "years came back, the countries it kept, and one line per file written with that file's real byte size —",
      "so the run leaves a readable build log rather than four numbers.",
      "Finish by replying with the four real file names and their real byte sizes. Publish nothing.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "terminal",
    renderer: "terminal@1",
    title: "Reading the build back",
    request: [
      "Run exactly one real command in this project — `ls -l report.pdf model.xlsx brief.docx deck.pptx && head -25 build-deliverables.mjs`",
      "— and keep its real stdout.",
      'Publish one interactive artifact with renderer "terminal@1", title "Reading the build back":',
      "`command` is that real command string, `output` is the REAL stdout verbatim including blank lines,",
      "`exitCode` the real exit code, `workingDirectory` the real absolute project path, columns 110, rows 24.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "code",
    renderer: "code@1",
    title: "build-deliverables.mjs",
    request: [
      "Read the file `build-deliverables.mjs` that already exists in this project.",
      'Publish one interactive artifact with renderer "code@1", language "javascript",',
      'filename "build-deliverables.mjs", title "build-deliverables.mjs".',
      "`source` must be that file's REAL contents, verbatim — same lines, same order, nothing paraphrased.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "file-preview",
    renderer: "file-preview@1",
    title: "GDP per capita brief (PDF)",
    attachment: "report.pdf",
    request: [
      'Publish one interactive artifact with renderer "file-preview@1", kind "pdf",',
      'title "GDP per capita brief (PDF)".',
      "Use exactly this attachment object for `source`, copied verbatim: __ATTACHMENT__.",
      "It is the real report.pdf this project built earlier from World Bank data.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "spreadsheet",
    renderer: "spreadsheet@1",
    title: "GDP per capita model (XLSX)",
    request: [
      "Read the real workbook `model.xlsx` in this project — load it with exceljs in a short throwaway script and",
      "print every cell address, value and formula so you are mirroring the real file rather than guessing.",
      'Publish one interactive artifact with renderer "spreadsheet@1", editable false,',
      'title "GDP per capita model (XLSX)", one sheet named after the real sheet, frozenRows 1.',
      "Mirror the workbook in FULL: the header row, every year row the workbook actually contains (there are",
      "decades of them — include them all, not the first two), and the CAGR row or column with its real formula",
      "and real computed value. Round the displayed values to two decimals with a numberFormat rather than",
      "carrying fifteen digits, put the sheet title in A1 only (do not repeat it across the header row), bold",
      "the header and right-align the numeric columns.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "document",
    renderer: "document@1",
    title: "GDP per capita — analyst brief (DOCX)",
    request: [
      "Read the real `brief.docx` in this project (unzip it or parse it with the docx/JSZip modules already",
      "installed) so you are reproducing its real text, not writing a new document.",
      'Publish one interactive artifact with renderer "document@1",',
      'title "GDP per capita — analyst brief (DOCX)".',
      "The markdown must mirror the real .docx: same headings, same findings, same table of real numbers.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "presentation",
    renderer: "presentation@1",
    title: "GDP per capita — five-slide readout (PPTX)",
    request: [
      "Read the real `deck.pptx` in this project (it is a zip — read ppt/slides/slide*.xml) so the artifact",
      "mirrors the real deck rather than a fresh invention.",
      'Publish one interactive artifact with renderer "presentation@1", aspectRatio "16:9",',
      'title "GDP per capita — five-slide readout (PPTX)".',
      "One slide per real slide, with the real title, the real bullet text as markdown, and speaker notes",
      "explaining the real number on that slide. Do not attach slide images — the deck's own numbers are",
      "the content worth showing.",
      HOUSE_RULES,
    ].join(" "),
  },

  // ── Statistics ────────────────────────────────────────────────────────────────────────────────
  {
    id: "chart",
    renderer: "chart@1",
    title: "GDP per capita, 2000–2024",
    request: [
      WORLD_BANK,
      'Publish one interactive artifact with renderer "chart@1", title "GDP per capita, 2000–2024".',
      "`data` is one row per country-year: {country, year (number), gdpPerCapita (number)} — real values only.",
      "`spec` is a Vega-Lite spec object with no $schema and no data property (the renderer injects the rows):",
      "a multi-series line mark, year on x as a quantitative axis, gdpPerCapita on y, color by country,",
      "axis titles in plain English and a legend.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "table",
    renderer: "table@1",
    title: "Latest GDP per capita by country",
    request: [
      "Fetch the real World Bank series for the 20 largest economies:",
      "`curl -s \"https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&date=2023&per_page=400\"`.",
      "Keep only real countries (skip aggregates such as World or income groups — their region.value is 'Aggregates').",
      'Publish one interactive artifact with renderer "table@1", title "Latest GDP per capita by country".',
      'Columns: country (string) "Country", iso3 (string) "ISO3", year (string) "Year",',
      'gdpPerCapita (number) "GDP per capita (US$)". Twenty real rows, sorted descending by value.',
      'Year is a string column on purpose — a numeric one renders the year with a thousands separator.',
      "Round gdpPerCapita to two decimals; the source carries more precision than the figure means.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "dashboard",
    renderer: "dashboard@1",
    title: "Macro indicators dashboard",
    request: [
      "Fetch three real World Bank indicators for CHN, USA, DEU, JPN and IND for 2010-2023:",
      "NY.GDP.PCAP.CD (GDP per capita), SP.DYN.LE00.IN (life expectancy) and SP.POP.TOTL (population).",
      'Publish one interactive artifact with renderer "dashboard@1", title "Macro indicators dashboard".',
      "`data` is one row per country-year with {country, year, gdpPerCapita, lifeExpectancy, population} — real values.",
      "`metrics` gives 4 real headline numbers computed from that data (say, highest GDP per capita and its country,",
      "widest life-expectancy gap, total population covered, years covered).",
      "`views` holds three Vega-Lite specs over the inline rows (no data property): GDP per capita over time (span full),",
      "life expectancy over time, and a population bar for the latest year.",
      "`filters` offers a country filter whose values all really occur in `data`.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "candlestick",
    renderer: "candlestick@1",
    title: "BTC-USD daily candles",
    request: [
      "Fetch real daily candles from the public Coinbase Exchange API:",
      "`curl -s \"https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400\"`.",
      "It answers a JSON array of arrays ordered [time, low, high, open, close, volume], newest first,",
      "with time already in Unix seconds.",
      'Publish one interactive artifact with renderer "candlestick@1", title "BTC-USD daily candles".',
      "`series` is one entry per real row re-sorted ascending by time, mapping each field to its right name —",
      "note low and high come BEFORE open and close in the response. Use the real unrounded numbers.",
      "If the request fails, say so and stop rather than inventing prices.",
      HOUSE_RULES,
    ].join(" "),
  },

  // ── Geo, graphs and time ──────────────────────────────────────────────────────────────────────
  {
    id: "map",
    renderer: "map@1",
    title: "Earthquakes, magnitude 2.5+ this week",
    request: [
      "Fetch the real USGS live feed:",
      "`curl -s \"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson\"`.",
      'Publish one interactive artifact with renderer "map@1", title "Earthquakes, magnitude 2.5+ this week".',
      "`geojson` is a FeatureCollection built from the REAL features: keep up to 250, each with its real Point",
      "geometry and `properties` narrowed to {place, mag, time} exactly as the feed reports them.",
      "Do not invent coordinates or magnitudes.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "network",
    renderer: "network@1",
    title: "express dependency graph",
    request: [
      "Resolve the REAL dependency graph of the npm package `express` from the public registry:",
      "`curl -s https://registry.npmjs.org/express/latest` gives its dependencies; follow each one with",
      "`curl -s https://registry.npmjs.org/<name>/latest` to two levels deep. Use only what the registry returns.",
      'Publish one interactive artifact with renderer "network@1", layout "cose",',
      'title "express dependency graph".',
      "One node per real package (id and label = the package name, group = its depth as \"root\"/\"direct\"/\"transitive\"),",
      "one directed edge per real dependency edge. Cap it at roughly 60 nodes and say in your closing sentence",
      "how many you kept.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "tree",
    renderer: "tree@1",
    title: "World Bank country hierarchy",
    request: [
      "Fetch the real World Bank country list: `curl -s \"https://api.worldbank.org/v2/country?format=json&per_page=400\"`.",
      "Each entry carries a real region and a real income level.",
      'Publish one interactive artifact with renderer "tree@1", title "World Bank country hierarchy",',
      "defaultExpandedDepth 2.",
      "Build region -> income level -> country from the REAL fields. Skip entries whose region.value is 'Aggregates'.",
      "Put the real capital city and ISO2 code in each country node's `metadata`, and the real child count in each",
      "region node's `metadata`. Keep the whole tree under 400 nodes by including at most 6 countries per income",
      "level, chosen alphabetically.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "timeline",
    renderer: "timeline@1",
    title: "VS Code release cadence",
    request: [
      "Fetch the REAL release history of microsoft/vscode from the public GitHub API:",
      "`curl -s -H \"Accept: application/vnd.github+json\" \"https://api.github.com/repos/microsoft/vscode/releases?per_page=40\"`.",
      "Each release has a real tag_name and a real published_at timestamp.",
      'Publish one interactive artifact with renderer "timeline@1", title "VS Code release cadence".',
      "One `point` item per real release, `start` = the real published_at in ISO 8601 with offset, content = the real tag.",
      "Group the points by real calendar year, declaring one group per year you actually use.",
      "If the API rate-limits you, say so and stop rather than inventing releases.",
      HOUSE_RULES,
    ].join(" "),
  },

  // ── Engineering surfaces ──────────────────────────────────────────────────────────────────────
  {
    id: "diagram",
    renderer: "diagram@1",
    title: "How the deliverables were built",
    request: [
      "Read `build-deliverables.mjs` in this project and follow what it really does, end to end.",
      'Publish one interactive artifact with renderer "diagram@1", title "How the deliverables were built".',
      "`source` is a Mermaid flowchart of the REAL steps in that script — the real API it calls, the real",
      "transformations, and the four real output files with their real names. 10-16 nodes.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "diff",
    renderer: "diff@1",
    title: "left-pad 1.2.0 → 1.3.0",
    request: [
      "Fetch two REAL published versions of the same file from unpkg:",
      "`curl -s https://unpkg.com/left-pad@1.2.0/index.js` and `curl -s https://unpkg.com/left-pad@1.3.0/index.js`.",
      'Publish one interactive artifact with renderer "diff@1", language "javascript",',
      'title "left-pad 1.2.0 → 1.3.0", originalLabel "left-pad@1.2.0", modifiedLabel "left-pad@1.3.0".',
      "`original` and `modified` are those two real files verbatim.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "notebook",
    renderer: "notebook@1",
    title: "Growth analysis, worked out",
    request: [
      WORLD_BANK,
      "Then actually compute, with real commands you run in this project, the compound annual growth rate of GDP",
      "per capita from 2000 to 2023 for each of the five countries.",
      'Publish one interactive artifact with renderer "notebook@1", title "Growth analysis, worked out".',
      "6-9 cells alternating markdown and code: a markdown framing, code cells holding the REAL script you ran",
      "(language \"javascript\" or \"python\"), text output cells holding the REAL stdout you got back, and a closing",
      "markdown reading. Every number in an output cell must be one you actually computed.",
      HOUSE_RULES,
    ].join(" "),
  },

  // ── Attachment-backed ─────────────────────────────────────────────────────────────────────────
  {
    id: "media",
    renderer: "media@1",
    title: "Agent teams workflow",
    attachment: "agent-teams-workflow.png",
    request: [
      'Publish one interactive artifact with renderer "media@1", kind "image", title "Agent teams workflow".',
      "Use exactly this attachment object for `source`, copied verbatim: __ATTACHMENT__.",
      "It is the real OpenCorvus agent-teams diagram. Give it a real `alt` and a one-sentence `caption` that",
      "describes what the diagram shows: a Mission fanning out to expert-squad agents that report back.",
      HOUSE_RULES,
    ].join(" "),
  },
  {
    id: "model-3d",
    renderer: "model-3d@1",
    title: "Khronos glTF sample — DamagedHelmet",
    attachment: "DamagedHelmet.glb",
    request: [
      'Publish one interactive artifact with renderer "model-3d@1",',
      'title "Khronos glTF sample — DamagedHelmet".',
      "Use exactly this attachment object for `source`, copied verbatim: __ATTACHMENT__.",
      '`alt` describes the model, `cameraOrbit` "25deg 65deg 2.6m", `exposure` 1.',
      HOUSE_RULES,
    ].join(" "),
  },
]

/** Cases that can only run once an earlier case has written its files or its attachment exists. */
export const phases = [
  ["deliverables"],
  ["terminal", "code", "chart", "table", "dashboard", "candlestick", "map", "network", "tree", "timeline", "diff", "notebook", "media", "model-3d", "diagram"],
  ["file-preview", "spreadsheet", "document", "presentation"],
]
