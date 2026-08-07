import { For, Show } from "solid-js"
import { todoStatusIconName } from "../utils/status-mapping"
import { extractTodos, summarizeTodos, type TodoItem } from "../utils/todos"
import { Icon } from "./ui/Icon"
import { TodoProgress } from "./TodoProgress"

export { extractTodos, type TodoItem }

function TodoItems(props: { todos: TodoItem[]; listClass: string }) {
  return (
    <ul class={props.listClass}>
      <For each={props.todos}>
        {(todo) => (
          <li class="msg-todo-item" data-status={todo.status}>
            <span class="msg-todo-icon" aria-hidden="true">
              <Icon name={todoStatusIconName(todo.status)} />
            </span>
            <span class="msg-todo-content">
              {todo.status === "in_progress" && todo.activeForm ? todo.activeForm : todo.content}
            </span>
            <Show when={todo.priority}>
              <span class="msg-todo-priority" data-priority={todo.priority}>
                {todo.priority}
              </span>
            </Show>
          </li>
        )}
      </For>
    </ul>
  )
}

export function TodoListPart(props: { todos: TodoItem[]; variant?: "inline" | "card" }) {
  const variant = () => props.variant ?? "inline"
  const counts = () => summarizeTodos(props.todos)

  if (variant() !== "card") {
    return <TodoItems todos={props.todos} listClass="msg-todo-list" />
  }

  return (
    <section class="msg-todo-card">
      <div class="msg-todo-card__summary">
        <div class="msg-todo-card__headline">
          <span class="msg-todo-card__count">{counts().remaining}</span>
          <span class="msg-todo-card__label">{counts().remaining === 1 ? "item left" : "items left"}</span>
        </div>
        <div class="msg-todo-card__meta">
          {counts().completed}/{counts().total} done
        </div>
      </div>

      <TodoProgress summary={counts()} variant="detail" showSummary={false} />

      <div class="msg-todo-card__stats">
        <Show when={counts().inProgress > 0}>
          <span class="msg-todo-card__stat" data-status="in_progress">
            In progress {counts().inProgress}
          </span>
        </Show>
        <Show when={counts().pending > 0}>
          <span class="msg-todo-card__stat" data-status="pending">
            Pending {counts().pending}
          </span>
        </Show>
        <Show when={counts().completed > 0}>
          <span class="msg-todo-card__stat" data-status="completed">
            Completed {counts().completed}
          </span>
        </Show>
        <Show when={counts().cancelled > 0}>
          <span class="msg-todo-card__stat" data-status="cancelled">
            Cancelled {counts().cancelled}
          </span>
        </Show>
      </div>

      <TodoItems todos={props.todos} listClass="msg-todo-list msg-todo-list--card" />
    </section>
  )
}
