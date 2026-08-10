# Composer Intent Select Visual Repair

## Recall

- 用户要求：修复 Composer 底部 `Work` 与 `Chat` 下拉触发器的箭头垂直错位，并参考用户提供的第二张截图重做下拉列表视觉。
- 验收指标：
  - `Work`、`Chat` 文字、前置图标与下拉箭头在同一垂直中心线上。
  - 两个弹层不再出现外框套内框的双层容器感。
  - 弹层具备明确标题、较宽的列表阅读区、图标容器、名称、说明和稳定选中态，信息层级接近参考截图。
  - 改动只影响 Composer 的产品模式与对话目标 Select，不改变普通表单 Select、路由和提交语义。
  - 使用真实 Overlay 页面打开两个菜单并截图人工复核；不新增、修改或运行 User Interface（用户界面）自动化测试。
- 硬约束：沿用 Kobalte `Select`、共享 `SelectControl` 和现有设计 token；不增加第二套菜单 primitive，不保留旧 Tooltip 说明路径。
- 已读资料：`AGENTS.md`、`packages/overlay/src/components/ChatComposer.tsx`、`packages/overlay/src/components/ui/SelectControl.tsx`、`packages/overlay/src/styles/primitives/select-control.css`、`packages/overlay/src/styles/surfaces/composer.css`、两张用户附件截图。
- 全仓搜索结果：`variant="composer"` 仅由 `ChatComposer.tsx` 中产品模式与对话目标两个 Select 使用；公共 `SelectControl` 的普通 `control` 变体被其他表单复用，必须保持不变。`composer` 弹层当前由 `.oc-select-content[data-variant="composer"]` 与 `.oc-select-listbox[data-variant="composer"]` 同时提供 padding、边框与圆角。
- 独立 agent 反馈：实施前无；首轮验证通过后按仓库规则执行只读独立审查。

## 问题分析

### 可观察现象

1. 触发器中的下拉箭头在文字基线附近偏移，没有和前置图标、文字形成一致的垂直中心。
2. 当前弹层外层有白色圆角面板，内层又有带边框和背景的圆角 Listbox，形成拥挤的双层卡片。
3. 每项只显示图标和名称，说明被藏在 Tooltip；与参考截图可直接扫描“名称 + 类型/说明”的列表层级不一致。

### 直接触发点与根因

- `.oc-select-trigger[data-variant="composer"] > .oc-select-icon` 只声明 `inline-flex` 和尺寸，没有声明 `align-items` / `justify-content`；Kobalte 包装元素及 SVG 的行盒由默认行高参与布局，导致箭头视觉中心不稳定。
- Composer 弹层同时在 Content 和 Listbox 上建立视觉容器，两个层级都拥有 padding，Listbox 还额外拥有边框、圆角和半透明背景；这不是数据或定位问题，而是重复的表面所有权。
- `ChatComposer` 将 option description 传给 `renderOptionTooltip`，使说明只能悬停查看；列表本身没有参考截图所需的正文层级。

### 旧路径未根治原因

现有实现曾把四个 Composer 控件统一为无边框紧凑样式，重点是触发器一致性和减少列表高度；它没有解决弹层信息架构，也没有给箭头包装元素建立完整的内部居中布局。继续只调 margin 或 SVG transform 会遮蔽症状，并在字体、缩放变化时再次漂移。

### 影响面与排除项

- 修改：`SelectControl` 的 Composer 内容标题呈现、`ChatComposer` 的说明呈现方式、Composer Select 样式。
- 不修改：产品模式/对话目标 option 数据、提交路由、Kobalte 键盘和焦点行为、普通 Select 变体、Skill/专家团选择弹窗、模型选择器。
- 数据、公共协议和后端：不适用。
- 风险：弹层宽度在窄窗口可能溢出；继续使用现有 `max-width` 视口约束并通过真实页面检查。

## 实施方案

1. 在 `SelectControl` 的 Composer Content 中显示现有 `ariaLabel` 作为可见分组标题，保持语义标签与视觉标题单一来源。
2. `ChatComposer` 改用 `renderOptionDescription`，删除同一说明的 Tooltip 路径。
3. 让 Composer 弹层只有 Content 一个表面所有者；Listbox 仅负责列表布局。
4. 给触发器 value、箭头包装和选项图标建立明确的 flex 居中；扩大弹层和行高，形成图标容器、名称、说明、选中标记四段层级。
5. 执行 Overlay typecheck/build，启动隔离的真实 Vite 页面，打开两个菜单并截图人工复核。
6. 委托未参与实现的 agent 只读审查完整差异与验收证据；修复有效问题并重验。

## 验收证据

- `bun run --cwd packages/overlay typecheck`：通过。
- `bun run --cwd packages/overlay build`：通过；仅输出仓库既有的第三方 `use client` 与 chunk size 告警。
- `bun run docs:check`：通过，`322 ops, 25 groups`。
- 真实页面：在 `http://127.0.0.1:4178/?acceptance-locale=zh-CN` 启动隔离 Vite Overlay，通过 Node.js + Playwright + 本机 Edge 打开真实页面；未创建或运行 User Interface 自动化测试。
- 产品模式弹层截图：`.scratch/composer-product-menu.png`。人工复核确认标题为“选择产品模式”，Code/Work 均显示图标、名称和说明，Work 选中态完整，弹层没有内层边框。
- 对话目标弹层截图：`.scratch/composer-target-menu.png`。人工复核确认标题为“选择对话目标”，Chat/Mission 均显示图标、名称和说明，Chat 选中态完整，弹层未遮挡 Composer 主要操作。
- 真实布局几何：Work 触发器、value 与箭头的垂直中心均为 `487.875px`（触发器高 `24px`、value 高 `14px`、箭头包装高 `16px`），确认文字与箭头精确同轴。
- 隔离 Vite 服务验收后已按端口关闭，并确认 `4178` 不再监听。
- 独立审查：未参与实现的 agent 只读核对了完整差异、两个真实页面截图、Composer 变体调用面、Kobalte 焦点/可访问性契约和窄窗口约束；代码与视觉无未解决发现。审查发现新增 spec 受 `/specs/` ignore 规则影响，提交时必须显式纳入，避免两个 README 索引形成断链。
