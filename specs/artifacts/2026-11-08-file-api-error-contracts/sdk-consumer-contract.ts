import type {
  FileCopyErrors,
  FileCreateErrors,
  FileDeleteErrors,
  FileMoveErrors,
  FileStatusErrors,
  FileUploadErrors,
  FileWriteErrors,
} from "../../../packages/sdk/js/src/gen/types.gen"

export const creationConflict: FileCreateErrors[409] = {
  name: "FileConflictError",
  data: { path: "notes.txt", message: "File destination already exists: notes.txt" },
}

export function conflictPath(error: FileCreateErrors[409] | FileCopyErrors[409] | FileMoveErrors[409]): string {
  return error.data.path
}

export function invalidCreationPath(error: FileCreateErrors[400]): string {
  if ("name" in error && error.name === "FileInvalidPathError") return error.data.path
  return error.data.message
}

export function missingFilePath(error: FileDeleteErrors[404]): string {
  return error.data.path
}

export function writeConflictPath(error: FileWriteErrors[409]): string {
  return error.data.path
}

export function uploadRequestContext(error: FileUploadErrors[400]): string {
  if ("name" in error) {
    if (error.name === "FileUploadInvalidTargetError") return error.data.targetDir
    return error.data.name
  }
  return error.data.message
}

export function fileStatusMessage(error: FileStatusErrors[500]): string {
  if (error.name === "GitSourceEnumerationError") return `${error.data.reason}: ${error.data.path}`
  return error.data.message
}
