import Reveal, { type RevealApi } from "reveal.js"
import "reveal.js/reveal.css"
import "reveal.js/theme/serif.css"
import "./PresentationArtifact.css"
import { For, Show, onCleanup, onMount } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { FilePart } from "../FilePart"
import { StaticTextPart } from "../TextPart"
import { ArtifactFrame } from "./ArtifactFrame"

type PresentationPayload = Extract<InteractiveArtifactPayload, { renderer: "presentation@1" }>

const PRESENTATION_DIMENSIONS: Record<PresentationPayload["aspectRatio"], { width: number; height: number }> = {
  "16:9": { width: 960, height: 540 },
  "4:3": { width: 960, height: 720 },
  "1:1": { width: 720, height: 720 },
}

export function PresentationArtifact(props: { payload: PresentationPayload }) {
  let host: HTMLDivElement | undefined
  let deck: RevealApi | undefined
  let observer: ResizeObserver | undefined
  let layoutFrame: number | undefined
  let initialized = false

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
    deck = new Reveal(host, {
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
    observer = new ResizeObserver(scheduleLayout)
    observer.observe(host)
    void deck.initialize().then(() => {
      initialized = true
      if (host) {
        host.dataset.ready = "true"
        scheduleLayout()
      }
    })
  })

  onCleanup(() => {
    initialized = false
    observer?.disconnect()
    observer = undefined
    if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame)
    layoutFrame = undefined
    deck?.destroy()
    deck = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Presentation">
      <div
        class="reveal msg-artifact-presentation"
        data-aspect-ratio={props.payload.aspectRatio}
        role="region"
        aria-roledescription="slide deck"
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
                aria-roledescription="slide"
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
