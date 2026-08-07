export function testTimelineOrderKey(rank: number, time: number, id: string, sequence = 0, domain = "test"): string {
  return `v1:${String(time).padStart(16, "0")}:${String(rank).padStart(16, "0")}:${String(sequence).padStart(16, "0")}:${domain}:${id}`
}

export function testTaskOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(10, time, id, 0, "task")
}

export function testMessageOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(30, time, id, 0, "message")
}

export function testPartOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(31, time, id, 0, "part")
}

export function testGoalOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(60, time, id, 0, "board_goal")
}

export function testBoardOrderKey(id: string, time: number, rank: number): string {
  return testTimelineOrderKey(rank, time, id, 0, "board")
}

export function testInteractionOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(70, time, id, 0, "interaction")
}

export function testEventOrderKey(type: string, time: number, sequence = 0): string {
  return testTimelineOrderKey(40, time, `evt_${type}_${time}`, sequence, "event")
}

export function testSessionOrderKey(id: string, time: number): string {
  return testTimelineOrderKey(50, time, id, 0, "session")
}

function requireExplicitOrderKey(value: unknown, label: string, domain?: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`test fixture ${label} missing orderKey`)
  if (domain) {
    const actualDomain = value.split(":", 6)[4] || ""
    if (actualDomain !== domain) {
      throw new Error(`test fixture ${label} expected ${domain} orderKey, got ${actualDomain}: ${value}`)
    }
  }
  return value
}

function requireExplicitString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`test fixture ${label} missing`)
  return value
}

function requireMessageIdentity(info: any, label: string): void {
  requireExplicitString(info?.role, `${label} role`)
  requireExplicitString(info?.author, `${label} author`)
  requireExplicitString(info?.agentID, `${label} agentID`)
  requireExplicitString(info?.channel, `${label} channel`)
  requireExplicitString(info?.resolvedRole, `${label} resolvedRole`)
  if (typeof info?.originSource !== "string") throw new Error(`test fixture ${label} originSource missing`)
}

export function stampTestBoard(board: any): any {
  if (!board || typeof board !== "object" || Array.isArray(board)) return board
  const task = board.task && typeof board.task === "object" ? board.task : undefined
  return {
    ...board,
    ...(task
      ? {
          task: {
            ...task,
            orderKey: requireExplicitOrderKey(task.orderKey, `task ${String(task.id || "task")}`, "task"),
          },
        }
      : {}),
    goals: Array.isArray(board.goals)
      ? board.goals.map((goal: any) => ({
          ...goal,
          orderKey: requireExplicitOrderKey(
            goal?.orderKey,
            `goal ${String(goal?.goalID || "goal")}`,
            "board_goal",
          ),
        }))
      : board.goals,
    interactions: Array.isArray(board.interactions)
      ? board.interactions.map((interaction: any) => ({
          ...interaction,
          orderKey: requireExplicitOrderKey(
            interaction?.orderKey,
            `interaction ${String(interaction?.id || "interaction")}`,
            "interaction",
          ),
        }))
      : board.interactions,
  }
}
export function stampTestTranscript(transcript: any[]): any[] {
  return (Array.isArray(transcript) ? transcript : []).map((message) => {
    const rawInfo = message?.info || {}
    const info = { ...rawInfo, sessionAgentID: rawInfo.sessionAgentID || rawInfo.agentID }
    const messageID = String(info.id || "")
    requireMessageIdentity(info, `message ${messageID || "<unknown>"}`)
    return {
      ...message,
      info: {
        ...info,
        orderKey: requireExplicitOrderKey(info.orderKey, `message ${messageID || "<unknown>"}`, "message"),
      },
      parts: Array.isArray(message?.parts)
        ? message.parts.map((part: any) => {
            const partID = String(part?.id || "")
            return {
              ...part,
              orderKey: requireExplicitOrderKey(part.orderKey, `part ${partID || "<unknown>"}`, "part"),
            }
          })
        : message?.parts,
    }
  })
}

export function stampTestViewMessages(messages: any[]): any[] {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const messageID = String(message.messageID || "<unknown>")
    requireExplicitString(message.agentID, `view message ${messageID} agentID`)
    return {
      ...message,
      sessionAgentID: message.sessionAgentID || message.agentID,
      orderKey: requireExplicitOrderKey(message.orderKey, `view message ${messageID}`, "message"),
    }
  })
}

export function stampTestViewSessions(sessions: any[]): any[] {
  return (Array.isArray(sessions) ? sessions : []).map((session) => {
    const sessionID = String(session.sessionID || "<unknown>")
    requireExplicitString(session.agentID, `view session ${sessionID} agentID`)
    return {
      ...session,
      orderKey: requireExplicitOrderKey(session.orderKey, `view session ${sessionID}`, "session"),
    }
  })
}

export function stampTestEvent(event: any): any {
  const eventType = String(event?.type || "event")
  const base = {
    ...event,
    orderKey: requireExplicitOrderKey(event?.orderKey, `event ${eventType}`),
  }
  const props = base?.properties && typeof base.properties === "object" ? base.properties : base?.payload
  if (!props || typeof props !== "object") return base

  if (props.info && typeof props.info === "object") {
    const info = { ...props.info, sessionAgentID: props.info.sessionAgentID || props.info.agentID }
    const messageID = String(info.id || "")
    requireMessageIdentity(info, `event message ${messageID || "<unknown>"}`)
    const messageOrderKey = requireExplicitOrderKey(
      info.orderKey,
      `event message ${messageID || "<unknown>"}`,
      "message",
    )
    if (base.orderKey !== messageOrderKey) {
      throw new Error(`test fixture event ${eventType} orderKey does not match message ${messageID || "<unknown>"}`)
    }
    return {
      ...base,
      orderKey: messageOrderKey,
      properties: {
        ...props,
        info: {
          ...info,
          orderKey: messageOrderKey,
        },
      },
    }
  }

  if (props.part && typeof props.part === "object") {
    const messageID = String(props.part.messageID || "")
    const partID = String(props.part.id || "")
    const messageOrderKey = requireExplicitOrderKey(
      props.orderKey,
      `event part owner ${messageID || "<unknown>"}`,
      "message",
    )
    const partOrderKey = requireExplicitOrderKey(props.part.orderKey, `event part ${partID || "<unknown>"}`, "part")
    if (base.orderKey !== messageOrderKey) {
      throw new Error(`test fixture event ${eventType} orderKey does not match owner message ${messageID || "<unknown>"}`)
    }
    return {
      ...base,
      orderKey: messageOrderKey,
      properties: {
        ...props,
        sessionAgentID: props.sessionAgentID || props.agentID,
        orderKey: messageOrderKey,
        part: {
          ...props.part,
          orderKey: partOrderKey,
        },
      },
    }
  }

  if (props.task && typeof props.task === "object") {
    return {
      ...base,
      properties: {
        ...props,
        task: {
          ...props.task,
          orderKey: requireExplicitOrderKey(
            props.task.orderKey,
            `event task ${String(props.task.id || props.taskID || "<unknown>")}`,
            "task",
          ),
        },
      },
    }
  }

  if (eventType === "session.status" || eventType === "session.error" || eventType === "session.idle") {
    const sessionID = String(props.sessionID || "<unknown>")
    requireExplicitString(props.agentID, `${eventType} ${sessionID} agentID`)
    requireExplicitString(props.channel, `${eventType} ${sessionID} channel`)
    requireExplicitString(props.resolvedRole, `${eventType} ${sessionID} resolvedRole`)
  }

  return base
}
