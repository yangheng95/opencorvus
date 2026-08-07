import path from "node:path"
import z from "zod"

import { Tool } from "../../tool/tool"
import { materializeInlineExtractedPageAssets } from "@/browser/webpage/extract"
import { ExtractedPageSchema } from "@/browser/webpage/extracted-page"
import { resolveWebpageEvidenceOutputDir } from "./output-dir"
import { compileArchivedWebpageHtml, writeCompiledWebpageEvidence } from "@/browser/webpage/compiled-html"
import { mergeExtractedLayoutIntoCompiledWebpage } from "@/browser/webpage/compiled-layout"
import { executionFiles, taskExecutionProcessIdentity } from "@/tool/execution-files"
import type { ToolFiles } from "@opencorvus-ai/plugin"

export const WebpageCompileTool = Tool.define("webpage_compile", {
  description: `Compile captured webpage evidence into canonical structure IR + asset graph (zero LLM).

The canonical outputs are \`page.ir.json\` and \`assets/manifest.json\`. Dense CSS, SVG path data, data URIs, scripts, and long attribute/text values are preserved as content-addressed sidecar assets instead of being inlined into prompt context.

Reads \`<outputDir>/capture.html\` plus \`<outputDir>/extracted-page.json\` (from webpage_extract). Writes \`<outputDir>/page.ir.json\`, \`<outputDir>/assets/manifest.json\`, and sidecar assets. Returns compact artifact stats.

This tool is artifact-dependent: do NOT call it until \`extracted-page.json\` exists in the output directory. Never batch it with the URL extraction call that creates that file.

Use this only when the canonical structure IR or asset graph is missing. Do not rerun it once \`page.ir.json\` and \`assets/manifest.json\` exist for the current evidence package. Pure function, no network or browser.`,
  parameters: z.object({}),
  async execute(_params, ctx) {
    const processIdentity = taskExecutionProcessIdentity(ctx, "Webpage compile")
    const evidenceDirectory = await resolveWebpageEvidenceOutputDir({ sessionID: ctx.sessionID })
    const files = executionFiles(ctx)
    const outputDir = evidenceDirectory.absolutePath
    const extractedPath = path.join(outputDir, "extracted-page.json")
    const captureHtmlPath = path.join(outputDir, "capture.html")

    let extractedText: string
    try {
      extractedText = String(await files.readFile(extractedPath, "utf8"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Missing ${extractedPath}. \`webpage_compile\` depends on \`webpage_extract\` output. ` +
            `Create the URL evidence package first and retry only after \`extracted-page.json\` exists.`,
        )
      }
      throw error
    }

    if (!(await exists(captureHtmlPath, files))) {
      throw new Error(
        `Missing ${captureHtmlPath}. \`webpage_compile\` compiles canonical webpage evidence IR from ` +
          `the HTML archive produced by \`webpage_extract\`. Re-run extraction for this evidence package first.`,
      )
    }
    const archiveHtml = String(await files.readFile(captureHtmlPath, "utf8"))

    const raw = JSON.parse(extractedText)
    const page = await materializeInlineExtractedPageAssets(
      ExtractedPageSchema.parse(raw),
      outputDir,
      files,
      processIdentity,
    )
    await files.writeFile(extractedPath, JSON.stringify(page, null, 2), "utf8")

    const structure = compileArchivedWebpageHtml({
      html: archiveHtml,
      url: page.url,
      title: page.title,
    })
    structure.pageIr = mergeExtractedLayoutIntoCompiledWebpage(structure.pageIr, page)
    await writeCompiledWebpageEvidence(outputDir, structure, files)

    return {
      title: `Compiled webpage evidence — ${structure.pageIr.stats.nodes} nodes, ${structure.assetGraph.assets.length} sidecar assets`,
      output: [
        `# Compiled webpage evidence`,
        "",
        `- Source: ${extractedPath}`,
        `- HTML archive: ${captureHtmlPath}`,
        `- Canonical structure IR: ${path.join(outputDir, "page.ir.json")}`,
        `- Browser layout/style merge: ${structure.pageIr.stats.layoutMatchedElements ?? 0}/${structure.pageIr.stats.layoutElements ?? 0} elements`,
        `- Asset graph: ${path.join(outputDir, "assets", "manifest.json")}`,
        `- Project-relative evidence directory: \`${evidenceDirectory.projectRelativePath}\``,
        `- Sidecar assets: ${structure.assetGraph.assets.length}`,
        "",
        "Canonical webpage evidence structure IR and asset graph written. Treat `page.ir.json` + `assets/manifest.json` as the source of truth.",
      ].join("\n"),
      metadata: {
        pageIrPath: path.join(outputDir, "page.ir.json"),
        assetManifestPath: path.join(outputDir, "assets", "manifest.json"),
        sidecarAssetCount: structure.assetGraph.assets.length,
        nodes: structure.pageIr.stats.nodes,
        projectRelativeEvidencePath: evidenceDirectory.projectRelativePath,
      },
    }
  },
})

async function exists(filePath: string, files: ToolFiles): Promise<boolean> {
  try {
    const stat = await files.stat(filePath)
    return stat.isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}
