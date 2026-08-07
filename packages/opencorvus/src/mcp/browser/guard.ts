export type GuardAction = "click" | "double_click"
export type GuardDecision = "allow" | "warn" | "block"

type Page = any

export type GuardProfile = {
  action: GuardAction
  radius: number
  limit: number
  blockBelow: number
  warnBelow: number
  allowOpaqueSurface: boolean
}

export type GuardPoint = {
  x: number
  y: number
}

export type GuardElement = {
  tag: string
  id: string | null
  testId: string | null
  ariaLabel: string | null
  role: string | null
  classes: string[]
  text: string
  selector: string
  bounds: [number, number, number, number]
  center: GuardPoint
  attrs: Record<string, string>
}

export type GuardCandidate = GuardElement & {
  confidence: number
  distance: number
  signals: string[]
  risks: string[]
}

export type GuardResult = {
  enabled: true
  action: GuardAction
  decision: GuardDecision
  bypassed: boolean
  confidence: number
  point: GuardPoint
  target: GuardCandidate | null
  nearby: GuardCandidate[]
  signals: string[]
  risks: string[]
  message?: string
}

export const clickGuardProfile: GuardProfile = {
  action: "click",
  radius: 100,
  limit: 8,
  blockBelow: 0.45,
  warnBelow: 0.7,
  allowOpaqueSurface: false,
}

export const doubleClickGuardProfile: GuardProfile = {
  action: "double_click",
  radius: 100,
  limit: 8,
  blockBelow: 0.35,
  warnBelow: 0.6,
  allowOpaqueSurface: true,
}

export const runPointGuard = async (
  page: Page,
  point: GuardPoint,
  profile: GuardProfile,
  force = false,
): Promise<GuardResult> => {
  await page.evaluate("globalThis.__name ??= (target) => target")
  return page.evaluate(
    ({ point, profile, force }) => {
      type EvalGuardElement = GuardElement
      type EvalGuardCandidate = GuardCandidate

      const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
      const uniq = (xs: string[]) => [...new Set(xs)]
      const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80)
      const hasAttr = (el: Element, name: string) => {
        const value = el.getAttribute(name)
        return value !== null && value !== "false"
      }
      const cssString = (s: string) => {
        const css = globalThis.CSS as { escape?: (value: string) => string } | undefined
        return css?.escape ? css.escape(s) : s.replace(/["\\#.:,[\]>+~*'=]/g, "\\$&")
      }
      const selectorOf = (el: Element) => {
        const html = el as HTMLElement
        const tag = el.tagName.toLowerCase()
        if (html.id) return `#${cssString(html.id)}`
        const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-test") ?? el.getAttribute("data-cy")
        if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`
        const aria = el.getAttribute("aria-label")
        if (aria) return `[aria-label="${aria.replace(/"/g, '\\"')}"]`
        const cls = [...html.classList].filter(Boolean).slice(0, 2)
        if (cls.length) return `${tag}.${cls.map(cssString).join(".")}`
        return tag
      }
      const rectOf = (el: Element): [number, number, number, number] | null => {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return null
        return [Math.round(rect.left), Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)]
      }
      const centerOf = (bounds: [number, number, number, number]) => ({
        x: Math.round((bounds[0] + bounds[2]) / 2),
        y: Math.round((bounds[1] + bounds[3]) / 2),
      })
      const distanceToRect = (bounds: [number, number, number, number]) => {
        const dx = point.x < bounds[0] ? bounds[0] - point.x : point.x > bounds[2] ? point.x - bounds[2] : 0
        const dy = point.y < bounds[1] ? bounds[1] - point.y : point.y > bounds[3] ? point.y - bounds[3] : 0
        return Math.round(Math.hypot(dx, dy))
      }
      const attrsOf = (el: Element) =>
        Object.fromEntries(
          ["href", "type", "name", "value", "placeholder", "title", "tabindex", "contenteditable"].flatMap((name) => {
            const value = el.getAttribute(name)
            return value ? [[name, value]] : []
          }),
        )
      const elementOf = (el: Element): EvalGuardElement | null => {
        const bounds = rectOf(el)
        if (!bounds) return null
        const html = el as HTMLElement
        return {
          tag: el.tagName.toLowerCase(),
          id: html.id || null,
          testId: el.getAttribute("data-testid") ?? el.getAttribute("data-test") ?? el.getAttribute("data-cy"),
          ariaLabel: el.getAttribute("aria-label"),
          role: el.getAttribute("role"),
          classes: [...html.classList].slice(0, 5),
          text: textOf(el),
          selector: selectorOf(el),
          bounds,
          center: centerOf(bounds),
          attrs: attrsOf(el),
        }
      }
      const visibleEnough = (el: Element) => {
        const style = getComputedStyle(el)
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false
        if (style.pointerEvents === "none") return false
        const rect = el.getBoundingClientRect()
        return rect.width >= 3 && rect.height >= 3
      }
      const scoreElement = (el: Element) => {
        const tag = el.tagName.toLowerCase()
        const html = el as HTMLElement
        const role = el.getAttribute("role") ?? ""
        const cls = [...html.classList].join(" ").toLowerCase()
        const style = getComputedStyle(el)
        const signals: string[] = []
        const risks: string[] = []
        let score = 0

        if (!visibleEnough(el)) risks.push("not_visible_or_no_pointer_events")
        else {
          score += 0.15
          signals.push("visible")
        }

        if (["button", "a", "input", "select", "textarea", "summary", "option"].includes(tag)) {
          score += tag === "a" && !el.getAttribute("href") ? 0.2 : 0.5
          signals.push("native_interactive")
        }
        if (["button", "link", "menuitem", "tab", "checkbox", "radio", "switch", "option"].includes(role)) {
          score += 0.35
          signals.push(`role_${role}`)
        }
        if (hasAttr(el, "onclick") || hasAttr(el, "onmousedown") || hasAttr(el, "onmouseup")) {
          score += 0.25
          signals.push("inline_mouse_handler")
        }
        if (style.cursor === "pointer") {
          score += 0.2
          signals.push("cursor_pointer")
        }
        if (el.getAttribute("tabindex") !== null) {
          score += 0.12
          signals.push("tabindex")
        }
        if (html.isContentEditable || el.getAttribute("contenteditable") === "true") {
          score += profile.action === "double_click" ? 0.3 : 0.15
          signals.push("editable")
        }
        if (/\b(btn|button|click|action|submit|tab|menu|item|link|icon|close|delete|edit|more)\b/.test(cls)) {
          score += 0.15
          signals.push("interactive_class_name")
        }
        if (el.getAttribute("aria-label") || el.getAttribute("title")) {
          score += 0.1
          signals.push("accessible_name")
        }
        if (textOf(el)) {
          score += profile.action === "double_click" ? 0.15 : 0.08
          signals.push("has_text")
        }
        if (tag === "svg" || el.closest("svg")) {
          score += 0.12
          signals.push("svg_or_icon")
        }
        if (tag === "canvas") {
          score += profile.allowOpaqueSurface ? 0.3 : 0.25
          signals.push("opaque_surface")
          risks.push("opaque_surface")
        }
        if (hasAttr(el, "disabled") || el.getAttribute("aria-disabled") === "true") {
          score -= 0.5
          risks.push("disabled")
        }

        return { confidence: clamp01(score), signals: uniq(signals), risks: uniq(risks) }
      }
      const candidateOf = (el: Element): EvalGuardCandidate | null => {
        const base = elementOf(el)
        if (!base) return null
        const scored = scoreElement(el)
        return {
          ...base,
          confidence: scored.confidence,
          distance: distanceToRect(base.bounds),
          signals: scored.signals,
          risks: scored.risks,
        }
      }
      const ancestors = (el: Element | null) => {
        const out: Element[] = []
        for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) out.push(cur)
        return out
      }
      const best = (items: EvalGuardCandidate[]) =>
        items
          .filter((x) => !x.risks.includes("not_visible_or_no_pointer_events"))
          .sort((a, b) => b.confidence - a.confidence || a.distance - b.distance)[0] ?? null

      const hit = document.elementFromPoint(point.x, point.y)
      const stack = document.elementsFromPoint(point.x, point.y)
      const target = best([...stack, ...ancestors(hit)].map(candidateOf).filter(Boolean) as EvalGuardCandidate[])

      const all = [
        ...document.querySelectorAll(
          "button,a,input,select,textarea,summary,[role],[tabindex],[onclick],[onmousedown],[aria-label],[title],svg,canvas",
        ),
      ]
      const nearby = all
        .map(candidateOf)
        .filter((x): x is EvalGuardCandidate => !!x && x.distance <= profile.radius && x.confidence > 0.2)
        .sort((a, b) => b.confidence - a.confidence || a.distance - b.distance)
        .slice(0, profile.limit)

      const confidence = target?.confidence ?? 0
      const risks = uniq([...(target?.risks ?? []), ...(confidence < profile.warnBelow ? ["low_confidence"] : [])])
      const signals = target?.signals ?? []
      let decision: GuardDecision =
        confidence < profile.blockBelow || (target?.risks.includes("opaque_surface") && !profile.allowOpaqueSurface)
          ? "block"
          : confidence < profile.warnBelow
            ? "warn"
            : "allow"
      if (force) decision = "allow"

      return {
        enabled: true,
        action: profile.action,
        decision,
        bypassed: force,
        confidence,
        point,
        target,
        nearby,
        signals,
        risks,
        message:
          decision === "block"
            ? "Coordinate does not appear to target a valid interaction area. Re-call with force:true to execute anyway."
            : undefined,
      } satisfies GuardResult
    },
    { point, profile, force },
  )
}
