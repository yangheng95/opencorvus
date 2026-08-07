import { ProjectGC } from "../../../project/gc"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

export const GcCommand = cmd({
  command: "gc",
  describe: "garbage-collect orphan snapshot and session_diff cache directories",
  builder: (yargs) =>
    yargs
      .option("apply", {
        type: "boolean",
        default: false,
        description: "actually delete; default is dry-run",
      }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const plan = await ProjectGC.inspect()
      console.log("[plan]")
      console.log("  orphan snapshot dirs       :", plan.orphanSnapshots.length)
      for (const id of plan.orphanSnapshots) console.log("    -", id)
      console.log("  orphan session_diff dirs   :", plan.orphanSessionDiffs.length)
      for (const id of plan.orphanSessionDiffs) console.log("    -", id)

      if (!args.apply) {
        console.log()
        console.log("[dry-run] pass --apply to delete everything listed above.")
        return
      }

      const result = await ProjectGC.apply(plan)
      console.log("[applied]")
      console.log("  removed snapshot dirs     :", result.removedSnapshotDirs)
      console.log("  removed session_diff dirs :", result.removedSessionDiffDirs)
      console.log("  vacuumed                  :", result.vacuumed)
    })
  },
})
