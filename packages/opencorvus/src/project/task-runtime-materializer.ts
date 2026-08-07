import fs from "node:fs/promises"

import { ProjectRuntimePaths } from "@/project/runtime-paths"

export namespace TaskRuntimeMaterializer {
  export async function webpageEvidenceDir(projectDir: string, taskID: string): Promise<string> {
    const paths = ProjectRuntimePaths.webpageEvidencePaths(projectDir, taskID)
    await fs.mkdir(paths.absolute, { recursive: true })
    return paths.absolute
  }
}
