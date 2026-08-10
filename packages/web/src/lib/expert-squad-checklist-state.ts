import type { ChecklistLocale, ExpertSquadRoadmapCandidate } from "../content/workbuddy-expert-squad-candidates"

export const EXPERT_SQUAD_CHECKLIST_STORAGE_KEY = "opencorvus:expert-squad-checklist:v1"
export const EXPERT_SQUAD_CHECKLIST_VERSION = 1 as const

export type ExpertSquadChecklistDraft = {
  version: typeof EXPERT_SQUAD_CHECKLIST_VERSION
  orderedIds: string[]
  selectedIds: string[]
  parallelIds: string[]
  note: string
}

function uniqueKnownIDs(values: unknown, known: Set<string>): string[] {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const value of values) {
    if (typeof value !== "string" || !known.has(value) || result.includes(value)) continue
    result.push(value)
  }
  return result
}

export function createDefaultChecklistDraft(candidateIDs: readonly string[]): ExpertSquadChecklistDraft {
  return {
    version: EXPERT_SQUAD_CHECKLIST_VERSION,
    orderedIds: [...candidateIDs],
    selectedIds: [],
    parallelIds: [],
    note: "",
  }
}

export function parseChecklistDraft(value: unknown, candidateIDs: readonly string[]): ExpertSquadChecklistDraft {
  const fallback = createDefaultChecklistDraft(candidateIDs)
  if (!value || typeof value !== "object") return fallback
  const input = value as Record<string, unknown>
  if (input.version !== EXPERT_SQUAD_CHECKLIST_VERSION) return fallback
  const known = new Set(candidateIDs)
  const restoredOrder = uniqueKnownIDs(input.orderedIds, known)
  const orderedIds = [...restoredOrder, ...candidateIDs.filter((id) => !restoredOrder.includes(id))]
  const selectedIds = uniqueKnownIDs(input.selectedIds, known)
  return {
    version: EXPERT_SQUAD_CHECKLIST_VERSION,
    orderedIds,
    selectedIds,
    parallelIds: uniqueKnownIDs(input.parallelIds, new Set(selectedIds)),
    note: typeof input.note === "string" ? input.note.slice(0, 2000) : "",
  }
}

export function reorderChecklistIDs(ids: readonly string[], activeID: string, targetID: string): string[] {
  if (activeID === targetID || !ids.includes(activeID) || !ids.includes(targetID)) return [...ids]
  const next = ids.filter((id) => id !== activeID)
  next.splice(next.indexOf(targetID), 0, activeID)
  return next
}

export function moveChecklistID(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const current = ids.indexOf(id)
  const target = current + delta
  if (current < 0 || target < 0 || target >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[current], next[target]] = [next[target], next[current]]
  return next
}

export function exportParallelWorkDeclaration(
  draft: ExpertSquadChecklistDraft,
  candidates: readonly ExpertSquadRoadmapCandidate[],
  locale: ChecklistLocale,
): string {
  const byID = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const selected = draft.orderedIds.filter((id) => draft.selectedIds.includes(id)).map((id) => byID.get(id)!)
  const parallel = selected.filter((candidate) => draft.parallelIds.includes(candidate.id))
  const serial = selected.filter((candidate) => !draft.parallelIds.includes(candidate.id))
  const zh = locale === "zh-cn"
  const lines = [
    zh ? "# 专家团补充并行工作声明" : "# Expert Squad expansion parallel-work declaration",
    "",
    zh ? `- 已选择：${selected.length}` : `- Selected: ${selected.length}`,
    zh ? `- 可并行包：${parallel.length}` : `- Parallel package lanes: ${parallel.length}`,
    zh ? `- 研究核验日期：2026-08-10` : `- Research verified: 2026-08-10`,
    "",
    zh ? "## 优先级" : "## Priority",
    "",
    ...selected.map((candidate, index) => `${index + 1}. ${candidate.label[locale]} (\`${candidate.id}\`)`),
    "",
    zh ? "## 可并行实施" : "## Parallel implementation",
    "",
    ...(parallel.length
      ? parallel.map(
          (candidate) =>
            `- \`${candidate.id}\`: \`expert-squads/builtin/${candidate.id}/**\` — ${candidate.parallelPlan[locale]}`,
        )
      : [zh ? "- 尚未声明可并行包。" : "- No package has been declared parallel."]),
    "",
    zh ? "## 串行或依赖后实施" : "## Serial or dependency-bound implementation",
    "",
    ...(serial.length
      ? serial.map((candidate) => `- \`${candidate.id}\`: ${candidate.parallelPlan[locale]}`)
      : [zh ? "- 无。" : "- None."]),
    "",
    zh ? "## 统一串行收敛面" : "## Serialized convergence boundary",
    "",
    zh
      ? "- 精确暂存包源后生成 payload；更新公共事实与文档索引；运行完整检查和真实页面验收；独立审查；最终提交与推送。"
      : "- Generate the payload from exact staged package sources; update shared public facts and documentation indexes; run complete checks and real-page acceptance; independent review; final commit and push.",
    "",
    zh ? "## 备注" : "## Note",
    "",
    draft.note.trim() || (zh ? "无。" : "None."),
  ]
  return lines.join("\n")
}
