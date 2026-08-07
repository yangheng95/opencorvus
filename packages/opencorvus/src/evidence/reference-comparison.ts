import { browserPreviewEvidenceIDFromRef } from "@/browser-preview/persist"

type ReferenceComparisonEvidenceProvider = {
  id: string
  evidenceIDFromRef(ref: string): string | undefined
}

const browserPreviewProvider: ReferenceComparisonEvidenceProvider = {
  id: "browser-preview",
  evidenceIDFromRef: browserPreviewEvidenceIDFromRef,
}

const providers: ReferenceComparisonEvidenceProvider[] = [browserPreviewProvider]

export function referenceComparisonEvidenceIDFromRef(ref: string): string | undefined {
  for (const provider of providers) {
    const evidenceID = provider.evidenceIDFromRef(ref)
    if (evidenceID) return evidenceID
  }
  return undefined
}
