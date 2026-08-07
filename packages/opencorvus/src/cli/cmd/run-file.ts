import { Filesystem } from "@/util/filesystem"

const DIRECTORY_MIME = "application/x-directory"

/** Preserve the real Multipurpose Internet Mail Extensions (MIME) type for a file passed to `opencorvus run`. */
export async function runFileMime(resolvedPath: string): Promise<string> {
  if (await Filesystem.isDir(resolvedPath)) return DIRECTORY_MIME
  return Filesystem.mimeType(resolvedPath)
}
