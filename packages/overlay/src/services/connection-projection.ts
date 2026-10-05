import {
  retireBoardRequests,
  retireTaskListRequests,
  boardStore,
  setBoardStore,
  loadBoard,
  rootTaskSessionID,
} from "../store/board"
import { retireMetaProjection } from "./meta"
import { retireConversationSessionProjection } from "./conversation-session"
import { retireMissionBoardProjection } from "./mission-board"
import { retireWorkLedgerProjection } from "./work-ledger"
import { retireConversationSource } from "./conversation"
import { retireMcpAppEventStreams } from "./interactive-artifact"
import { retireSelectedTaskRecovery } from "./selected-task-recovery"
import { retireEventProjection } from "./events"
import { stopSSE, stopWorkLedgerSSE, startSSE, startWorkLedgerSSE } from "./sse"
import { retireChatRequestProjection } from "./chat"
import { retireGlobalComposerReferences } from "./global-composer-references"
import { retireExpertSquadProjection } from "./expert-squad"
import { captureApiAuthority, isApiAuthorityCurrent } from "./api"
import { activeProjectDirectory } from "./project-directory"
import { reloadProjectScope } from "./config"
import { loadConversation } from "./conversation"
import { projectComposerModelFromSession, restoreDraftComposerModel } from "./composer-model"

/** Retire existing owners before publishing changed transport credentials. */
export function retireConnectionProjections(clear: boolean): void {
  retireChatRequestProjection()
  retireGlobalComposerReferences()
  retireExpertSquadProjection()
  retireSelectedTaskRecovery()
  retireEventProjection()
  stopSSE()
  stopWorkLedgerSSE()
  retireBoardRequests()
  retireTaskListRequests()
  retireMetaProjection(clear)
  retireConversationSessionProjection(clear)
  retireMissionBoardProjection(clear)
  retireConversationSource(clear)
  retireMcpAppEventStreams()
  if (clear) retireWorkLedgerProjection()
}

/** Rebind the existing selected view after scope-preserving reauthentication. */
export async function refreshConnectionWorkspace(authority = captureApiAuthority()): Promise<void> {
  if (!isApiAuthorityCurrent(authority)) return
  const source = boardStore.selectedSource
  const epoch = boardStore.selectEpoch
  const directory = activeProjectDirectory()
  const owns = () =>
    isApiAuthorityCurrent(authority) && epoch === boardStore.selectEpoch && boardStore.selectedSource === source
  setBoardStore("taskSwitching", !!source)
  try {
    startWorkLedgerSSE()
    await reloadProjectScope({ authority, restoreWorkspace: false })
    if (!owns()) return
    if (!source) {
      restoreDraftComposerModel()
      return
    }
    if (source.kind === "task") await loadBoard({ authority, requireFresh: true })
    if (!owns()) return
    const sequence = await loadConversation(source, {
      authority,
      directory,
      scrollIntent: "preserve",
      resetCause: "connection-rebind",
    })
    if (!owns()) return
    const sessionID = source.kind === "session" ? source.id : rootTaskSessionID()
    if (sessionID) await projectComposerModelFromSession({ sessionID, directory, authority }, owns)
    if (owns()) startSSE(source, sequence, { authority, directory })
  } finally {
    if (owns()) setBoardStore("taskSwitching", false)
  }
}
