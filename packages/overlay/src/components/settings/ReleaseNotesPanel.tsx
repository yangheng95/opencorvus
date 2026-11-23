import { For, Show, createMemo, createSignal } from "solid-js"
import { parseChangelog, requireReleaseNotes, standaloneReleaseNotes, type ChangelogEntry } from "@opencorvus-ai/util/changelog"
import changelog from "../../../../../CHANGELOG.md?raw"
import { matchesSearchParts, matchesSearchTerms, splitSearchTerms } from "../../services/text-search"
import { appStore } from "../../store/app"
import { t, tc } from "../../utils/i18n"
import { inlineMarkdown, renderMarkdown } from "../../utils/markdown"
import { markdownListPreviewItems } from "../../utils/markdown-preview"
import { PROJECT_URL, PROJECT_WEBSITE_URL } from "../../utils/project-links"
import { OVERLAY_VERSION } from "../../utils/version"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { LinkButton } from "../ui/LinkButton"
import { createSearchResultNavigation, SearchField } from "../ui/SearchField"
import { SettingsEmpty, SettingsPanel, SettingsRow, SettingsSurface } from "./layout"

const history = parseChangelog(changelog)
const installed = requireReleaseNotes(history, OVERLAY_VERSION)

export default function ReleaseNotesPanel() {
  const locale = () => appStore.locale as keyof ChangelogEntry["notes"]
  const markdown = (entry: ChangelogEntry) => standaloneReleaseNotes(entry, locale())
  const dateFormatter = createMemo(() => new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }))
  const date = (entry: ChangelogEntry) => dateFormatter().format(new Date(`${entry.date}T00:00:00Z`))
  const [selected, setSelected] = createSignal<ChangelogEntry | null>(installed)
  const [query, setQuery] = createSignal("")
  const queryTerms = createMemo(() => splitSearchTerms(query()))
  const metadata = (entry: ChangelogEntry) => [entry.displayVersion, entry.version, entry.date, date(entry)]
  const filteredHistory = createMemo(() => {
    const term = query().trim()
    if (!term) return history
    return history.filter((entry) =>
      matchesSearchTerms(term, [...metadata(entry), markdown(entry)]),
    )
  })
  let panel: HTMLDivElement | undefined
  let versionHeading: HTMLHeadingElement | undefined
  let historySearchInput: HTMLInputElement | undefined
  let focusGeneration = 0
  const hasSearchMatches = () => Boolean(query().trim() && filteredHistory().length)
  const searchNavigation = createSearchResultNavigation(() => {
    if (!hasSearchMatches() || !panel) return []
    return Array.from(panel.querySelectorAll<HTMLButtonElement>("button[data-release-version]:enabled"))
  }, { returnToSearch: () => historySearchInput })
  const releaseRow = (version: string) =>
    panel?.querySelector<HTMLButtonElement>(`[data-release-version="${CSS.escape(version)}"]`) ?? undefined
  const select = (entry: ChangelogEntry | null) => {
    const previous = selected()
    const origin = document.activeElement
    const generation = ++focusGeneration
    setSelected(entry)
    if (entry) panel?.closest(".config-content")?.scrollTo({ top: 0 })
    queueMicrotask(() => {
      if (generation !== focusGeneration || selected() !== entry || !panel?.isConnected) return
      if (document.activeElement !== origin && document.activeElement !== document.body) return
      let target: HTMLElement | undefined
      if (entry) target = versionHeading
      else target = (previous && releaseRow(previous.version)) ?? historySearchInput
      if (target?.isConnected) target.focus()
    })
  }
  const summary = (entry: ChangelogEntry, notes: ReturnType<typeof markdownListPreviewItems>) => {
    const entryMetadata = metadata(entry)
    const bodyTerms = queryTerms().filter((term) => !matchesSearchParts(term, entryMetadata))
    let best = notes[0]
    let bestScore = 0
    if (bodyTerms.length === 0) return best?.markdown ?? ""

    for (const note of notes) {
      const score = bodyTerms.filter((term) => matchesSearchParts(term, [note.text])).length
      if (score > bestScore) {
        best = note
        bestScore = score
      }
    }
    return best?.markdown ?? ""
  }

  return (
    <SettingsPanel class="release-notes-panel" ref={panel}>
      <p class="release-notes-intro">{t("releases.description")}</p>
      <Show
        when={selected()}
        fallback={
          <>
            <div class="release-notes-toolbar">
              <SearchField
                clearable
                inputRef={(element) => (historySearchInput = element)}
                value={query()}
                placeholder={t("releases.search")}
                ariaDescribedBy={hasSearchMatches() ? "release-notes-search-keyboard-hint" : undefined}
                onValueChange={setQuery}
                resultFocusTarget={searchNavigation.resultFocusTarget}
                size="md"
              />
              <Button variant="outline" size="sm" tone="neutral" onClick={() => select(installed)}>
                {t("releases.installed")} · v{installed.displayVersion}
              </Button>
            </div>
            <div class="release-notes-search-status">
              <span>{tc("releases.count", filteredHistory().length)}</span>
              <Show when={hasSearchMatches()}>
                <span id="release-notes-search-keyboard-hint">{t("settings.search_return_keyboard_hint")}</span>
              </Show>
            </div>
            <SettingsSurface>
              <For each={filteredHistory()} fallback={<SettingsEmpty>{t("releases.empty")}</SettingsEmpty>}>
                {(entry) => {
                  const notes = createMemo(() => markdownListPreviewItems(markdown(entry)))
                  return (
                    <SettingsRow
                      as="button"
                      interactive
                      class="release-notes-row"
                      data-release-version={entry.version}
                      aria-keyshortcuts={hasSearchMatches() ? "ArrowUp ArrowDown Escape" : undefined}
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
                          innerHTML={inlineMarkdown(summary(entry, notes())).replace(/<\/?a(?:\s[^>]*)?>/g, "")}
                        />
                      }
                      meta={<time dateTime={entry.date}>{date(entry)}</time>}
                      onKeyDown={searchNavigation.handleResultKeyDown}
                      onClick={() => select(entry)}
                    />
                  )
                }}
              </For>
            </SettingsSurface>
          </>
        }
      >
        {(entry) => (
          <>
            <div class="release-notes-toolbar release-notes-toolbar--detail">
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
                  <h2 ref={versionHeading} tabIndex={-1}>v{entry().displayVersion}</h2>
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
