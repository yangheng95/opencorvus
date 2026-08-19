# OpenCorvus 长程专家团小红书推广素材方案

## Recall

### 用户原始要求

> 生成一套小红书推广文案，主题是“Agent 解决不了长程复杂任务？来试试用 OpenCorvus 的可以自己进化的专家团”；包含图文，封面图由 Codex 生成，文本由 Codex 负责；生成 1–2 张封面图，并渲染网站和 README 的图片，整体协调、美观。

### 验收指标

1. 交付 2 张适合小红书竖版信息流的原创封面图，视觉语言统一，标题可读，品牌名准确。
2. 从真实本地官网渲染至少 3 张与主题直接相关的中文页面截图，人工检查首屏与关键段落。
3. 基于当前 `README.zh-CN.md` 生成至少 1 张可读的 README 主题图，不能伪造产品能力或数据。
4. 交付可直接发布的小红书标题、正文、话题标签、配图顺序和每张图的说明。
5. 所有最终素材进入 `specs/artifacts/2026-08-19-xiaohongshu-open-corvus/`，不覆盖网站现有资产或用户工作区改动。

### 硬约束

- 图片生成使用内置 ImageGen；最终图片必须复制进仓库。
- 网站验收使用真实开发页面、浏览器截图与人工视觉复核；不运行或新增 UI 自动化测试。
- 文案必须明确：专家团进化需要操作者确认，不是后台自主改写；输出质量仍取决于模型、来源、工具、权限与证据。
- 只引用当前仓库已有事实：87 个模型供应商、43 个内置工具、119 支可检查专家团、13 个聊天渠道；其中 4 支内置、115 支可导入。
- 保留当前工作区已有未提交修改；本任务只提交自身文件。

### 已读资料

- `README.zh-CN.md`：长程任务三个断点、6 支专家团/33 个角色论文案例、进化的两条路径和边界。
- `packages/web/src/content/landing-copy.ts`：中文官网 hero、长程、组合、进化、FAQ 文案。
- `specs/records/2026-08/2026-08-19-long-horizon-and-evolution-repositioning.md`：公开定位、数据口径与既有审查结论。
- `specs/current/architecture/04-extensions.md`：专家团包、Mission 固定授权集合、固定版本 Task 与跨专家团组合边界。
- `specs/current/architecture/public-website.md`：公开网站与 Registry 当前契约。
- ImageGen 与 Browser skill 全文及 ImageGen prompting reference。

### 全仓搜索结果

- `README.zh-CN.md`、`packages/web/src/content/landing-copy.ts` 和 2026-08-19 重定位记录对主题口径一致。
- 当前网站包由 Astro 提供，`packages/web/package.json` 的 `dev`/`start` 是真实开发入口。
- 仓库已有 `packages/web/tmp/shots-final/**` 与 `shots-hero/**` 作为视觉参考，但本次仍需启动真实页面重新渲染；既有自动截图脚本不运行。
- 网站现有品牌/界面资产位于 `packages/web/src/assets/lander/**`，README 头图位于 `assets/readme-head.png`。
- 当前工作区已有 `packages/overlay/**` 与长程重定位记录的用户修改，本任务不覆盖这些文件。

### 独立 agent 反馈

实施前：无。首轮交付与验证完成后，按仓库规则委托未参与实现的独立 agent 只读审查。

## 方案

### 叙事结构

采用“反问钩子 → 三个断点 → 专家团组合 → 可确认的进化 → 诚实边界 → 行动号召”结构。正文不把 OpenCorvus 描述为万能 Agent，而是强调长程能力来自 Harness、可核对交接和可修订的专家团。

### 视觉系统

- 画布：3:4 竖版，优先保证小红书信息流可读。
- 调性：深石墨背景、钴蓝主色、朱红强调、暖白文字，与官网现有蓝/黑/红品牌色协调。
- 封面 A：问题型，突出“Agent 为什么跑不完长程任务？”；画面用断裂的单线任务链与多节点专家团形成对比。
- 封面 B：答案型，突出“会进化的专家团”；画面用多个协作模块、证据交接和版本升级轨迹表达组合与修订。
- 站点图：中文官网首屏、长程段、专家团组合、进化段，统一裁为 3:4 画布并保留真实页面内容。
- README 图：从真实中文 README 生成排版清晰的主题摘录图，保留文件身份和关键原文，不伪造界面。

### 交付文件

```text
specs/artifacts/2026-08-19-xiaohongshu-open-corvus/
├── README.md
├── xiaohongshu-copy.md
├── cover-01-long-horizon.png
├── cover-02-evolving-squad.png
├── website-01-hero.png
├── website-02-long-horizon.png
├── website-03-squad-composition.png
├── website-04-evolution.png
└── readme-01-overview.png
```

## 验证计划

1. 用真实 `packages/web` 开发服务打开中文页面，逐张截图并人工查看。
2. 用图像元数据检查所有最终图尺寸、格式和文件体积。
3. 打开两张生成封面，检查标题、品牌名、视觉层级和裁切安全区；需要时只做单点迭代。
4. 逐项对照 README/站点事实检查推广文案；运行 `bun run docs:check` 验证文档索引。
5. 首轮通过后委托独立 agent 只读审查；修复有效问题并重跑相关验证，直至无未解决发现。

## 实施记录

待完成。
