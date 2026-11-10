import { batch } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { loadMissions, type MissionRecord } from "./mission"
import { captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent } from "./api"

const MISSION_BOARD_PAGE_SIZE = 50

interface MissionBoardState {
  records: MissionRecord[]
  accepted: boolean
  loading: boolean
  error: { cause: unknown } | undefined
}

export const [missionBoardStore, setMissionBoardStore] = createStore<MissionBoardState>({
  records: [],
  accepted: false,
  loading: false,
  error: undefined,
})

let controller: AbortController | undefined
let loadSequence = 0

export function cancelMissionBoardLoad(connecting = false): void {
  loadSequence += 1
  controller?.abort()
  controller = undefined
  setMissionBoardStore({ loading: connecting, error: undefined })
}

export function retireMissionBoardProjection(clear = true): void {
  batch(() => {
    cancelMissionBoardLoad()
    if (clear) setMissionBoardStore({ records: [], accepted: false })
  })
}

/** Whether this read published a complete current list. */
export async function reloadMissionBoard(authority = captureApiAuthority()): Promise<boolean> {
  assertApiAuthorityCurrent(authority)
  controller?.abort()
  const nextController = new AbortController()
  controller = nextController
  const sequence = ++loadSequence
  const owns = () => sequence === loadSequence && isApiAuthorityCurrent(authority)
  setMissionBoardStore("loading", true)
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
      if (!owns()) return false
      for (const mission of page) records.set(mission.sessionID, mission)
      if (page.length < MISSION_BOARD_PAGE_SIZE) break
      const last = page.at(-1)!
      cursor = { updated: last.updated, sessionID: last.sessionID }
    }
    batch(() => {
      setMissionBoardStore("records", reconcile([...records.values()], { key: "sessionID" }))
      setMissionBoardStore({ accepted: true, error: undefined })
    })
    return true
  } catch (error) {
    if (owns() && !(error instanceof DOMException && error.name === "AbortError")) {
      setMissionBoardStore("error", { cause: error })
    }
    return false
  } finally {
    if (owns()) {
      controller = undefined
      setMissionBoardStore("loading", false)
    }
  }
}
