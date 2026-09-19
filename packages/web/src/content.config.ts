import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders"
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema"
import en from "./content/i18n/en.json"

const custom = Object.fromEntries(Object.keys(en).map((key) => [key, z.string()]))

export const collections = {
  blog: defineCollection({
    loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      locale: z.enum(["root", "zh-cn"]),
      key: z.string(),
      category: z.enum(["cases", "mechanisms", "research", "practice"]),
      order: z.number(),
      visual: z.enum(["composition", "research", "benchmark"]).optional(),
    }),
  }),
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema({
      extend: z.object(custom).catchall(z.string()),
    }),
  }),
}
