import type { ChecklistLocale, ExpertSquadRoadmapCandidate } from "../content/workbuddy-expert-squad-candidates"

export const EXPERT_SQUAD_CHECKLIST_STORAGE_KEY = "opencorvus:expert-squad-generation-goal:v2"
export const EXPERT_SQUAD_CHECKLIST_VERSION = 2 as const

export type ExpertSquadChecklistDraft = {
  version: typeof EXPERT_SQUAD_CHECKLIST_VERSION
  orderedIds: string[]
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
  return {
    version: EXPERT_SQUAD_CHECKLIST_VERSION,
    orderedIds,
    parallelIds: uniqueKnownIDs(input.parallelIds, known),
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
  const batch = draft.orderedIds.map((id) => byID.get(id)!)
  const parallel = batch.filter((candidate) => draft.parallelIds.includes(candidate.id))
  const serial = batch.filter((candidate) => !draft.parallelIds.includes(candidate.id))
  const zh = locale === "zh-cn"
  const lines = [
    zh ? "# 专家团生成目标声明" : "# Expert Squad generation-goal declaration",
    "",
    zh ? `- 本批领域：${batch.length}` : `- Domains in batch: ${batch.length}`,
    zh ? `- 独立并行泳道：${parallel.length}` : `- Independent parallel lanes: ${parallel.length}`,
    zh ? `- 研究核验日期：2026-08-11` : `- Research verified: 2026-08-11`,
    zh ? "- 状态：等待操作者确认后生成" : "- State: awaiting operator confirmation before generation",
    "",
    zh ? "## 权威生成优先级" : "## Authoritative generation priority",
    "",
    ...batch.map((candidate, index) => `${index + 1}. ${candidate.label[locale]} (\`${candidate.id}\`)`),
    "",
    zh ? "## 可独立并行生成" : "## Independent parallel generation",
    "",
    ...(parallel.length
      ? parallel.map(
          (candidate) =>
            `- \`${candidate.id}\`: \`expert-squads/builtin/${candidate.id}/**\` — ${candidate.parallelPlan[locale]}`,
        )
      : [zh ? "- 尚未声明独立并行泳道。" : "- No independent parallel lane has been declared."]),
    "",
    zh ? "## 串行生成队列" : "## Serial generation queue",
    "",
    ...(serial.length
      ? serial.map((candidate) => `- \`${candidate.id}\`: ${candidate.parallelPlan[locale]}`)
      : [zh ? "- 无。" : "- None."]),
    "",
    zh ? "## 统一串行收敛面" : "## Serialized convergence boundary",
    "",
    zh
      ? "- 每团必须保存专属 Skill 与资产并通过安装/权限投影；十团全部合格后才从精确暂存源生成 payload、更新公共事实、执行真实页面验收、独立审查、提交和推送。"
      : "- Every Squad must save its dedicated Skill and asset and pass installation/grant projection; only after all ten qualify may exact staged sources generate the payload, public facts, real-page acceptance, independent review, commit, and push.",
    "",
    zh ? "## 备注" : "## Note",
    "",
    draft.note.trim() || (zh ? "无。" : "None."),
  ]
  return lines.join("\n")
}
