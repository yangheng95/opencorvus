import { imagePreviewTriggerLabel } from "./image-preview-label"

export const IMAGE_PREVIEW_TRIGGER_CLASS = "msg-image-trigger"
export const IMAGE_PREVIEW_TRIGGER_DATA_UI = "image-preview-trigger"
export const IMAGE_PREVIEW_TRIGGER_DATA_FLAG = "true"
export const IMAGE_PREVIEW_TRIGGER_VARIANT = "ghost"
export const IMAGE_PREVIEW_TRIGGER_SIZE = "md"
export const IMAGE_PREVIEW_TRIGGER_TONE = "neutral"

export interface ImagePreviewTriggerInput {
  src: string
  alt?: string
}

export function imagePreviewTriggerContract(input: ImagePreviewTriggerInput) {
  const alt = input.alt ?? ""
  return {
    className: IMAGE_PREVIEW_TRIGGER_CLASS,
    variant: IMAGE_PREVIEW_TRIGGER_VARIANT,
    size: IMAGE_PREVIEW_TRIGGER_SIZE,
    tone: IMAGE_PREVIEW_TRIGGER_TONE,
    dataUi: IMAGE_PREVIEW_TRIGGER_DATA_UI,
    triggerFlag: IMAGE_PREVIEW_TRIGGER_DATA_FLAG,
    src: input.src,
    alt,
    label: imagePreviewTriggerLabel(alt),
  } as const
}

export function imagePreviewTriggerClass(extraClass?: string): string {
  return [IMAGE_PREVIEW_TRIGGER_CLASS, extraClass].filter(Boolean).join(" ")
}

export function imagePreviewTriggerHtmlAttributes(
  input: ImagePreviewTriggerInput,
  escapeAttribute: (value: string) => string,
): string {
  const trigger = imagePreviewTriggerContract(input)
  return [
    ["type", "button"],
    ["class", `oc-button ${trigger.className}`],
    ["data-variant", trigger.variant],
    ["data-size", trigger.size],
    ["data-tone", trigger.tone],
    ["data-ui", trigger.dataUi],
    ["data-image-preview-trigger", trigger.triggerFlag],
    ["data-image-preview-src", trigger.src],
    ["data-image-preview-alt", trigger.alt],
    ["title", trigger.label],
    ["aria-label", trigger.label],
  ]
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(" ")
}
