export interface BrowserRecordMutation<RecordValue, Result> {
  records: RecordValue
  value: Result
}

export interface BrowserRecord<RecordValue> {
  read(): Promise<RecordValue>
  write<Result>(
    mutate: (records: RecordValue) => BrowserRecordMutation<RecordValue, Result>,
  ): Promise<BrowserRecordMutation<RecordValue, Result>>
  close(): void
}

export function openBrowserRecord<RecordValue>(options: {
  name: string
  store: string
  key: string
  migration: { read: () => RecordValue; retire: () => void }
  upgrade?: { version: number; migrate: (records: RecordValue) => RecordValue }
}): Promise<BrowserRecord<RecordValue>> {
  const { name, store, key, migration, upgrade } = options
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, upgrade?.version ?? 1)
    request.onupgradeneeded = ({ oldVersion }) => {
      const abort = (error: unknown) => {
        request.transaction?.abort()
        reject(error)
      }
      try {
        const objectStore = oldVersion === 0
          ? request.result.createObjectStore(store)
          : request.transaction!.objectStore(store)
        const writeMigrated = (read: () => RecordValue) => {
          try {
            const records = read()
            objectStore.put(upgrade ? upgrade.migrate(records) : records, key)
          } catch (error) {
            abort(error)
          }
        }
        if (oldVersion === 0) {
          writeMigrated(migration.read)
        } else {
          const read = objectStore.get(key)
          read.onsuccess = () => writeMigrated(() => read.result)
        }
      } catch (error) {
        abort(error)
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      migration.retire()
      resolve({
        read: () => readBrowserRecord(database, store, key),
        write: (mutate) => writeBrowserRecord(database, store, key, mutate),
        close: () => database.close(),
      })
    }
  })
}

function readBrowserRecord<RecordValue>(database: IDBDatabase, store: string, key: string): Promise<RecordValue> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function writeBrowserRecord<RecordValue, Result>(
  database: IDBDatabase,
  storeName: string,
  key: string,
  mutate: (records: RecordValue) => BrowserRecordMutation<RecordValue, Result>,
): Promise<BrowserRecordMutation<RecordValue, Result>> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)
    const request = store.get(key)
    let outcome: BrowserRecordMutation<RecordValue, Result>
    transaction.onabort = () => reject(transaction.error ?? new DOMException("Browser storage transaction aborted", "AbortError"))
    transaction.oncomplete = () => resolve(outcome)
    request.onsuccess = () => {
      try {
        const records: RecordValue = request.result
        outcome = mutate(records)
        if (outcome.records !== records) store.put(outcome.records, key)
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    }
  })
}
