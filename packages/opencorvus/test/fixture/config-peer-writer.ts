import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Database } from "@/storage/db"

const [scope, directory, encodedPatch] = process.argv.slice(2)
if ((scope !== "project" && scope !== "global") || !directory || !encodedPatch) {
  throw new Error("Config peer writer requires scope, directory and a JSON patch")
}
const patch = JSON.parse(encodedPatch)

declareNativeTaskProcessDeployment()

try {
  const config = await Instance.provide({
    directory,
    fn: () => (scope === "project" ? Config.updateProjectPatch(patch) : Config.updateGlobalPatch(patch)),
  })
  console.log(
    JSON.stringify(
      scope === "project" ? { description: config.agent?.coding?.description } : { username: config.username },
    ),
  )
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
} finally {
  await Instance.disposeAll()
  Database.close()
}
