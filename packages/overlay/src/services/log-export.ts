import { downloadZipArchive } from "./project-archive"

export function downloadLogSupportBundle(): Promise<boolean> {
  return downloadZipArchive({ path: "log/export" })
}
