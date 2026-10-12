import { createMarkdownProcessor } from "@astrojs/markdown-remark"
import { CHANGELOG_LOCALES, parseChangelog, standaloneReleaseNotes } from "@opencorvus-ai/util/changelog"
import changelogMarkdown from "../../../../CHANGELOG.md?raw"

export const releaseHistory = parseChangelog(changelogMarkdown)
const processor = await createMarkdownProcessor()
export const renderedReleaseHistory = await Promise.all(
  releaseHistory.map(async (entry) => ({
    ...entry,
    localized: Object.fromEntries(await Promise.all(CHANGELOG_LOCALES.map(async (locale) => [locale, {
      html: (await processor.render(standaloneReleaseNotes(entry, locale))).code,
      summaryHtml: (await processor.render(entry.notes[locale]
          .split("\n")
          .find((line) => line.startsWith("- "))
          ?.slice(2) ?? "")).code,
    }] as const))),
  })),
)
