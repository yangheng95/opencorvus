import { Project } from "@/project/project"
import { NotFoundError } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { Context } from "@/util/context"

type PersistedProjectBinding = {
  project: Project.Info
  directory: string
}

const binding = Context.create<PersistedProjectBinding>("persisted-project")

export namespace PersistedProjectContext {
  export function provide<R>(input: { directory: string; fn: () => R }): R {
    const directory = Filesystem.resolve(input.directory)
    const registered = Project.findByRegisteredDirectory(directory)
    if (!registered) throw new NotFoundError({ message: `Project not found: ${directory}` })
    return binding.provide({ project: registered.project, directory: registered.directory }, input.fn)
  }

  export function use(): PersistedProjectBinding {
    return binding.use()
  }

  export function currentProject(): Project.Info {
    return use().project
  }

  export function currentDirectory(): string {
    return use().directory
  }
}
