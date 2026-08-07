import type { APIRoute } from "astro"
import { getCollection } from "astro:content"

const DOC_ALIASES: Record<string, string> = {
  "reference/sdk/api": "reference/api",
  "zh-cn/reference/sdk/api": "zh-cn/reference/api",
}

function canonicalSlug(slug: string) {
  return DOC_ALIASES[slug] ?? slug
}

function notFoundText(locals: unknown) {
  if (typeof locals !== "object" || locals === null || !("t" in locals)) {
    return "share.not_found"
  }
  const t = (locals as { t?: unknown }).t
  if (typeof t !== "function") {
    return "share.not_found"
  }
  const text = t("share.not_found")
  if (typeof text === "string" && text.length > 0) {
    return text
  }
  return "share.not_found"
}

export async function getStaticPaths() {
  const docs = await getCollection("docs")
  return [
    ...docs.map((doc) => ({
      params: { slug: doc.id },
    })),
    ...Object.keys(DOC_ALIASES).map((slug) => ({
      params: { slug },
    })),
  ]
}

export const GET: APIRoute = async ({ params, locals }) => {
  const requestedSlug = params.slug || "index"
  const slug = canonicalSlug(requestedSlug)
  const docs = await getCollection("docs")
  const doc = docs.find((d) => d.id === slug)
  const notFound = notFoundText(locals)

  if (!doc) {
    return new Response(notFound, { status: 404, statusText: notFound })
  }

  return new Response(doc.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
