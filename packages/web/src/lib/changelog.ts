import { createMarkdownProcessor } from "@astrojs/markdown-remark"
import { parseChangelog } from "@opencorvus-ai/util/changelog"
import changelogMarkdown from "../../../../CHANGELOG.md?raw"

export const releaseHistory = parseChangelog(changelogMarkdown)
const processor = await createMarkdownProcessor()
export const renderedReleaseHistory = await Promise.all(releaseHistory.map(async (entry) => ({
  ...entry,
  html: (await processor.render(entry.markdown)).code,
  summary: entry.markdown.split("\n").find((line) => line.startsWith("- "))?.slice(2).replace(/`/g, "") ?? "",
})))
