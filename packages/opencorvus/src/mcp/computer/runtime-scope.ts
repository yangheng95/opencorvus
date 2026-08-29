export function computerRuntimeScopeIdentity(input: {
  ownerKind: "session" | "orchestrator" | "worker"
  sessionID: string
  taskID?: string
}): string {
  const sessionID = input.sessionID.trim()
  if (!sessionID) throw new Error("Computer runtime scope requires a non-empty Session identity")
  if (input.ownerKind === "session") return `session:${sessionID}:computer`
  const taskID = input.taskID?.trim()
  if (!taskID) throw new Error(`Computer runtime ${input.ownerKind} scope requires a non-empty Task identity`)
  return `${input.ownerKind}:${taskID}:${sessionID}`
}
