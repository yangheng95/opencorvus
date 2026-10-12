import { For, Show, createMemo, createSignal } from "solid-js"
import { parseChangelog, requireReleaseNotes, standaloneReleaseNotes, type ChangelogEntry } from "@opencorvus-ai/util/changelog"
import changelog from "../../../../../CHANGELOG.md?raw"
import { appStore } from "../../store/app"
import { t, tc } from "../../utils/i18n"
import { inlineMarkdown, renderMarkdown } from "../../utils/markdown"
import { PROJECT_URL, PROJECT_WEBSITE_URL } from "../../utils/project-links"
import { OVERLAY_VERSION } from "../../utils/version"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { LinkButton } from "../ui/LinkButton"
import { SearchField } from "../ui/SearchField"
import { SettingsEmpty, SettingsPanel, SettingsRow, SettingsSurface } from "./layout"

const history = parseChangelog(changelog)
const installed = requireReleaseNotes(history, OVERLAY_VERSION)

export default function ReleaseNotesPanel() {
  const locale = () => appStore.locale as keyof ChangelogEntry["notes"]
  const markdown = (entry: ChangelogEntry) => standaloneReleaseNotes(entry, locale())
  const date = (entry: ChangelogEntry) => new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.date}T00:00:00Z`))
  const [selected, setSelected] = createSignal<ChangelogEntry | null>(installed)
  const [query, setQuery] = createSignal("")
  const filteredHistory = createMemo(() => {
    const term = query().trim().toLowerCase()
    return history.filter((entry) =>
      `${entry.displayVersion} ${entry.version} ${markdown(entry)}`.toLowerCase().includes(term),
    )
  })
  let panel: HTMLDivElement | undefined
  const select = (entry: ChangelogEntry | null) => {
    setSelected(entry)
    panel?.closest(".config-content")?.scrollTo({ top: 0 })
  }
  const summary = (entry: ChangelogEntry) =>
    markdown(entry)
      .split("\n")
      .find((line) => line.startsWith("- "))
      ?.slice(2) ?? ""

  return (
    <SettingsPanel class="release-notes-panel" ref={panel}>
      <p class="release-notes-intro">{t("releases.description")}</p>
      <Show
        when={selected()}
        fallback={
          <>
            <div class="release-notes-toolbar">
              <SearchField
                value={query()}
                placeholder={t("releases.search")}
                onValueChange={setQuery}
                onClear={() => setQuery("")}
                size="md"
              />
              <Button variant="outline" size="sm" tone="neutral" onClick={() => select(installed)}>
                {t("releases.installed")} · v{installed.displayVersion}
              </Button>
            </div>
            <span class="release-notes-count">{tc("releases.count", filteredHistory().length)}</span>
            <SettingsSurface>
              <For each={filteredHistory()} fallback={<SettingsEmpty>{t("releases.empty")}</SettingsEmpty>}>
                {(entry) => (
                  <SettingsRow
                    as="button"
                    interactive
                    class="release-notes-row"
                    title={
                      <span class="release-notes-version">
                        v{entry.displayVersion}
                        <Show when={entry.version === installed.version}>
                          <Badge size="sm">{t("releases.installed")}</Badge>
                        </Show>
                      </span>
                    }
                    desc={
                      <span
                        class="release-notes-preview"
                        lang={locale()}
                        innerHTML={inlineMarkdown(summary(entry)).replace(/<\/?a(?:\s[^>]*)?>/g, "")}
                      />
                    }
                    meta={<time dateTime={entry.date}>{date(entry)}</time>}
                    onClick={() => select(entry)}
                  />
                )}
              </For>
            </SettingsSurface>
          </>
        }
      >
        {(entry) => (
          <>
            <div class="release-notes-toolbar">
              <Button variant="ghost" size="sm" tone="neutral" onClick={() => select(null)}>
                <Icon name="nav-back" size="compact" />
                {t("releases.history")}
              </Button>
              <LinkButton
                variant="outline"
                size="sm"
                tone="neutral"
                href={`${PROJECT_WEBSITE_URL}${locale() === "zh-CN" ? "/zh-cn" : ""}/changelog/${entry().version}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="web-search" size="compact" />
                {t("releases.website")}
              </LinkButton>
            </div>
            <article class="release-notes-detail" lang={locale()}>
              <header class="release-notes-heading">
                <div class="release-notes-version">
                  <h2>v{entry().displayVersion}</h2>
                  <Show when={entry().version === installed.version}>
                    <Badge size="sm">{t("releases.installed")}</Badge>
                  </Show>
                </div>
                <time dateTime={entry().date}>{date(entry())}</time>
              </header>
              <div class="release-notes-markdown md-content" innerHTML={renderMarkdown(markdown(entry()))} />
            </article>
          </>
        )}
      </Show>
      <LinkButton
        variant="ghost"
        size="sm"
        tone="neutral"
        class="release-notes-source"
        href={`${PROJECT_URL}/blob/main/CHANGELOG.md`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="github" size="compact" />
        {t("releases.github")}
      </LinkButton>
    </SettingsPanel>
  )
}
