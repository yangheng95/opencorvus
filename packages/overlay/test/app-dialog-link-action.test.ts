import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { settleAppDialog, showAppDialog } from "../src/services/app-dialog"
import { dialogStore } from "../src/store/dialog"
import { setLocaleData } from "../src/utils/i18n"

// What this pins
// ----------------
// `showAppDialog` commits the dialog as one exhaustive object write. A field
// the type permits but that write omits is silently dropped: the option is
// accepted at the call site, type-checks, and never reaches the dialog. The
// link action shipped exactly that way once — `AppDialogOptions` carried it,
// `AppDialogState` inherited the type, and the button rendered for nobody.
//
// Every test here asserts what the store holds after opening, because that is
// the boundary the dialog actually reads.

function settled(): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  setLocaleData("en-US", {
    common: { cancel: "Cancel", ok: "OK" },
    dialog: { notice: "Notice", input: "Input", input_required: "Required" },
  })
})

afterEach(async () => {
  await settleAppDialog(false)
  await settled()
})

describe("app dialog link action", () => {
  test("a link option reaches the dialog store", async () => {
    const link = { url: "https://auth.example.com/authorize", label: "Open authorization page" }
    void showAppDialog({ message: "Sign in", link })
    await settled()

    expect(dialogStore.app.open).toBe(true)
    expect(dialogStore.app.message).toBe("Sign in")
    expect(dialogStore.app.link).toEqual(link)
  })

  test("the next dialog without one carries no leftover action", async () => {
    void showAppDialog({
      message: "first",
      link: { url: "https://example.com/", label: "Open" },
    })
    await settled()
    expect(dialogStore.app.link).toEqual({ url: "https://example.com/", label: "Open" })

    await settleAppDialog(false)
    await settled()

    void showAppDialog({ message: "second" })
    await settled()

    expect(dialogStore.app.message).toBe("second")
    expect(dialogStore.app.link).toBeUndefined()
  })
})
