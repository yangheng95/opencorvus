import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js"
import {
  type ComposerMentionCategory,
  type ComposerMentionKind,
  type ComposerMentionOption,
} from "../services/composer-mention"
import { t } from "../utils/i18n"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { Icon } from "./ui/Icon"
import { ListboxItem, ListboxRoot, ListboxSection } from "./ui/Listbox"

export interface ComposerMentionMenuProps {
  categories: readonly ComposerMentionCategory[]
  options: ComposerMentionOption[]
  selectedKey: string
  error?: string
  onHighlight: (option: ComposerMentionOption) => void
  onSelect: (option: ComposerMentionOption) => void
}

interface ComposerMentionGroup {
  kind: ComposerMentionKind
  label: string
  description: string
  options: ComposerMentionOption[]
}

function categoryLabel(categories: readonly ComposerMentionCategory[], kind: ComposerMentionKind): string {
  return categories.find((category) => category.kind === kind)?.label ?? kind
}

const VERTICAL_CLIPPING_OVERFLOW = new Set(["auto", "clip", "hidden", "scroll"])

function mentionMenuTopBoundary(element: HTMLElement): number {
  let boundary = 0
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (!VERTICAL_CLIPPING_OVERFLOW.has(style.overflowY)) continue
    boundary = Math.max(boundary, ancestor.getBoundingClientRect().top)
  }
  return boundary
}

export function ComposerMentionMenu(props: ComposerMentionMenuProps) {
  let menuElement!: HTMLDivElement
  let listboxElement: HTMLUListElement | undefined
  let revealSelectedFrame: number | undefined
  const groups = createMemo<ComposerMentionGroup[]>(() =>
    props.categories.flatMap((category) => {
      const options = props.options.filter((option) => option.kind === category.kind)
      return options.length > 0
        ? [
            {
              kind: category.kind,
              label: category.label,
              description: category.description,
              options,
            },
          ]
        : []
    }),
  )

  createEffect(() => {
    if (!props.selectedKey) return
    if (revealSelectedFrame !== undefined) window.cancelAnimationFrame(revealSelectedFrame)
    revealSelectedFrame = window.requestAnimationFrame(() => {
      revealSelectedFrame = undefined
      listboxElement
        ?.querySelector<HTMLElement>(".composer-mention-option[data-selected]")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  })

  onCleanup(() => {
    if (revealSelectedFrame !== undefined) window.cancelAnimationFrame(revealSelectedFrame)
  })

  const availableHeightOnFrame = createAnimationFrameScheduler(() => {
    const panel = menuElement.querySelector<HTMLElement>(".composer-mention-panel")
    const listbox = menuElement.querySelector<HTMLElement>(".composer-mention-listbox")
    if (!panel || !listbox) return

    const menuBottom = menuElement.getBoundingClientRect().bottom
    const availableMenuHeight = Math.max(0, menuBottom - mentionMenuTopBoundary(menuElement))
    const panelRect = panel.getBoundingClientRect()
    const listboxRect = listbox.getBoundingClientRect()
    const menuChromeHeight = Math.max(0, panelRect.height - listboxRect.height)
    const availableListboxHeight = Math.max(0, Math.floor(availableMenuHeight - menuChromeHeight))
    menuElement.style.setProperty("--composer-mention-listbox-available-height", `${availableListboxHeight}px`)
  })

  onMount(() => {
    const panel = menuElement.querySelector<HTMLElement>(".composer-mention-panel")
    const anchor = menuElement.parentElement
    if (!panel || !anchor) throw new Error("Composer mention menu requires its panel and textarea anchor")

    const observer = new ResizeObserver(availableHeightOnFrame.schedule)
    observer.observe(anchor)
    observer.observe(panel)
    window.addEventListener("resize", availableHeightOnFrame.schedule)
    window.addEventListener("scroll", availableHeightOnFrame.schedule, true)
    availableHeightOnFrame.schedule()

    onCleanup(() => {
      observer.disconnect()
      window.removeEventListener("resize", availableHeightOnFrame.schedule)
      window.removeEventListener("scroll", availableHeightOnFrame.schedule, true)
      availableHeightOnFrame.cancel()
    })
  })

  return (
    <div
      ref={menuElement}
      class="composer-mention-menu"
      data-ui="composer-mention-menu"
      onPointerDown={(event) => event.preventDefault()}
    >
      <div class="oc-menu composer-mention-panel">
        <div class="composer-mention-menu-header oc-section-heading">
          <span>{t("chat.mention.title")}</span>
          <span class="composer-mention-menu-hint">{t("chat.mention.keyboard_hint")}</span>
        </div>
        <Show when={props.error}>
          {(message) => (
            <div class="composer-mention-empty" data-ui="composer-mention-catalog-error" role="alert">
              {message()}
            </div>
          )}
        </Show>
        <Show
          when={groups().length > 0}
          fallback={
            <div class="composer-mention-empty" data-ui="composer-mention-empty" role="status">
              {t("chat.mention.empty")}
            </div>
          }
        >
          <ListboxRoot<ComposerMentionOption, ComposerMentionGroup>
            ref={listboxElement}
            id="composerMentionListbox"
            class="composer-mention-listbox"
            density="rich"
            data-ui="composer-mention-listbox"
            aria-label={t("chat.mention.aria_label")}
            options={groups()}
            optionGroupChildren="options"
            value={props.selectedKey ? [props.selectedKey] : []}
            optionValue={(option) => option.key}
            optionTextValue={(option) => option.searchText}
            optionDisabled={(option) => option.disabled}
            disallowEmptySelection
            allowDuplicateSelectionEvents
            shouldFocusWrap
            onChange={(keys) => {
              const key = [...keys][0]
              const option = props.options.find((candidate) => candidate.key === key)
              if (option) props.onSelect(option)
            }}
            renderSection={(section) => (
              <ListboxSection
                class="composer-mention-group"
                data-ui="composer-mention-group"
                data-mention-kind={section.rawValue.kind}
                title={section.rawValue.description}
              >
                <span>{section.rawValue.label}</span>
              </ListboxSection>
            )}
            renderItem={(node) => {
              const option = node.rawValue as ComposerMentionOption
              return (
                <ListboxItem
                  item={node}
                  as="button"
                  type="button"
                  class="composer-mention-option"
                  data-ui="composer-mention-option"
                  data-mention-kind={option.kind}
                  data-mention-key={option.key}
                  onPointerEnter={() => props.onHighlight(option)}
                >
                  <span class="composer-mention-option-icon" aria-hidden="true">
                    <Icon name={option.kind === "squad" ? "expert-squad" : "config-skill"} size="medium" />
                  </span>
                  <span class="composer-mention-option-copy">
                    <span class="composer-mention-option-label">{option.label}</span>
                    <Show when={option.description}>
                      <span class="composer-mention-option-description">{option.description}</span>
                    </Show>
                  </span>
                  <span class="composer-mention-option-kind">{categoryLabel(props.categories, option.kind)}</span>
                </ListboxItem>
              )
            }}
          />
        </Show>
      </div>
    </div>
  )
}
