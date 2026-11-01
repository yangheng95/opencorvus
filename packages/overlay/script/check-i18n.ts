#!/usr/bin/env bun

import * as path from "node:path"
import { getNodeValue, parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser"

const locales = ["en-US", "zh-CN"] as const
const i18nDirectory = path.resolve(import.meta.dir, "../src/i18n")

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]))].sort()
}

export class LocaleCatalogMismatchError extends Error {
  override readonly name = "LocaleCatalogMismatchError"
}

export function readLocaleCatalog(locale: string, source: string): Record<string, unknown> {
  const errors: ParseError[] = []
  const tree = parseTree(source, errors, { disallowComments: true, allowTrailingComma: false })
  if (!tree || errors.length) {
    const error = errors[0]
    throw new LocaleCatalogMismatchError(
      `Locale ${locale} has invalid JSON${error ? ` at offset ${error.offset}: ${printParseErrorCode(error.error)}` : ""}.`,
    )
  }
  const inspect = (node: Node, keyPath: string): void => {
    if (node.type === "object") {
      const keys = new Set<string>()
      for (const property of node.children ?? []) {
        const [key, value] = property.children!
        const name = key!.value as string
        const childPath = keyPath === "<root>" ? name : `${keyPath}.${name}`
        if (keys.has(name))
          throw new LocaleCatalogMismatchError(`Locale ${locale} has duplicate key at ${childPath} (offset ${key!.offset}).`)
        keys.add(name)
        inspect(value!, childPath)
      }
    } else if (node.type === "array") {
      node.children?.forEach((child, index) => inspect(child, `${keyPath}[${index}]`))
    }
  }
  inspect(tree, "<root>")
  const value: unknown = getNodeValue(tree)
  if (!isRecord(value)) throw new LocaleCatalogMismatchError(`Locale ${locale} must be a JSON object.`)
  return value
}

export function assertLocaleCatalogParity(
  referenceLocale: string,
  reference: unknown,
  translatedLocale: string,
  translated: unknown,
  keyPath = "<root>",
): void {
  if (Array.isArray(reference)) {
    if (!Array.isArray(translated) || reference.length !== translated.length) {
      throw new LocaleCatalogMismatchError(
        `Locale array mismatch at ${keyPath}: ${translatedLocale} must match ${referenceLocale}.`,
      )
    }
    reference.forEach((value, index) =>
      assertLocaleCatalogParity(referenceLocale, value, translatedLocale, translated[index], `${keyPath}[${index}]`),
    )
    return
  }

  if (isRecord(reference)) {
    if (!isRecord(translated)) {
      throw new LocaleCatalogMismatchError(
        `Locale object mismatch at ${keyPath}: ${translatedLocale} must match ${referenceLocale}.`,
      )
    }
    const referenceKeys = Object.keys(reference).sort()
    const translatedKeys = Object.keys(translated).sort()
    if (referenceKeys.join("\0") !== translatedKeys.join("\0")) {
      throw new LocaleCatalogMismatchError(
        `Locale key mismatch at ${keyPath}: ${translatedLocale} must match ${referenceLocale}.`,
      )
    }
    for (const key of referenceKeys) {
      const childPath = keyPath === "<root>" ? key : `${keyPath}.${key}`
      assertLocaleCatalogParity(referenceLocale, reference[key], translatedLocale, translated[key], childPath)
    }
    return
  }

  if (typeof reference !== typeof translated) {
    throw new LocaleCatalogMismatchError(
      `Locale value-type mismatch at ${keyPath}: ${translatedLocale} must match ${referenceLocale}.`,
    )
  }
  if (typeof reference !== "string") return

  const referencePlaceholders = placeholders(reference)
  const translatedPlaceholders = placeholders(translated as string)
  if (referencePlaceholders.join("\0") !== translatedPlaceholders.join("\0")) {
    throw new LocaleCatalogMismatchError(
      `Locale placeholder mismatch at ${keyPath}: ${translatedLocale} must use ${referencePlaceholders.join(", ") || "none"} from ${referenceLocale}.`,
    )
  }
}

async function main(): Promise<void> {
  const catalogs = await Promise.all(
    locales.map(async (locale) => {
      const file = path.join(i18nDirectory, `${locale}.json`)
      const value = readLocaleCatalog(locale, await Bun.file(file).text())
      return { locale, value }
    }),
  )

  const [reference, translated] = catalogs
  assertLocaleCatalogParity(reference.locale, reference.value, translated.locale, translated.value)

  const revisions = catalogs.map(({ locale, value }) => {
    const metadata = value._meta
    if (!isRecord(metadata) || typeof metadata.panel_revision !== "string" || !metadata.panel_revision) {
      throw new Error(`Locale ${locale} must declare a non-empty _meta.panel_revision.`)
    }
    return metadata.panel_revision
  })
  if (new Set(revisions).size !== 1) throw new Error("Locale panel revisions must agree.")

  console.log(`check:i18n ok (${locales.length} locales, ${Object.keys(reference.value).length} top-level keys)`)
}

if (import.meta.main) await main()
