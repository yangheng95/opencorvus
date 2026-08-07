import { createStore, reconcile } from "solid-js/store"
import { loadMissions, type MissionRecord } from "./mission"

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

export async function reloadMissionBoard(): Promise<void> {
  controller?.abort()
  const nextController = new AbortController()
  controller = nextController
  const sequence = ++loadSequence
  setMissionBoardStore({ loading: true, error: "" })
  try {
    const records = new Map<string, MissionRecord>()
    let cursor: { updated: number; sessionID: string } | undefined
    while (true) {
      const page = await loadMissions({
        limit: MISSION_BOARD_PAGE_SIZE,
        cursorUpdated: cursor?.updated,
        cursorSessionID: cursor?.sessionID,
        signal: nextController.signal,
      })
      if (sequence !== loadSequence) return
      for (const mission of page) records.set(mission.sessionID, mission)
      if (page.length < MISSION_BOARD_PAGE_SIZE) break
      const last = page.at(-1)!
      cursor = { updated: last.updated, sessionID: last.sessionID }
    }
    setMissionBoardStore("records", reconcile([...records.values()], { key: "sessionID" }))
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    if (sequence !== loadSequence) return
    setMissionBoardStore("error", error instanceof Error ? error.message : String(error))
  } finally {
    if (sequence === loadSequence) {
      controller = undefined
      setMissionBoardStore("loading", false)
    }
  }
}
