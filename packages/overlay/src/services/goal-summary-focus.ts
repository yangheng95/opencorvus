const GOALS_WORKBENCH_SELECTOR = '#centerWorkbenchGoals[data-active="true"]'

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export async function focusGoalSummary(deliverySliceID: string): Promise<void> {
  await nextAnimationFrame()
  await nextAnimationFrame()
  const workbench = document.querySelector<HTMLElement>(GOALS_WORKBENCH_SELECTOR)
  if (!workbench) throw new Error("Goals workbench did not become active")
  const goal = workbench.querySelector<HTMLElement>(
    `.gwg[data-delivery-slice-id="${CSS.escape(deliverySliceID)}"]`,
  )
  if (!goal) throw new Error(`Delivery Slice summary is not rendered: ${deliverySliceID}`)
  const header = goal.querySelector<HTMLElement>(':scope > .oc-disclosure__trigger[data-ui="gwg-header"]')
  if (!header) throw new Error(`Delivery Slice summary header is not rendered: ${deliverySliceID}`)
  goal.scrollIntoView({ block: "center", inline: "nearest" })
  header.focus({ preventScroll: true })
}
