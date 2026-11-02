import Reveal, { type RevealApi } from "reveal.js"
import "reveal.js/reveal.css"
import "reveal.js/theme/serif.css"
import "./PresentationArtifact.css"
import { createEffect, For, Show, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifact, InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { localeTag, t } from "../../utils/i18n"
import { FilePart } from "../FilePart"
import { StaticTextPart } from "../TextPart"
import { ArtifactFrame } from "./ArtifactFrame"

type PresentationPayload = Extract<InteractiveArtifactPayload, { renderer: "presentation@1" }>

const PRESENTATION_DIMENSIONS: Record<PresentationPayload["aspectRatio"], { width: number; height: number }> = {
  "16:9": { width: 960, height: 540 },
  "4:3": { width: 960, height: 720 },
  "1:1": { width: 720, height: 720 },
}

// Reveal's public shortcut registry uses these native key identities. Keep the
// descriptions in our locale catalog and leave navigation with the same deck.
const PRESENTATION_SHORTCUTS = [
  ["N  ,  SPACE", "next"],
  ["P  ,  Shift SPACE", "previous"],
  ["&#8592;  ,  H", "left"],
  ["&#8594;  ,  L", "right"],
  ["&#8593;  ,  K", "up"],
  ["&#8595;  ,  J", "down"],
  ["Alt + &#8592;/&#8593/&#8594;/&#8595;", "skip_fragments"],
  ["Shift + &#8592;/&#8593/&#8594;/&#8595;", "first_last"],
  ["B  ,  .", "pause"],
  ["F", "fullscreen"],
  ["G", "jump"],
  ["ESC, O", "overview"],
] as const

export function PresentationArtifact(props: {
  payload: PresentationPayload
  downloads?: InteractiveArtifact["downloads"]
}) {
  let host: HTMLDivElement | undefined
  let deck: RevealApi | undefined
  let observer: ResizeObserver | undefined
  let labelObserver: MutationObserver | undefined
  let layoutFrame: number | undefined
  let initialized = false

  const localizeDeck = () => {
    const current = deck
    const element = host
    if (!initialized || !current || !element) return
    const label = (selector: string, value: string) => {
      for (const node of element.querySelectorAll(selector)) node.setAttribute("aria-label", value)
    }
    const text = (selector: string, value: string) => {
      for (const node of element.querySelectorAll(selector)) {
        if (node.textContent !== value) node.textContent = value
      }
    }
    const rtl = current.getConfig().rtl
    label(":scope > .controls .navigate-left", t(rtl ? "artifact.presentation.next" : "artifact.presentation.previous"))
    label(":scope > .controls .navigate-right", t(rtl ? "artifact.presentation.previous" : "artifact.presentation.next"))
    label(":scope > .controls .navigate-up", t("artifact.presentation.up"))
    label(":scope > .controls .navigate-down", t("artifact.presentation.down"))
    text(":scope > .pause-overlay .resume-button", t("artifact.presentation.resume"))
    for (const input of element.querySelectorAll<HTMLInputElement>(":scope > .jump-to-slide .jump-to-slide-input")) {
      const name = t("artifact.presentation.jump")
      input.placeholder = name
      input.setAttribute("aria-label", name)
    }

    const descriptions = new Map<string, string>()
    const nativeKey = element.ownerDocument.createElement("span")
    for (const [key, action] of PRESENTATION_SHORTCUTS) {
      const description = t(`artifact.presentation.${action}`)
      current.registerKeyboardShortcut(key, description)
      nativeKey.innerHTML = key
      descriptions.set(nativeKey.textContent ?? "", description)
    }
    text(":scope > .r-overlay-help .title", t("artifact.presentation.help"))
    text(":scope > .r-overlay-help th:first-child", t("artifact.presentation.help_key"))
    text(":scope > .r-overlay-help th:nth-child(2)", t("artifact.presentation.help_action"))
    label(":scope > .r-overlay-help .r-overlay-close", t("artifact.presentation.help_close"))
    for (const row of element.querySelectorAll<HTMLTableRowElement>(":scope > .r-overlay-help tr")) {
      const description = descriptions.get(row.cells.item(0)?.textContent ?? "")
      const action = row.cells.item(1)
      if (description && action && action.textContent !== description) action.textContent = description
    }
    const number = new Intl.NumberFormat(localeTag())
    label(":scope > .slide-number a", t("artifact.presentation.position", {
      current: number.format(current.getSlidePastCount() + 1),
      total: number.format(current.getTotalSlides()),
    }))
  }

  createEffect(() => {
    localeTag()
    localizeDeck()
  })

  onMount(() => {
    if (!host) return
    const dimensions = PRESENTATION_DIMENSIONS[props.payload.aspectRatio]
    const scheduleLayout = () => {
      if (!initialized || layoutFrame !== undefined) return
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = undefined
        deck?.layout()
      })
    }
    const currentDeck = new Reveal(host, {
      embedded: true,
      hash: false,
      controls: true,
      controlsTutorial: false,
      progress: true,
      slideNumber: "c/t",
      keyboard: true,
      keyboardCondition: "focused",
      center: false,
      overview: true,
      touch: true,
      transition: "fade",
      backgroundTransition: "fade",
      width: dimensions.width,
      height: dimensions.height,
      margin: 0.06,
    })
    deck = currentDeck
    observer = new ResizeObserver(scheduleLayout)
    observer.observe(host)
    void currentDeck.initialize().then(() => {
      if (deck !== currentDeck || !host) return
      initialized = true
      host.dataset.ready = "true"
      localizeDeck()
      // Native jump/help panels are appended here; slide navigation replaces
      // only the number link. Descendant text/attribute writes are not watched.
      labelObserver = new MutationObserver(localizeDeck)
      labelObserver.observe(host, { childList: true })
      const counter = host.querySelector(":scope > .slide-number")
      if (counter) labelObserver.observe(counter, { childList: true })
      scheduleLayout()
    })
  })

  onCleanup(() => {
    initialized = false
    labelObserver?.disconnect()
    labelObserver = undefined
    observer?.disconnect()
    observer = undefined
    if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame)
    layoutFrame = undefined
    deck?.destroy()
    deck = undefined
  })

  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="Presentation" downloads={props.downloads}>
      <div
        class="reveal msg-artifact-presentation"
        data-aspect-ratio={props.payload.aspectRatio}
        role="region"
        aria-roledescription={t("artifact.presentation.deck")}
        aria-label={props.payload.title}
        tabIndex={0}
        ref={(element) => {
          host = element
        }}
      >
        <div class="slides">
          <For each={props.payload.slides}>
            {(slide) => (
              <section
                class="msg-artifact-presentation__slide"
                data-slide-id={slide.id}
                data-rendered-slide={slide.image ? "true" : undefined}
                aria-roledescription={t("artifact.presentation.slide")}
                aria-label={slide.title}
              >
                <Show
                  when={slide.image}
                  fallback={
                    <>
                      <h4>{slide.title}</h4>
                      <div class="msg-artifact-presentation__content">
                        <StaticTextPart text={slide.markdown} />
                      </div>
                    </>
                  }
                >
                  {(image) => (
                    <FilePart
                      part={{
                        type: "file",
                        url: image().url,
                        mime: image().mime,
                        filename: image().filename,
                        alt: slide.imageAlt,
                      }}
                    />
                  )}
                </Show>
                <Show when={slide.notes}>{(notes) => <aside class="notes">{notes()}</aside>}</Show>
              </section>
            )}
          </For>
        </div>
      </div>
    </ArtifactFrame>
  )
}
