import { Show } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { t } from "../utils/i18n"

export function ReviewStreamSection(props: { reviewStream: NonNullable<CardNode["reviewStream"]> }) {
  return (
    <section class="integrity__section review-stream">
      <h4 class="integrity__section-title oc-section-heading">
        {props.reviewStream.currentStep
          ? t(`review.stream.step.${props.reviewStream.currentStep}`)
          : t("integrity.review.title")}
      </h4>
      <Show when={props.reviewStream.summary}>
        <p class="integrity__summary">{props.reviewStream.summary}</p>
      </Show>
    </section>
  )
}
