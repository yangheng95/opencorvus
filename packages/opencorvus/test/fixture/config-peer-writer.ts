import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Database } from "@/storage/db"

const [scope, directory, value] = process.argv.slice(2)
if ((scope !== "project" && scope !== "global") || !directory || !value) {
  throw new Error("Config peer writer requires scope, directory and value")
}

declareNativeTaskProcessDeployment()

try {
  const config = await Instance.provide({
    directory,
    fn: () =>
      scope === "project"
        ? Config.updateProjectPatch({ agent: { coding: { description: value } } })
        : Config.updateGlobalPatch({ username: value }),
  })
  console.log(
    JSON.stringify(
      scope === "project" ? { description: config.agent?.coding?.description } : { username: config.username },
    ),
  )
  await Instance.disposeAll()
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
