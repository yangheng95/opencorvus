import { DurablePublicationStore, setDurablePublicationTestCutHook } from "@opencorvus-ai/util/durable-publication"

const [root, action, requestedCut] = process.argv.slice(2)
if (!root || !action) throw new Error("usage: durable-publication-child <root> <action> [cut]")

const occurrenceID = "occurrence-crash-proof"
const kind = "test-publication"
const subject = "catalog:crash-proof"
const store = new DurablePublicationStore(root)

const create = () => store.create({ occurrenceID, kind, subject, payload: { generation: "a" }, timeCreated: 1 })
const phase = () =>
  store.appendPhase(kind, {
    occurrenceID,
    sequence: 1,
    name: "prepared",
    payload: { digest: "a".repeat(64) },
    timeCreated: 2,
  })
const terminal = () =>
  store.settle(kind, {
    occurrenceID,
    outcome: "committed",
    payload: { generation: "a" },
    timeCreated: 3,
  })

if (action !== "intent") await create()
if (action === "terminal") await phase()

setDurablePublicationTestCutHook((cut) => {
  if (cut !== requestedCut) return
  process.kill(process.pid, "SIGKILL")
})

if (action === "intent") await create()
else if (action === "phase") await phase()
else if (action === "terminal") await terminal()
else throw new Error(`unknown action: ${action}`)
