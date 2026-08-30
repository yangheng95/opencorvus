export class PersistedWakeReplay extends Error {
  constructor(
    readonly sessionID: string,
    readonly messageID: string,
  ) {
    super(`Reuse persisted wake Message ${messageID}`)
    this.name = "PersistedWakeReplay"
  }
}
