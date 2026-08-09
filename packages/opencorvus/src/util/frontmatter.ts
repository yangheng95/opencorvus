import matter from "gray-matter"
import { dump as dumpYaml, load as loadYaml } from "js-yaml"

const options = {
  engines: {
    yaml: {
      parse: (source: string) => loadYaml(source) ?? {},
      stringify: (data: object) => dumpYaml(data, { noRefs: true }),
    },
  },
}

export function parseFrontmatter(source: string) {
  return matter(source, options)
}

export function stringifyFrontmatter(content: string, data: object) {
  return matter.stringify(content, data, options)
}
