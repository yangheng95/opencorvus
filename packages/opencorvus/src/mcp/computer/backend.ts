import { randomUUID } from "node:crypto"
import type { CuaDriverLike, ToolResult } from "@trycua/cua-driver"
import { z } from "zod"
import { ComputerError, computerError } from "./errors"

export type ComputerPoint = { x: number; y: number }
export type ComputerBackendObservation = {
  computerId: string
  displayId: string
  pngBase64: string
}

export type ComputerBackendAction =
  | { kind: "click"; computerId: string; displayId: string; x: number; y: number; button: "left" | "right" }
  | { kind: "type_text"; computerId: string; displayId: string; text: string }
  | { kind: "keypress"; computerId: string; displayId: string; keys: string[] }
  | {
      kind: "scroll"
      computerId: string
      displayId: string
      x: number
      y: number
      direction: "up" | "down" | "left" | "right"
      amount: number
    }
  | { kind: "drag"; computerId: string; displayId: string; from: ComputerPoint; to: ComputerPoint; durationMs: number }

export type ComputerBackendActionInput = ComputerBackendAction extends infer Action
  ? Action extends ComputerBackendAction
    ? Omit<Action, "computerId" | "displayId">
    : never
  : never

export interface ComputerBackend {
  create(): Promise<{ computerId: string; displayId: string; driverVersion: string }>
  observe(input: { computerId: string; displayId: string }): Promise<ComputerBackendObservation>
  act(action: ComputerBackendAction): Promise<{ accepted: true; backendActionId: string }>
  destroy(input: { computerId: string }): Promise<{ destroyed: true }>
  close(): Promise<void>
}

const DesktopState = z
  .object({
    display: z.string().min(1),
    platform: z.string().min(1),
    screen_width: z.number().int().positive(),
    screen_height: z.number().int().positive(),
    screenshot_width: z.number().int().positive(),
    screenshot_height: z.number().int().positive(),
    screenshot_mime_type: z.literal("image/png"),
  })
  .passthrough()

function toolFailure(operation: string, result: ToolResult): ComputerError {
  return new ComputerError("COMPUTER_BACKEND_ERROR", result.text || `CUA Driver ${operation} failed`, {
    operation,
    driverErrorCode: result.errorCode,
    degraded: result.degraded,
  })
}

function assertToolResult(operation: string, result: ToolResult): ToolResult {
  if (result.isError) throw toolFailure(operation, result)
  return result
}

type CuaSdk = typeof import("@trycua/cua-driver")
type OwnedCuaDriver = CuaDriverLike & { uniffiDestroy(): void }

function loadCuaSdk(): Promise<CuaSdk> {
  return import("@trycua/cua-driver")
}

export async function createCuaDriver(): Promise<CuaDriverLike> {
  const sdk = await loadCuaSdk()
  const driver = sdk.CuaDriver.create(sdk.DriverOptions.new({ claudeCodeCompatibility: false }))
  if (!driver.isAvailable()) {
    ;(driver as OwnedCuaDriver).uniffiDestroy()
    throw new ComputerError("COMPUTER_BACKEND_ERROR", "The bundled CUA Driver is unavailable on this host")
  }
  return driver
}

export async function closeCuaDriver(driverInput: CuaDriverLike | Promise<CuaDriverLike>): Promise<void> {
  const driver = await driverInput
  try {
    await driver.shutdown()
  } finally {
    ;(driver as OwnedCuaDriver).uniffiDestroy()
  }
}

export class CuaComputerBackend implements ComputerBackend {
  private readonly driverSession = `opencorvus-${randomUUID()}`
  private identity?: { computerId: string; displayId: string; driverVersion: string }
  private ended = false

  constructor(private readonly driverInput: CuaDriverLike | Promise<CuaDriverLike>) {}

  private driver() {
    return Promise.resolve(this.driverInput)
  }

  async create() {
    if (this.identity) return this.identity
    const [driver, sdk] = await Promise.all([this.driver(), loadCuaSdk()])
    let started
    try {
      started = await driver.startSession(
        sdk.StartSessionInput.new({ session: this.driverSession, captureScope: sdk.CaptureScope.Desktop }),
      )
    } catch (error) {
      throw new ComputerError(
        "COMPUTER_OUTCOME_UNKNOWN",
        "CUA Driver session creation did not return a result",
        { operation: "session_create" },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    if (!started.active || !started.state.desktopUnlocked || started.state.session !== this.driverSession) {
      await this.endDriverSession()
      throw new ComputerError("COMPUTER_BACKEND_ERROR", "The host desktop is unavailable for Computer Use", {
        active: started.active,
        desktopUnlocked: started.state.desktopUnlocked,
        expectedSession: this.driverSession,
        actualSession: started.state.session,
      })
    }
    try {
      const metadata = await driver.metadata()
      const desktop = assertToolResult(
        "get_desktop_state",
        await driver.getDesktopState(sdk.GetDesktopStateInput.new({ session: this.driverSession })),
      )
      const state = DesktopState.parse(JSON.parse(desktop.structuredJson ?? "{}"))
      this.identity = {
        computerId: `host-desktop:${this.driverSession}`,
        displayId: state.display,
        driverVersion: metadata.driverVersion,
      }
      return this.identity
    } catch (error) {
      try {
        await this.endDriverSession()
      } catch (cleanupError) {
        throw computerError(new AggregateError([error, cleanupError], "CUA Driver session startup cleanup failed"))
      }
      throw error
    }
  }

  private assertIdentity(input: { computerId: string; displayId?: string }) {
    if (!this.identity || this.identity.computerId !== input.computerId) {
      throw new ComputerError("COMPUTER_SESSION_NOT_FOUND", "Computer session does not exist", {
        computerId: input.computerId,
      })
    }
    if (input.displayId !== undefined && this.identity.displayId !== input.displayId) {
      throw new ComputerError("COMPUTER_SESSION_IDENTITY_MISMATCH", "Computer display identity does not match", {
        computerId: input.computerId,
        expectedDisplayId: this.identity.displayId,
        actualDisplayId: input.displayId,
      })
    }
  }

  async observe(input: { computerId: string; displayId: string }) {
    this.assertIdentity(input)
    const [driver, sdk] = await Promise.all([this.driver(), loadCuaSdk()])
    const result = assertToolResult(
      "get_desktop_state",
      await driver.getDesktopState(sdk.GetDesktopStateInput.new({ session: this.driverSession })),
    )
    const image = result.images.find((candidate) => candidate.mimeType === "image/png")
    if (!image) {
      throw new ComputerError("COMPUTER_BACKEND_ERROR", "CUA Driver returned no PNG desktop observation")
    }
    return { computerId: input.computerId, displayId: input.displayId, pngBase64: image.dataBase64 }
  }

  async act(action: ComputerBackendAction) {
    this.assertIdentity(action)
    let result: ToolResult
    try {
      result = await this.performAction(action)
    } catch (error) {
      if (error instanceof ComputerError) throw error
      throw new ComputerError(
        "COMPUTER_OUTCOME_UNKNOWN",
        "CUA Driver action did not return a result",
        { operation: action.kind },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    assertToolResult(action.kind, result)
    return { accepted: true as const, backendActionId: randomUUID() }
  }

  private performAction(action: ComputerBackendAction): Promise<ToolResult> {
    return Promise.all([this.driver(), loadCuaSdk()]).then(([driver, sdk]) => this.dispatchAction(driver, sdk, action))
  }

  private dispatchAction(driver: CuaDriverLike, sdk: CuaSdk, action: ComputerBackendAction): Promise<ToolResult> {
    const scope = sdk.DesktopScope.Desktop
    if (action.kind === "click") {
      return driver.click(
        sdk.ClickInput.new({
          x: action.x,
          y: action.y,
          scope,
          session: this.driverSession,
          button: action.button === "left" ? sdk.ClickButton.Left : sdk.ClickButton.Right,
          count: 1,
        }),
      )
    }
    if (action.kind === "type_text") {
      return driver.typeText(sdk.TypeTextInput.new({ text: action.text, scope, session: this.driverSession }))
    }
    if (action.kind === "keypress") {
      if (action.keys.length === 1) {
        return driver.pressKey(sdk.PressKeyInput.new({ key: action.keys[0]!, scope, session: this.driverSession }))
      }
      return driver.hotkey(sdk.HotkeyInput.new({ keys: action.keys, scope, session: this.driverSession }))
    }
    if (action.kind === "scroll") {
      const direction = {
        up: sdk.ScrollDirection.Up,
        down: sdk.ScrollDirection.Down,
        left: sdk.ScrollDirection.Left,
        right: sdk.ScrollDirection.Right,
      }[action.direction]
      return driver.scroll(
        sdk.ScrollInput.new({
          x: action.x,
          y: action.y,
          direction,
          scope,
          session: this.driverSession,
          by: sdk.ScrollBy.Line,
          amount: BigInt(action.amount),
        }),
      )
    }
    return driver.drag(
      sdk.DragInput.new({
        fromX: action.from.x,
        fromY: action.from.y,
        toX: action.to.x,
        toY: action.to.y,
        scope,
        session: this.driverSession,
        durationMs: BigInt(action.durationMs),
        button: sdk.ClickButton.Left,
      }),
    )
  }

  private async endDriverSession() {
    if (this.ended) return
    this.ended = true
    const [driver, sdk] = await Promise.all([this.driver(), loadCuaSdk()])
    await driver.endSession(sdk.EndSessionInput.new({ session: this.driverSession }))
  }

  async destroy(input: { computerId: string }) {
    this.assertIdentity(input)
    try {
      await this.endDriverSession()
    } catch (error) {
      throw new ComputerError(
        "COMPUTER_OUTCOME_UNKNOWN",
        "CUA Driver session destruction did not return a result",
        { operation: "session_destroy", computerId: input.computerId },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    delete this.identity
    return { destroyed: true as const }
  }

  async close() {
    if (this.identity) await this.endDriverSession()
    delete this.identity
  }
}
