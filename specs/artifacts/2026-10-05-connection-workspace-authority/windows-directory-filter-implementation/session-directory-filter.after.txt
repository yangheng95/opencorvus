import { Project } from "../project/project"
import { Filesystem } from "../util/filesystem"
import { eq, inArray, type Database, type SQL } from "../storage/db"
import { SessionTable } from "./session.sql"

/** Match lexical directory variants through the existing Project primitive,
 * then bind actual saved values before the caller's ordering and pagination.
 * The caller owns the read transaction shared with its final query. */
export function sessionDirectoryFilterCondition(
  db: Database.TxOrDb,
  directory?: string,
  projectID?: string,
): SQL | undefined {
  if (!directory) return undefined
  const resolved = Filesystem.resolve(directory)
  const values = db.selectDistinct({ directory: SessionTable.directory })
    .from(SessionTable)
    .where(projectID ? eq(SessionTable.project_id, projectID) : undefined)
    .all()
    .filter((row) => Project.samePath(row.directory, resolved))
    .map((row) => row.directory)
  return inArray(SessionTable.directory, values)
}
