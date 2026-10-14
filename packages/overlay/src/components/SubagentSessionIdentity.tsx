import { Show } from "solid-js"
import type { SubagentSessionIdentity as SessionIdentity } from "../utils/subagent-presentation"

export function SubagentSessionIdentity(props: { identity: SessionIdentity }) {
  return (
    <span class="subagent-session-identity" title={props.identity.suffix ? props.identity.sessionID : undefined}>
      <span class="subagent-session-identity__name">{props.identity.agentID}</span>
      <Show when={props.identity.suffix}>
        <span class="subagent-session-identity__suffix"> · {props.identity.suffix}</span>
      </Show>
    </span>
  )
}
