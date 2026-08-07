import { createHash, randomUUID } from "node:crypto"
import { PNG } from "pngjs"
import { ComputerError } from "./errors"
import type { ComputerBackend, ComputerBackendAction, ComputerBackendActionInput, ComputerPoint } from "./backend"

export type ComputerObservation = {
  computerId: string
  displayId: string
  observationId: string
  observationDigest: string
  width: number
  height: number
  pngBase64: string
}

type Session = {
  computerId: string
  displayId: string
  latestObservation?: ComputerObservation
}

export type ObservationBinding = {
  computerId: string
  displayId: string
  observationId: string
  observationDigest: string
}

export class ComputerController {
  private readonly sessions = new Map<string, Session>()

  constructor(private readonly backend: ComputerBackend) {}

  async create() {
    const created = await this.backend.create()
    this.sessions.set(created.computerId, {
      computerId: created.computerId,
      displayId: created.displayId,
    })
    return created
  }

  private session(computerId: string): Session {
    const session = this.sessions.get(computerId)
    if (!session) {
      throw new ComputerError("COMPUTER_SESSION_NOT_FOUND", "Computer session does not exist", { computerId })
    }
    return session
  }

  async observe(input: { computerId: string; displayId: string }): Promise<ComputerObservation> {
    const session = this.session(input.computerId)
    this.assertDisplay(session, input.displayId)
    const observed = await this.backend.observe(input)
    if (observed.computerId !== session.computerId || observed.displayId !== session.displayId) {
      throw new ComputerError(
        "COMPUTER_SESSION_IDENTITY_MISMATCH",
        "Computer backend returned a different target identity",
        { expected: session, actual: { computerId: observed.computerId, displayId: observed.displayId } },
      )
    }
    const bytes = Buffer.from(observed.pngBase64, "base64")
    let image: PNG
    try {
      image = PNG.sync.read(bytes)
    } catch (error) {
      throw new ComputerError(
        "COMPUTER_BACKEND_ERROR",
        "Computer backend returned an invalid PNG observation",
        {},
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    const observationId = randomUUID()
    const observationDigest = createHash("sha256")
      .update(session.computerId)
      .update("\0")
      .update(session.displayId)
      .update("\0")
      .update(observationId)
      .update("\0")
      .update(String(image.width))
      .update("x")
      .update(String(image.height))
      .update("\0")
      .update(bytes)
      .digest("hex")
    const observation = {
      computerId: session.computerId,
      displayId: session.displayId,
      observationId,
      observationDigest,
      width: image.width,
      height: image.height,
      pngBase64: observed.pngBase64,
    }
    session.latestObservation = observation
    return observation
  }

  private assertDisplay(session: Session, displayId: string) {
    if (session.displayId !== displayId) {
      throw new ComputerError("COMPUTER_SESSION_IDENTITY_MISMATCH", "Computer display identity does not match", {
        computerId: session.computerId,
        expectedDisplayId: session.displayId,
        actualDisplayId: displayId,
      })
    }
  }

  private observation(binding: ObservationBinding): ComputerObservation {
    const session = this.session(binding.computerId)
    this.assertDisplay(session, binding.displayId)
    const observation = session.latestObservation
    if (
      !observation ||
      observation.observationId !== binding.observationId ||
      observation.observationDigest !== binding.observationDigest
    ) {
      throw new ComputerError("STALE_OBSERVATION", "Computer action is not bound to the latest exact observation", {
        computerId: binding.computerId,
        displayId: binding.displayId,
        suppliedObservationId: binding.observationId,
        latestObservationId: observation?.observationId,
      })
    }
    return observation
  }

  private consumeObservation(session: Session, observation: ComputerObservation) {
    if (session.latestObservation !== observation) {
      throw new ComputerError("STALE_OBSERVATION", "Computer observation was already consumed", {
        computerId: observation.computerId,
        displayId: observation.displayId,
        suppliedObservationId: observation.observationId,
        latestObservationId: session.latestObservation?.observationId,
      })
    }
    delete session.latestObservation
  }

  private point(observation: ComputerObservation, point: ComputerPoint, label: string) {
    if (
      !Number.isInteger(point.x) ||
      !Number.isInteger(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x >= observation.width ||
      point.y >= observation.height
    ) {
      throw new ComputerError("COMPUTER_INPUT_OUT_OF_BOUNDS", `Computer ${label} is outside the observed display`, {
        point,
        width: observation.width,
        height: observation.height,
      })
    }
  }

  async act(binding: ObservationBinding, action: ComputerBackendActionInput) {
    const observation = this.observation(binding)
    const session = this.session(binding.computerId)
    if (action.kind === "click") this.point(observation, { x: action.x, y: action.y }, "click point")
    if (action.kind === "scroll") this.point(observation, { x: action.x, y: action.y }, "scroll point")
    if (action.kind === "drag") {
      this.point(observation, action.from, "drag start")
      this.point(observation, action.to, "drag end")
    }
    this.consumeObservation(session, observation)
    const effect = await this.backend.act({
      ...action,
      computerId: binding.computerId,
      displayId: binding.displayId,
    } as ComputerBackendAction)
    return {
      computerId: binding.computerId,
      displayId: binding.displayId,
      observationId: binding.observationId,
      observationDigest: binding.observationDigest,
      ...effect,
    }
  }

  async destroy(input: { computerId: string }) {
    this.session(input.computerId)
    const result = await this.backend.destroy(input)
    this.sessions.delete(input.computerId)
    return { computerId: input.computerId, ...result }
  }

  async close() {
    await this.backend.close()
    this.sessions.clear()
  }
}
