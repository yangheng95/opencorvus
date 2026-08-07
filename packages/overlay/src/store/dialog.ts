import { createStore } from "solid-js/store"
import type { AppDialogOptions } from "../services/app-dialog"

export type ConfigDialogTab =
  | "general"
  | "appearance"
  | "code"
  | "work"
  | "expert-squad-install"
  | "expert-squad"
  | "channel"
  | "skill"
  | "mission-skill"
  | "mcp"
  | "memory"
  | "network"
  | "providers"
  | "scheduled"
  | "archive"
  | "about"

export interface ConfigSection {
  id: ConfigDialogTab
  labelKey: string
  searchTerms?: readonly string[]
}

// Single source for the config sections, their i18n label keys, and their
// order. Consumed by:
//   • ConfigDialogHost — renders the sidebar nav (adds per-section icons),
//   • services/dialog.ts — the valid-tab guard set,
//   • TitlebarMenubar — the top-level Settings menu,
//   • CommandPalette — the Cmd/Ctrl+K Settings commands.
// Add a section here once and it surfaces in every settings entrypoint.
export const CONFIG_SECTIONS: readonly ConfigSection[] = [
  { id: "general", labelKey: "settings.title" },
  { id: "appearance", labelKey: "settings.section.appearance" },
  {
    id: "code",
    labelKey: "settings.section.code",
    searchTerms: ["coding", "chat", "harness", "tools", "skills", "MCP", "编码", "对话", "能力"],
  },
  {
    id: "work",
    labelKey: "settings.section.work",
    searchTerms: ["documents", "presentations", "spreadsheets", "PDF", "office", "skills", "MCP", "办公", "文档"],
  },
  { id: "mission-skill", labelKey: "mission_skill.title", searchTerms: ["mission", "orchestration", "工作流"] },
  { id: "scheduled", labelKey: "automations.title", searchTerms: ["automation", "recurring", "schedule", "定时"] },
  { id: "expert-squad-install", labelKey: "expert_squad.market" },
  { id: "expert-squad", labelKey: "expert_squad.configuration" },
  { id: "providers", labelKey: "cmdk.settings.providers" },
  {
    id: "skill",
    labelKey: "settings.section.skill_library",
    searchTerms: ["installed", "shared", "skills", "extensions", "已安装", "共享", "资源"],
  },
  {
    id: "mcp",
    labelKey: "settings.section.mcp_connections",
    searchTerms: ["model context protocol", "servers", "connections", "shared", "服务", "连接", "共享"],
  },
  { id: "channel", labelKey: "channel.title" },
  { id: "memory", labelKey: "memory.title" },
  { id: "network", labelKey: "network.title" },
  { id: "archive", labelKey: "archive.title" },
  { id: "about", labelKey: "about.title" },
]

export interface AppDialogState extends AppDialogOptions {
  open: boolean
  epoch: number
}

export interface SessionDialogState {
  open: boolean
  title: string
  bodyHtml: string
}

export interface GoalDialogState {
  open: boolean
  goalID: string
  title: string
  acceptance: string
  saving: boolean
}

export interface ConfigDialogState {
  open: boolean
  activeTab: ConfigDialogTab
  sidebarWidth: number | null
}

export interface DialogState {
  app: AppDialogState
  session: SessionDialogState
  goal: GoalDialogState
  config: ConfigDialogState
}

const DEFAULT_DIALOG_STATE: DialogState = {
  app: {
    open: false,
    epoch: 0,
    title: "",
    message: "",
    kind: "",
    okLabel: "",
    cancelLabel: "",
    cancel: false,
    input: false,
    inputType: "text",
    inputLabel: "",
    inputPlaceholder: "",
    inputValue: "",
    select: false,
    selectLabel: "",
    selectValue: "",
    selectOptions: [],
  },
  session: {
    open: false,
    title: "",
    bodyHtml: "",
  },
  goal: {
    open: false,
    goalID: "",
    title: "",
    acceptance: "",
    saving: false,
  },
  config: {
    open: false,
    activeTab: "general",
    sidebarWidth: null,
  },
}

export const [dialogStore, setDialogStore] = createStore<DialogState>(DEFAULT_DIALOG_STATE)
