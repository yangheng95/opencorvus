import { createStore, reconcile } from "solid-js/store"
import { loadMissions, type MissionRecord } from "./mission"
import { captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent } from "./api"

const MISSION_BOARD_PAGE_SIZE = 50

interface MissionBoardState {
  records: MissionRecord[]
  loading: boolean
  error: string
}

export const [missionBoardStore, setMissionBoardStore] = createStore<MissionBoardState>({
  records: [],
  loading: false,
  error: "",
})

let controller: AbortController | undefined
let loadSequence = 0

export function cancelMissionBoardLoad(connecting = false): void {
  loadSequence += 1
  controller?.abort()
  controller = undefined
  setMissionBoardStore({ loading: connecting, error: "" })
}

export function retireMissionBoardProjection(clear = true): void {
  cancelMissionBoardLoad()
  if (clear) setMissionBoardStore("records", [])
}

export async function reloadMissionBoard(authority = captureApiAuthority()): Promise<void> {
  assertApiAuthorityCurrent(authority)
  controller?.abort()
  const nextController = new AbortController()
  controller = nextController
  const sequence = ++loadSequence
  const owns = () => sequence === loadSequence && isApiAuthorityCurrent(authority)
  setMissionBoardStore({ loading: true, error: "" })
  try {
    const records = new Map<string, MissionRecord>()
    let cursor: { updated: number; sessionID: string } | undefined
    while (true) {
      const page = await loadMissions({
        authority,
        limit: MISSION_BOARD_PAGE_SIZE,
        cursorUpdated: cursor?.updated,
        cursorSessionID: cursor?.sessionID,
        signal: nextController.signal,
      })
      if (!owns()) return
      for (const mission of page) records.set(mission.sessionID, mission)
      if (page.length < MISSION_BOARD_PAGE_SIZE) break
      const last = page.at(-1)!
      cursor = { updated: last.updated, sessionID: last.sessionID }
    }
    setMissionBoardStore("records", reconcile([...records.values()], { key: "sessionID" }))
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    if (!owns()) return
    setMissionBoardStore("error", error instanceof Error ? error.message : String(error))
  } finally {
    if (owns()) {
      controller = undefined
      setMissionBoardStore("loading", false)
    }
  }
}
