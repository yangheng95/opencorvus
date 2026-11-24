import type { ComposerDraftRecords } from "./composer-draft"

const DATABASE_NAME = "opencorvus-composer-drafts"
const STORE_NAME = "drafts"
const RECORDS_KEY = "records"

export interface DraftMutationResult<T> {
  records: ComposerDraftRecords
  value: T
}

export type DraftMutation<T> = (records: ComposerDraftRecords) => DraftMutationResult<T>

export function openComposerDraftDatabase(migration: {
  read: () => ComposerDraftRecords
  retire: () => void
}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      try {
        const store = request.result.createObjectStore(STORE_NAME)
        store.put(migration.read(), RECORDS_KEY)
      } catch (error) {
        request.transaction?.abort()
        reject(error)
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      migration.retire()
      resolve(database)
    }
  })
}

export function readComposerDraftDatabase(database: IDBDatabase): Promise<ComposerDraftRecords> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(RECORDS_KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export function writeComposerDraftDatabase<T>(
  database: IDBDatabase,
  mutate: DraftMutation<T>,
): Promise<DraftMutationResult<T>> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(RECORDS_KEY)
    let outcome: DraftMutationResult<T>
    transaction.onabort = () => reject(transaction.error ?? new DOMException("Draft transaction aborted", "AbortError"))
    transaction.oncomplete = () => resolve(outcome)
    request.onsuccess = () => {
      try {
        const records: ComposerDraftRecords = request.result
        outcome = mutate(records)
        if (outcome.records !== records) store.put(outcome.records, RECORDS_KEY)
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    }
  })
}
