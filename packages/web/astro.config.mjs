// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import theme from "toolbeam-docs-theme"
import config from "./config.mjs"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

// The plugin and Astro carry separate unified type identities. Normalize that static boundary while
// keeping the direct function import required for Markdown JSX (MDX) plugin inheritance.
const astroRehypeAutolinkHeadings = /** @type {import("@astrojs/markdown-remark").RehypePlugin} */ (
  /** @type {unknown} */ (rehypeAutolinkHeadings)
)
const publicBase = "/opencorvus-dist/dist"

// https://astro.build/config
export default defineConfig({
  site: config.url,
  base: publicBase,
  output: "static",
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
  },
  markdown: {
    rehypePlugins: [rehypeHeadingIds, [astroRehypeAutolinkHeadings, { behavior: "wrap" }]],
  },
  build: {},
  integrations: [
    solidJs(),
    starlight({
      title: "OpenCorvus",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
          dir: "ltr",
        },
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
          dir: "ltr",
        },
      },
      favicon: "/favicon-v3.svg",
      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: `${publicBase}/favicon-v3.ico`,
            sizes: "32x32",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            href: `${publicBase}/favicon-96x96-v3.png`,
            sizes: "96x96",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: `${publicBase}/apple-touch-icon-v3.png`,
            sizes: "180x180",
          },
        },
      ],
      lastUpdated: true,
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [
        { icon: "github", label: "GitHub", href: config.github },
        { icon: "discord", label: "Discussions", href: config.discord },
      ],
      editLink: {
        baseUrl: `${config.github}/edit/dev/packages/web/`,
      },
      markdown: {
        headingLinks: false,
      },
      customCss: ["./src/styles/custom.css"],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      sidebar: [
        "",
        {
          label: "Get Started",
          translations: { en: "Get Started", "zh-CN": "快速开始" },
          items: ["start/install", "start/quickstart"],
        },
        "config",
        "providers",
        "network",
        "troubleshooting",
        {
          label: "Windows",
          translations: { en: "Windows", "zh-CN": "Windows" },
          link: "windows-wsl",
        },
        {
          label: "Concepts",
          translations: { en: "Concepts", "zh-CN": "概念" },
          items: [
            "concepts/architecture",
            "concepts/enterprise-architecture",
            "concepts/agent-loop",
            "concepts/delivery-slice-task",
          ],
        },
        {
          label: "Usage",
          translations: { en: "Usage", "zh-CN": "使用" },
          items: ["cli"],
        },
        {
          label: "Configure",
          translations: { en: "Configure", "zh-CN": "配置" },
          items: [
            "tools",
            "rules",
            "agents",
            "models",
            "commands",
            "formatters",
            "permissions",
            "lsp",
            "mcp-servers",
            "acp",
            "skills",
          ],
        },
        {
          label: "Channels",
          translations: { en: "Channels", "zh-CN": "频道" },
          items: [
            "channels/overview",
            "channels/slack",
            "channels/discord",
            "channels/feishu",
            "channels/dingtalk",
            "channels/wecom",
            "channels/qqbot",
            "channels/telegram",
            "channels/whatsapp",
            "channels/line",
            "channels/signal",
            "channels/matrix",
            "channels/mattermost",
            "channels/msteams",
            "channels/googlechat",
          ],
        },
        {
          label: "Overlay",
          translations: { en: "Overlay", "zh-CN": "Overlay 桌面端" },
          items: ["overlay/overview"],
        },
        {
          label: "Operations",
          translations: { en: "Operations", "zh-CN": "运维" },
          items: ["operations/benchmark", "operations/github-action"],
        },
        {
          label: "Develop",
          translations: { en: "Develop", "zh-CN": "开发" },
          items: ["sdk", "server", "plugins"],
        },
        {
          label: "Reference",
          translations: { en: "Reference", "zh-CN": "参考" },
          items: [
            "reference/mission-task",
            "reference/api",
            "reference/cli",
            "reference/sdk",
            "reference/env",
            "reference/evaluator",
          ],
        },
      ],
      components: {
        Hero: "./src/components/Hero.astro",
        Head: "./src/components/Head.astro",
        Header: "./src/components/Header.astro",
        Footer: "./src/components/Footer.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      plugins: [
        theme({
          headerLinks: config.headerLinks,
        }),
      ],
    }),
  ],
})
