export const PANEL_ACTIONS = Object.freeze([
  { action: "expert_squad_inspect", kind: "query" },
  { action: "multica_catalog", kind: "query" },
  { action: "view_plan", kind: "query" },
  { action: "view_board", kind: "query" },
  { action: "view_tasks", kind: "query" },
  { action: "query_task", kind: "query" },
  { action: "query_task_artifacts", kind: "query" },
  { action: "read_task_artifact", kind: "query" },
  { action: "complete_mission", kind: "mutation" },
  { action: "create_task", kind: "mutation" },
  { action: "wake_mission", kind: "mutation" },
  { action: "wake_work", kind: "mutation" },
  { action: "send_task_message", kind: "mutation" },
  { action: "resume_task", kind: "mutation" },
  { action: "reply_interaction", kind: "mutation" },
  { action: "reject_interaction", kind: "mutation" },
  { action: "cancel_task", kind: "mutation" },
  { action: "update_checks", kind: "mutation" },
  { action: "capture_overlay_screenshot", kind: "query" },
  { action: "select_task", kind: "mutation" },
  { action: "select_session", kind: "mutation" },
  { action: "create_session", kind: "mutation" },
  { action: "fork_session", kind: "mutation" },
  { action: "delete_session", kind: "mutation" },
  { action: "update_goal", kind: "mutation" },
  { action: "delete_goal", kind: "mutation" },
] as const)

export type PanelActionID = (typeof PANEL_ACTIONS)[number]["action"]

export function panelLeafToolID(action: PanelActionID): `panel_${PanelActionID}` {
  return `panel_${action}`
}

export const PANEL_LEAF_TOOL_IDS = Object.freeze(PANEL_ACTIONS.map((entry) => panelLeafToolID(entry.action)))
export const PANEL_QUERY_TOOL_IDS = Object.freeze(
  PANEL_ACTIONS.filter((entry) => entry.kind === "query").map((entry) => panelLeafToolID(entry.action)),
)
export const PANEL_MUTATION_TOOL_IDS = Object.freeze(
  PANEL_ACTIONS.filter((entry) => entry.kind === "mutation").map((entry) => panelLeafToolID(entry.action)),
)

export const MISSION_PANEL_ACTION_IDS = Object.freeze([
  "expert_squad_inspect",
  "multica_catalog",
  "create_task",
  "query_task",
  "query_task_artifacts",
  "read_task_artifact",
  "complete_mission",
  "view_board",
  "view_plan",
  "view_tasks",
  "resume_task",
  "cancel_task",
  "reply_interaction",
  "reject_interaction",
] as const satisfies readonly PanelActionID[])

export const EXPLORE_PANEL_ACTION_IDS = Object.freeze([
  "query_task",
  "view_board",
  "view_plan",
  "view_tasks",
] as const satisfies readonly PanelActionID[])

export const RIGHT_SIDEBAR_PANEL_ACTION_IDS = Object.freeze([
  "view_plan",
  "view_board",
  "view_tasks",
  "query_task",
  "query_task_artifacts",
  "create_task",
  "wake_mission",
  "wake_work",
  "send_task_message",
  "reply_interaction",
  "reject_interaction",
  "cancel_task",
  "update_checks",
  "select_task",
  "select_session",
  "update_goal",
  "delete_goal",
] as const satisfies readonly PanelActionID[])

export const MISSION_PANEL_LEAF_TOOL_IDS = Object.freeze(MISSION_PANEL_ACTION_IDS.map(panelLeafToolID))
export const EXPLORE_PANEL_LEAF_TOOL_IDS = Object.freeze(EXPLORE_PANEL_ACTION_IDS.map(panelLeafToolID))
export const RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS = Object.freeze(RIGHT_SIDEBAR_PANEL_ACTION_IDS.map(panelLeafToolID))
