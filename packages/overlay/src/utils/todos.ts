export interface TodoItem {
  content: string
  status: string
  priority?: string
  activeForm?: string
}

export interface TodoSummary {
  total: number
  completed: number
  inProgress: number
  pending: number
  cancelled: number
  resolved: number
  remaining: number
  /** Active item, then first pending item, then the latest terminal item. */
  current: string
}

const TODO_STATUSES = new Set<TodoItem["status"]>(["pending", "in_progress", "completed", "cancelled"])
const TODO_PRIORITIES = new Set<NonNullable<TodoItem["priority"]>>(["high", "medium", "low"])

function statusKey(raw: unknown): TodoItem["status"] {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
  if (s === "completed" || s === "in_progress" || s === "cancelled" || s === "pending") return s
  return "pending"
}

function priorityKey(raw: unknown): string {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
  if (s === "high" || s === "medium" || s === "low") return s
  return ""
}

export function normalizeTodos(list: unknown): TodoItem[] | null {
  if (!Array.isArray(list)) return null
  return list
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      content: String(item.content ?? "").trim(),
      status: statusKey(item.status),
      priority: priorityKey(item.priority) || undefined,
      activeForm: typeof item.activeForm === "string" && item.activeForm.trim() ? item.activeForm.trim() : undefined,
    }))
    .filter((item) => item.content.length > 0)
}

export function canonicalTodos(list: unknown): TodoItem[] | null {
  if (!Array.isArray(list)) return null
  const todos: TodoItem[] = []
  for (const value of list) {
    if (!value || typeof value !== "object") return null
    const item = value as Record<string, unknown>
    const content = typeof item.content === "string" ? item.content.trim() : ""
    const status = typeof item.status === "string" ? item.status.trim() : ""
    const priority = typeof item.priority === "string" ? item.priority.trim() : ""
    if (!content || !TODO_STATUSES.has(status as TodoItem["status"])) return null
    if (!TODO_PRIORITIES.has(priority as NonNullable<TodoItem["priority"]>)) return null
    const activeForm = typeof item.activeForm === "string" ? item.activeForm.trim() : ""
    todos.push({
      content,
      status: status as TodoItem["status"],
      priority: priority as NonNullable<TodoItem["priority"]>,
      ...(activeForm ? { activeForm } : {}),
    })
  }
  return todos
}

function todoTitle(todo: TodoItem): string {
  return todo.status === "in_progress" && todo.activeForm ? todo.activeForm : todo.content
}

export function summarizeTodos(todos: readonly TodoItem[]): TodoSummary {
  let completed = 0
  let inProgress = 0
  let pending = 0
  let cancelled = 0
  let activeTitle = ""
  let pendingTitle = ""
  let terminalTitle = ""
  for (const todo of todos) {
    const title = todoTitle(todo)
    if (todo.status === "completed") {
      completed += 1
      if (title) terminalTitle = title
      continue
    }
    if (todo.status === "in_progress") {
      inProgress += 1
      if (title && !activeTitle) activeTitle = title
      continue
    }
    if (todo.status === "cancelled") {
      cancelled += 1
      if (title) terminalTitle = title
      continue
    }
    pending += 1
    if (title && !pendingTitle) pendingTitle = title
  }
  return {
    total: todos.length,
    completed,
    inProgress,
    pending,
    cancelled,
    resolved: completed + cancelled,
    remaining: inProgress + pending,
    current: activeTitle || pendingTitle || terminalTitle,
  }
}

function parseOutputTodos(output: unknown): TodoItem[] | null {
  const out = typeof output === "string" ? output.trim() : ""
  if (!out.startsWith("[")) return null
  try {
    return normalizeTodos(JSON.parse(out))
  } catch {
    return null
  }
}

/**
 * Coerce a TodoWrite/TodoRead/UpdatePlan tool state into the canonical todo
 * list. Completed tool results are authoritative over the original input,
 * because input.todos is only the call-time snapshot and can stay at 0/N.
 */
export function extractTodos(state: any): TodoItem[] | null {
  const metadataTodos = normalizeTodos(state?.metadata?.todos)
  if (metadataTodos) return metadataTodos
  const outputTodos = parseOutputTodos(state?.output)
  if (outputTodos) return outputTodos
  return normalizeTodos(state?.input?.todos)
}
