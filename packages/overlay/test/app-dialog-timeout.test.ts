import { afterEach, describe, expect, test } from "bun:test"
import enUS from "../src/i18n/en-US.json"
import { dialogStore, setDialogStore } from "../src/store/dialog"
import { setLocaleData } from "../src/utils/i18n"

setLocaleData("en-US", enUS)

const { dismissAppDialog, settleAppDialog, showAppDialog } = await import("../src/services/app-dialog")
const { registerNativeSurfaceOcclusionHooks } = await import("../src/services/native-surface-occlusion")
const { nativeSelect } = await import("../src/utils/native")

async function flushDialogTransition(): Promise<void> {
  // App-dialog and native-surface ownership each serialize their own Promise
  // tail. Yield one host turn so both queues can publish their settled state.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

afterEach(async () => {
  await dismissAppDialog()
  setDialogStore("config", "open", false)
})

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function rejectionOutcome(promise: Promise<unknown>): Promise<{ rejected: boolean; error?: unknown }> {
  return promise.then(
    () => ({ rejected: false }),
    (error) => ({ rejected: true, error }),
  )
}

describe("app dialog choice value authority", () => {
  test("select dialogs reject missing selectValue before opening", () => {
    expect(() =>
      showAppDialog({
        title: "Pick",
        message: "Pick one",
        select: true,
        selectOptions: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      }),
    ).toThrow("requires selectValue")
    expect(dialogStore.app.open).toBe(false)
  })

  test("select dialogs reject values outside selectOptions before opening", () => {
    expect(() =>
      showAppDialog({
        title: "Pick",
        message: "Pick one",
        select: true,
        selectValue: "c",
        selectOptions: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      }),
    ).toThrow("is not in selectOptions")
    expect(dialogStore.app.open).toBe(false)
  })

  test("select dialogs settle the same value shown by the store", async () => {
    const result = showAppDialog({
      title: "Pick",
      message: "Pick one",
      select: true,
      inputLabel: "Input",
      selectLabel: "Choice",
      selectValue: "b",
      okLabel: "OK",
      cancelLabel: "Cancel",
      selectOptions: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    })
    await flushDialogTransition()
    expect(dialogStore.app.selectValue).toBe("b")
    await settleAppDialog(true, dialogStore.app.epoch)
    await expect(result).resolves.toEqual({ confirmed: true, value: "b" })
  })

  test("nativeSelect requires its caller to provide an explicit valid value", async () => {
    await expect(
      nativeSelect("Pick one", {
        title: "Pick",
        selectLabel: "Choice",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      } as any),
    ).rejects.toThrow("requires selectValue")
    await expect(
      nativeSelect("Pick one", {
        title: "Pick",
        selectLabel: "Choice",
        selectValue: "c",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      }),
    ).rejects.toThrow("is not in options")
    expect(dialogStore.app.open).toBe(false)
  })

  test("opening a new dialog resolves the previous select dialog as cancelled", async () => {
    const first = showAppDialog({
      title: "Queue",
      message: "Queue?",
      select: true,
      inputLabel: "Input",
      selectLabel: "Choice",
      okLabel: "OK",
      cancelLabel: "Cancel",
      selectValue: "start",
      selectOptions: [
        { value: "start", label: "Start" },
        { value: "queue", label: "Queue" },
      ],
    })

    const second = showAppDialog({
      title: "Next",
      message: "Next",
      inputLabel: "Input",
      selectLabel: "Choice",
      okLabel: "OK",
      cancelLabel: "Cancel",
    })

    await expect(first).resolves.toEqual({ confirmed: false, value: null })
    await flushDialogTransition()
    await settleAppDialog(true, dialogStore.app.epoch)
    await expect(second).resolves.toEqual({ confirmed: true, value: null })
  })

  test("cancelling leaves an already-mounted config owner and tab unchanged", async () => {
    setDialogStore("config", { open: true, activeTab: "expert-squad" })
    const result = showAppDialog({ title: "Uninstall", cancel: true })
    await flushDialogTransition()

    expect(dialogStore.app.open).toBe(true)
    expect(dialogStore.config.open).toBe(true)
    expect(dialogStore.config.activeTab).toBe("expert-squad")

    await settleAppDialog(false, dialogStore.app.epoch)
    await expect(result).resolves.toEqual({ confirmed: false, value: null })
    expect(dialogStore.config.open).toBe(true)
    expect(dialogStore.config.activeTab).toBe("expert-squad")
  })
})

describe("app dialog awaited native surface lifecycle", () => {
  test("awaits hide before opening and restore before resolving", async () => {
    const hide = deferred()
    const restore = deferred()
    const unregister = registerNativeSurfaceOcclusionHooks({
      hide: () => hide.promise,
      restore: () => restore.promise,
    })
    try {
      const result = showAppDialog({ title: "Awaited", message: "Awaited" })
      await flushDialogTransition()
      expect(dialogStore.app.open).toBe(false)
      hide.resolve()
      await flushDialogTransition()
      expect(dialogStore.app.open).toBe(true)

      const settle = settleAppDialog(true, dialogStore.app.epoch)
      await flushDialogTransition()
      expect(dialogStore.app.open).toBe(false)
      let resolved = false
      void result.then(() => {
        resolved = true
      })
      await flushDialogTransition()
      expect(resolved).toBe(false)
      restore.resolve()
      await settle
      await expect(result).resolves.toEqual({ confirmed: true, value: null })
    } finally {
      unregister()
    }
  })

  test("rapid A to B to C replacement keeps one hidden surface and the mounted config owner", async () => {
    let primaryHideCount = 0
    let primaryRestoreCount = 0
    const unregister = registerNativeSurfaceOcclusionHooks({
      hide: async () => {
        primaryHideCount += 1
      },
      restore: async () => {
        primaryRestoreCount += 1
      },
    })
    let unregisterBlocking: (() => void) | undefined
    setDialogStore("config", { open: true, activeTab: "providers" })
    try {
      const first = showAppDialog({ title: "A" })
      await flushDialogTransition()
      expect(dialogStore.app.title).toBe("A")
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")
      const blockingHide = deferred()
      const blockingHideStarted = deferred()
      let blockingRestoreCount = 0
      unregisterBlocking = registerNativeSurfaceOcclusionHooks({
        hide: async () => {
          blockingHideStarted.resolve()
          await blockingHide.promise
        },
        restore: async () => {
          blockingRestoreCount += 1
        },
      })
      const second = showAppDialog({ title: "B" })
      await blockingHideStarted.promise
      expect(dialogStore.app.title).toBe("A")
      const third = showAppDialog({ title: "C" })
      blockingHide.resolve()
      await expect(second).resolves.toEqual({ confirmed: false, value: null })
      await expect(first).resolves.toEqual({ confirmed: false, value: null })
      await flushDialogTransition()
      expect(dialogStore.app.title).toBe("C")
      expect(primaryHideCount).toBe(1)
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")

      await settleAppDialog(true, dialogStore.app.epoch)
      await expect(third).resolves.toEqual({ confirmed: true, value: null })
      await flushDialogTransition()
      expect(primaryRestoreCount).toBe(1)
      expect(blockingRestoreCount).toBe(1)
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")
    } finally {
      unregisterBlocking?.()
      unregister()
    }
  })

  test("replacement hide failure leaves the active dialog and its resource owners intact", async () => {
    let primaryHideCount = 0
    let primaryRestoreCount = 0
    const unregisterPrimary = registerNativeSurfaceOcclusionHooks({
      hide: async () => {
        primaryHideCount += 1
      },
      restore: async () => {
        primaryRestoreCount += 1
      },
    })
    setDialogStore("config", { open: true, activeTab: "providers" })
    const first = showAppDialog({ title: "A" })
    await flushDialogTransition()
    const hideFailure = { owner: "replacement-hide" }
    const unregisterFailing = registerNativeSurfaceOcclusionHooks({
      hide: () => Promise.reject(hideFailure),
      restore: async () => undefined,
    })
    try {
      const replacement = await rejectionOutcome(showAppDialog({ title: "B" }))
      expect(replacement.rejected).toBe(true)
      expect(replacement.error).toBe(hideFailure)
      expect(dialogStore.app.open).toBe(true)
      expect(dialogStore.app.title).toBe("A")
      unregisterFailing()

      await settleAppDialog(true, dialogStore.app.epoch)
      await expect(first).resolves.toEqual({ confirmed: true, value: null })
      expect(primaryHideCount).toBe(1)
      expect(primaryRestoreCount).toBe(1)
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")
    } finally {
      unregisterFailing()
      unregisterPrimary()
    }
  })

  test("preserves every falsy hide rejection without opening", async () => {
    for (const failure of [undefined, null, false, 0, ""] as const) {
      const unregister = registerNativeSurfaceOcclusionHooks({
        hide: () => Promise.reject(failure),
        restore: async () => undefined,
      })
      const outcome = await rejectionOutcome(showAppDialog({ title: "Blocked" }))
      expect(outcome.rejected).toBe(true)
      expect(Object.is(outcome.error, failure)).toBe(true)
      expect(dialogStore.app.open).toBe(false)
      unregister()
    }
  })

  test("preserves falsy restore rejection and never retries it implicitly", async () => {
    for (const failure of [undefined, null, false, 0, ""] as const) {
      setDialogStore("config", { open: true, activeTab: "providers" })
      let restoreCalls = 0
      const unregister = registerNativeSurfaceOcclusionHooks({
        hide: async () => undefined,
        restore: () => {
          restoreCalls += 1
          return Promise.reject(failure)
        },
      })
      const result = showAppDialog({ title: "Restore" })
      await flushDialogTransition()
      await settleAppDialog(true, dialogStore.app.epoch)
      const outcome = await rejectionOutcome(result)
      expect(outcome.rejected).toBe(true)
      expect(Object.is(outcome.error, failure)).toBe(true)
      expect(restoreCalls).toBe(1)
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")

      const blocked = await rejectionOutcome(showAppDialog({ title: "No retry" }))
      expect(blocked.rejected).toBe(true)
      expect(Object.is(blocked.error, failure)).toBe(true)
      expect(restoreCalls).toBe(1)
      expect(dialogStore.config.open).toBe(true)
      expect(dialogStore.config.activeTab).toBe("providers")
      unregister()
      setDialogStore("config", "open", false)
    }
  })
})
