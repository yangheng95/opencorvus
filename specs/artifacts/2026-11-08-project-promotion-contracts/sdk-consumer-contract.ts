import type { ProjectCurrentPromoteAnonymousErrors } from "../../../packages/sdk/js/src/gen/types.gen"

export function inputReason(error: ProjectCurrentPromoteAnonymousErrors[400]): string {
  if ("name" in error) return `${error.data.sourceDirectory}: ${error.data.reason}`
  return error.data.message
}

export function conflictContext(error: ProjectCurrentPromoteAnonymousErrors[409]): string {
  switch (error.name) {
    case "OwnedPromptControllersError": return error.data.operation
    case "ProjectRegisteredDirectoryConflictError": return `${error.data.directory}: ${error.data.projectIDs.join(",")}`
    case "ProjectDurableAdmissionClosedError": return error.data.projectID
  }
}

export function failureContext(error: ProjectCurrentPromoteAnonymousErrors[500]): string {
  if (error.name === "ProjectDirectoryAdmissionClosedError") {
    return `${error.data.directory}: ${error.data.operationID}: ${error.data.kind}`
  }
  return error.data.message
}
