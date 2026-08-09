import matter from "gray-matter"
import { load as loadYaml } from "js-yaml"

const options = {
  engines: {
    yaml: (source: string) => loadYaml(source) ?? {},
  },
}

export function parseFrontmatter(source: string) {
  return matter(source, options)
}

export function stringifyFrontmatter(content: string, data: object) {
  return matter.stringify(content, data)
}
