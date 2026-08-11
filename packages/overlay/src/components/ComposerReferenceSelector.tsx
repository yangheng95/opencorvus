import { createMemo, createSignal, For, Show } from "solid-js"
import type { VisibleComposerReferences } from "@opencorvus-ai/transport-protocol"
import type { ExpertSquadOption } from "../services/expert-squad"
import { setComposerMentionDirectiveSelected, type ComposerMentionKind } from "../services/composer-mention"
import { fuzzySearch } from "../services/fuzzy-search"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { ListboxItem, ListboxRoot, ListboxSection } from "./ui/Listbox"
import { Popover } from "./ui/Popover"
import { SearchField } from "./ui/SearchField"
import { Badge } from "./ui/Badge"

export interface ComposerReferenceSkillOption {
  name: string
  description?: string
}

interface ComposerReferenceOption {
  key: string
  kind: ComposerMentionKind
  id: string
  label: string
  description?: string
  typeLabel: string
  systemRole?: "expert_squad_generator"
}

interface ComposerReferenceGroup {
  kind: "skills" | "expert-squads"
  label: string
  options: ComposerReferenceOption[]
}

export interface ComposerReferenceSelectorProps {
  text: string
  onTextChange?: (text: string) => void
  skills: readonly ComposerReferenceSkillOption[]
  missionSkills: readonly ComposerReferenceSkillOption[]
  expertSquads: readonly ExpertSquadOption[]
  onExpertSquadQuery?: (query: string, selectedExpertSquadIDs: readonly string[]) => void
  onInstallMoreExpertSquads?: () => void
  activeExpertSquad?: ExpertSquadOption
  launchReferences: VisibleComposerReferences
  readOnly: boolean
  disabled?: boolean
}

function referenceSearchText(option: ComposerReferenceOption): string {
  return option.label
}

export function ComposerReferenceSelector(props: ComposerReferenceSelectorProps) {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [anchorRef, setAnchorRef] = createSignal<HTMLElement>()
  let searchInputRef: HTMLInputElement | undefined
  let listboxElement: HTMLUListElement | undefined

  const skillOptions = createMemo<ComposerReferenceOption[]>(() => [
    ...props.skills.map((skill) => ({
      key: `skill:${skill.name}`,
      kind: "skill" as const,
      id: skill.name,
      label: skill.name,
      description: skill.description,
      typeLabel: t("chat.references.skill"),
    })),
    ...props.missionSkills.map((skill) => ({
      key: `mission-skill:${skill.name}`,
      kind: "mission-skill" as const,
      id: skill.name,
      label: skill.name,
      description: skill.description,
      typeLabel: t("chat.references.mission_skill"),
    })),
  ])
  const squadOptions = createMemo<ComposerReferenceOption[]>(() =>
    props.expertSquads.map((squad) => ({
      key: `squad:${squad.id}`,
      kind: "squad" as const,
      id: squad.id,
      label: squad.name,
      description: squad.description,
      typeLabel: t("chat.references.expert_squad"),
      systemRole: squad.system_role,
    })),
  )
  const selectedKeys = createMemo(() => {
    const references = props.launchReferences
    return new Set([
      ...references.skillNames.map((name) => `skill:${name}`),
      ...references.missionSkillNames.map((name) => `mission-skill:${name}`),
      ...references.expertSquadIDs.map((id) => `squad:${id}`),
    ])
  })
  const selectedCount = createMemo(() => selectedKeys().size)
  const filteredSkillOptions = createMemo(() => fuzzySearch(skillOptions(), query(), referenceSearchText))
  const filteredSquadOptions = createMemo(() => fuzzySearch(squadOptions(), query(), referenceSearchText))
  const editableGroups = createMemo<ComposerReferenceGroup[]>(() => [
    ...(filteredSkillOptions().length > 0
      ? [{ kind: "skills" as const, label: t("chat.references.skills"), options: filteredSkillOptions() }]
      : []),
    ...(filteredSquadOptions().length > 0
      ? [
          {
            kind: "expert-squads" as const,
            label: t("chat.references.expert_squads"),
            options: filteredSquadOptions(),
          },
        ]
      : []),
  ])
  const visibleReferenceOptions = createMemo(() => editableGroups().flatMap((group) => group.options))
  const selectedVisibleKeys = createMemo(() =>
    visibleReferenceOptions()
      .filter((option) => selectedKeys().has(option.key))
      .map((option) => option.key),
  )
  const readOnlyOptions = createMemo<ComposerReferenceOption[]>(() => {
    const byKey = new Map([...skillOptions(), ...squadOptions()].map((option) => [option.key, option]))
    return [...selectedKeys()].map(
      (key) =>
        byKey.get(key) ?? {
          key,
          kind: key.slice(0, key.indexOf(":")) as ComposerMentionKind,
          id: key.slice(key.indexOf(":") + 1),
          label: key.slice(key.indexOf(":") + 1),
          typeLabel: key.startsWith("squad:")
            ? t("chat.references.expert_squad")
            : key.startsWith("mission-skill:")
              ? t("chat.references.mission_skill")
              : t("chat.references.skill"),
        },
    )
  })

  function updateOpen(next: boolean): void {
    setOpen(next)
    if (!next) {
      setQuery("")
      props.onExpertSquadQuery?.("", props.launchReferences.expertSquadIDs)
      return
    }
    if (!props.readOnly) queueMicrotask(() => searchInputRef?.focus())
  }

  function applyListboxSelection(keys: Set<string>): void {
    if (!props.onTextChange) return
    let next = props.text
    for (const option of visibleReferenceOptions()) {
      next = setComposerMentionDirectiveSelected(next, option.kind, option.id, keys.has(option.key))
    }
    if (next !== props.text) props.onTextChange(next)
  }

  function triggerLabel(): string {
    if (props.readOnly && props.activeExpertSquad) return props.activeExpertSquad.name
    return t(props.readOnly ? "chat.references.view" : "chat.references.trigger")
  }

  function renderOptionCopy(option: ComposerReferenceOption) {
    return (
      <>
        <span
          class="composer-reference-option-icon"
          data-reference-kind={option.kind}
          data-system-role={option.systemRole}
          aria-hidden="true"
        >
          <Icon
            name={
              option.systemRole === "expert_squad_generator"
                ? "config-expert-squad-install"
                : option.kind === "squad"
                  ? "expert-squad"
                  : "config-skill"
            }
            size="compact"
          />
        </span>
        <span class="composer-reference-option-copy">
          <span class="composer-reference-option-heading">
            <span class="composer-reference-option-name">{option.label}</span>
            <Show when={option.systemRole === "expert_squad_generator"}>
              <Badge class="composer-reference-option-system-badge" tone="accent" size="sm">
                {t("chat.references.generator")}
              </Badge>
            </Show>
            <span class="composer-reference-option-meta">
              {option.typeLabel}
              <Show when={option.id !== option.label}> · {option.id}</Show>
            </span>
          </span>
          <Show when={option.description}>
            <span class="composer-reference-option-description">{option.description}</span>
          </Show>
        </span>
      </>
    )
  }

  function renderReadOnlyOption(option: ComposerReferenceOption) {
    return (
      <div class="composer-reference-option" data-read-only="true">
        {renderOptionCopy(option)}
      </div>
    )
  }

  function openExpertSquadMarket(): void {
    updateOpen(false)
    props.onInstallMoreExpertSquads?.()
  }

  return (
    <Popover.Root
      open={open()}
      onOpenChange={updateOpen}
      anchorRef={anchorRef}
      placement="top-start"
      gutter={6}
      slide={false}
      fitViewport
    >
      <div ref={setAnchorRef} class="composer-reference-selector" data-ui="composer-reference-selector">
        <Popover.Trigger
          as={Button}
          type="button"
          variant="outline"
          size={props.readOnly && props.activeExpertSquad ? "sm" : "icon"}
          tone="neutral"
          class="composer-reference-trigger"
          data-ui={props.readOnly ? "composer-reference-view-trigger" : "composer-reference-select-trigger"}
          disabled={props.disabled}
          title={triggerLabel()}
          aria-label={triggerLabel()}
        >
          <Icon name={props.activeExpertSquad ? "expert-squad" : "expert-squad-catalog"} size="compact" />
          <Show when={props.readOnly && props.activeExpertSquad}>
            <span class="composer-reference-trigger-label">{triggerLabel()}</span>
          </Show>
          <Show when={!props.readOnly && selectedCount() > 0}>
            <span class="composer-reference-trigger-count">{selectedCount()}</span>
          </Show>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content class="composer-reference-popover">
          <div class="composer-reference-popover-heading">
            <span class="oc-section-heading">
              {t(props.readOnly ? "chat.references.selected_title" : "chat.references.title")}
            </span>
            <span>{t(props.readOnly ? "chat.references.read_only_hint" : "chat.references.selection_hint")}</span>
          </div>
          <Show
            when={!props.readOnly}
            fallback={
              <Show
                when={readOnlyOptions().length > 0}
                fallback={<div class="composer-reference-empty">{t("chat.references.none_selected")}</div>}
              >
                <div class="composer-reference-list" data-ui="composer-reference-read-only-list">
                  <For each={readOnlyOptions()}>{renderReadOnlyOption}</For>
                </div>
              </Show>
            }
          >
            <div class="composer-reference-search">
              <SearchField
                value={query()}
                onValueChange={(value) => {
                  setQuery(value)
                  props.onExpertSquadQuery?.(value, props.launchReferences.expertSquadIDs)
                }}
                onClear={() => searchInputRef?.focus()}
                placeholder={t("chat.references.search_placeholder")}
                size="sm"
                inputRef={(element) => {
                  searchInputRef = element
                }}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                  const options = listboxElement?.querySelectorAll<HTMLElement>(
                    '[role="option"]:not([aria-disabled="true"])',
                  )
                  const target = event.key === "ArrowDown" ? options?.[0] : options?.[options.length - 1]
                  if (!target) return
                  event.preventDefault()
                  target.focus()
                }}
                inputDataUI="composer-reference-search-input"
                clearDataUI="composer-reference-search-clear"
              />
            </div>
            <div class="composer-reference-results">
              <Show when={editableGroups().length > 0}>
                <ListboxRoot<ComposerReferenceOption, ComposerReferenceGroup>
                  ref={listboxElement}
                  class="composer-reference-listbox"
                  id="composerReferenceListbox"
                  density="rich"
                  aria-label={t("chat.references.title")}
                  options={editableGroups()}
                  optionGroupChildren="options"
                  optionValue={(option) => option.key}
                  optionTextValue={(option) => option.label}
                  value={selectedVisibleKeys()}
                  selectionMode="multiple"
                  selectionBehavior="toggle"
                  shouldFocusWrap
                  allowDuplicateSelectionEvents
                  onChange={applyListboxSelection}
                  renderSection={(section) => (
                    <ListboxSection class="composer-reference-section" data-reference-group={section.rawValue.kind}>
                      <span class="composer-reference-section-title">{section.rawValue.label}</span>
                    </ListboxSection>
                  )}
                  renderItem={(node) => {
                    const option = node.rawValue as ComposerReferenceOption
                    return (
                      <ListboxItem
                        item={node}
                        as="button"
                        type="button"
                        class="composer-reference-option"
                        data-reference-key={option.key}
                        data-reference-kind={option.kind}
                        data-system-role={option.systemRole}
                      >
                        <span class="composer-reference-option-selection" aria-hidden="true">
                          <Show when={selectedKeys().has(option.key)}>
                            <Icon name="check" size="compact" />
                          </Show>
                        </span>
                        {renderOptionCopy(option)}
                      </ListboxItem>
                    )
                  }}
                />
              </Show>
              <Show when={editableGroups().length === 0}>
                <div class="composer-reference-empty">{t("chat.references.no_matches")}</div>
              </Show>
              <Button
                type="button"
                variant="ghost"
                size="md"
                tone="neutral"
                class="composer-reference-option"
                data-ui="composer-reference-install-more"
                data-reference-kind="action"
                onClick={openExpertSquadMarket}
              >
                <span class="composer-reference-option-selection" aria-hidden="true" />
                <span class="composer-reference-option-icon" data-reference-kind="action" aria-hidden="true">
                  <Icon name="config-expert-squad-install" size="compact" />
                </span>
                <span class="composer-reference-option-copy">
                  <span class="composer-reference-option-heading">
                    <span class="composer-reference-option-name">{t("chat.references.install_more")}</span>
                    <span class="composer-reference-option-meta">{t("expert_squad.market")}</span>
                  </span>
                  <span class="composer-reference-option-description">
                    {t("chat.references.install_more_description")}
                  </span>
                </span>
              </Button>
            </div>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
