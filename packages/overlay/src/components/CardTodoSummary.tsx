import type { TodoSummary } from "../utils/card-tree"
import { TodoProgress, todoProgressText } from "./TodoProgress"

export { todoProgressText }

export function CardTodoSummary(props: { summary: TodoSummary }) {
  return <TodoProgress summary={props.summary} variant="card" />
}
