import { createSignal } from "solid-js"

const [rightDockOpen, setRightDockOpen] = createSignal(false)

export { rightDockOpen }

export function setRightDockVisible(open: boolean): void {
  setRightDockOpen(open)
}

export function toggleRightDockVisible(): void {
  setRightDockOpen((open) => !open)
}
