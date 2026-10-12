import { expect, test } from "bun:test"
import { getStarlightEcConfigPreprocessor } from "../node_modules/@astrojs/starlight/integrations/expressive-code/preprocessor"

const useTranslations = () => Object.assign(() => "", { exists: () => false })
const configuration = {
  docsPath: "/workspace/docs/",
  starlightConfig: {
    defaultLocale: { lang: "en" },
    locales: { root: { lang: "en" }, "zh-cn": { lang: "zh-CN" } },
    isMultilingual: true,
  },
  useTranslations,
} as unknown as Parameters<typeof getStarlightEcConfigPreprocessor>[0]
async function configuredResolver(docsPath: string) {
  const preprocess = getStarlightEcConfigPreprocessor({ ...configuration, docsPath })
  const options = await preprocess({
    ecConfig: { themes: ["github-dark", "github-light"] },
  } as Parameters<typeof preprocess>[0])
  return options.getBlockLocale!
}
const resolveLanguage = await configuredResolver(configuration.docsPath)

function language(path: string, url: string) {
  return resolveLanguage({
    input: {},
    file: { path, url: new URL(url), cwd: "/workspace", data: {} },
  } as Parameters<typeof resolveLanguage>[0])
}

test("filesystem document URLs resolve against the actual collection path", async () => {
  expect(await language("/workspace/docs/zh-cn/start.mdx", "file:///workspace/docs/zh-cn/start.mdx")).toBe("zh-CN")
  expect(await language("/workspace/docs/start.mdx", "file:///workspace/docs/start.mdx")).toBe("en")
})

test("Windows filesystem documents retain their collection language", async () => {
  const resolve = await configuredResolver("/D:/workspace/docs/")
  expect(await resolve({
    input: {},
    file: {
      path: "D:\\workspace\\docs\\zh-cn\\start.mdx",
      url: new URL("file:///D:/workspace/docs/zh-cn/start.mdx"),
      cwd: "D:\\workspace",
      data: {},
    },
  } as Parameters<typeof resolve>[0])).toBe("zh-CN")
})

test("HTTP document URLs retain the explicit route language", async () => {
  expect(await language("", "https://example.test/zh-cn/start/quickstart/")).toBe("zh-CN")
  expect(await language("", "https://example.test/start/quickstart/")).toBe("en")
})
