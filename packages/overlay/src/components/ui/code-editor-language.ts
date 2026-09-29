import { LanguageDescription } from "@codemirror/language"
import { languages } from "@codemirror/language-data"

// One registry for editable files, code artifacts, diffs and Markdown fences.
// Each description owns/caches its dynamic import; grammars stay out of startup.
const editorLanguages: LanguageDescription[] = languages.map((language) => {
  if (language.name === "Markdown") {
    return LanguageDescription.of({
      name: language.name,
      alias: [...language.alias],
      extensions: [...language.extensions],
      load: () =>
        import("@codemirror/lang-markdown").then(({ markdown }) => markdown({ codeLanguages: editorLanguages })),
    })
  }
  if (language.name === "Python") {
    return LanguageDescription.of({
      name: language.name,
      alias: [...language.alias],
      extensions: [...language.extensions, "pyi"],
      filename: language.filename,
      load: () => language.load(),
    })
  }
  return language
})

export function editorLanguage(path: string): LanguageDescription | null {
  const filename = path.split(/[\\/]/).filter(Boolean).at(-1) ?? ""
  return LanguageDescription.matchFilename(
    editorLanguages,
    filename.replace(/\.[^.]+$/, (extension) => extension.toLowerCase()),
  )
}
