# Composer Dropdown Disclosure and Density

## Recall

- 用户要求：Composer 中下拉菜单箭头必须在收起时朝右、展开时朝下；`Work` 与 `Chat` 两个菜单的选项只占一行，详细说明改为 hover 展示。
- 验收指标：
  - `Work`、`Chat` 和模型选择器的箭头都由真实展开状态驱动，从向右平滑旋转为向下，关闭后恢复向右。
  - 产品模式与对话目标菜单项只显示图标、名称和选中标记，不再直接显示第二行说明。
  - Code/Work 与 Chat/Mission 的现有说明仍可通过 hover 查看。
  - 不改变选项数据、选择语义、键盘交互、提交路由或普通表单 Select 的视觉。
  - 使用真实 Overlay 页面打开菜单、悬停选项并截图人工复核；不新增、修改或运行 User Interface（用户界面）自动化测试。
- 硬约束：继续使用 Kobalte Select/Popover、共享 `SelectControl`、现有 Tooltip 和设计 token；不新增平行菜单 primitive 或额外展开状态。
- 已读资料：`AGENTS.md`、用户附件、`packages/overlay/src/components/ChatComposer.tsx`、`packages/overlay/src/components/ComposerModelSelector.tsx`、`packages/overlay/src/components/ui/SelectControl.tsx`、`packages/overlay/src/styles/primitives/select-control.css`、`packages/overlay/src/styles/surfaces/composer.css`、`specs/records/2026-08/2026-08-10-composer-intent-select-visual-repair.md`、相关提交 `6a9e1f3`。
- 全仓搜索结果：`variant="composer"` 只用于 `ChatComposer` 的产品模式与对话目标两个 Select；模型选择器拥有独立的受控 `useDisclosure` 状态；普通 `SelectControl` 还被多个表单复用，因此箭头与紧凑行样式必须限定在 Composer 变体和模型触发器。
- 独立 agent 反馈：实施前无；首轮验证通过后执行只读独立审查。

## 问题分析

### 可观察现象

1. 附件标出的 `Work`、`Chat` 和模型选择器箭头始终向下，打开和关闭时没有方向反馈。
2. Code/Work 与 Chat/Mission 项把说明直接放在第二行，单项最小高度为 `56px`，两项菜单占用过多垂直空间。

### 直接触发点与根因

- `SelectControl` 和 `ComposerModelSelector` 都无条件渲染 `chevron-down`，虽然 Kobalte 已在触发器暴露真实展开属性，样式并未消费该状态。
- `ChatComposer` 通过 `renderOptionDescription` 把说明渲染进列表；Composer 变体样式随后用 `56px` 最小高度和两行 copy 布局承载它。这是菜单高度的直接来源。

### 旧路径未根治原因

上一轮按当时的参考要求主动把 Tooltip 说明迁入列表，并扩大菜单项。本次用户明确改变信息密度偏好；继续压缩两行行距或只缩小 padding 仍会保留多余第二行，不能满足“一行 + hover 详情”的新契约。箭头此前只处理了垂直居中，没有绑定收展状态。

### 影响面与排除项

- 修改：两个 Composer Select 的说明呈现方式、Composer Select 单行高度、三个 Composer 下拉触发器的箭头状态样式。
- 不修改：普通表单 Select、选项内容和默认值、模型弹层列表、后端/API（Application Programming Interface，应用程序编程接口）、路由和提交逻辑。
- 风险：Tooltip 在靠近视口边缘时可能被裁切；沿用 Kobalte Tooltip 的 portal/placement，并通过真实页面悬停检查。

## 实施方案

1. 将两个意图菜单从 `renderOptionDescription` 切回共享 `renderOptionTooltip`，让名称行成为唯一菜单正文。
2. 把 Composer 选项高度收敛到现有单行模型选项附近，并保留图标、名称和选中标记的水平层级。
3. 给 Composer Select 与模型触发器箭头增加同一 disclosure class；收起默认右向，展开属性成立时旋转为下向，并使用现有动效 token。
4. 运行 Overlay typecheck/build 和文档检查；启动隔离真实 Vite 页面，检查关闭、展开及 hover 详情截图。
5. 委托未参与实现的 agent 只读审查完整差异与验收证据，修复全部有效发现后重验。

## 验收证据

- `bun run --cwd packages/overlay typecheck`：通过。
- `bun run --cwd packages/overlay build`：通过；仅有仓库既有的第三方 `use client` 和大 chunk 告警。
- `bun run docs:check`：通过，`322 ops, 25 groups`。
- `git diff --check`：通过。
- 真实页面：在 `http://127.0.0.1:4178/?acceptance-locale=zh-CN` 启动隔离 Vite Overlay，通过 Node.js + Playwright + 本机 Edge 打开真实页面；未创建或运行 User Interface 自动化测试。
- 三个触发器关闭时 `aria-expanded="false"`，箭头 computed transform 均为 `matrix(0, -1, 1, 0, 0, 0)`；分别展开后 `aria-expanded="true"`、`data-expanded=""`，transform 均为 `matrix(1, 0, 0, 1, 0, 0)`。
- Code/Work 与 Chat/Mission 四个菜单项实测高度均为 `40px`，正文分别只有 `Code`、`Work`、`Chat`、`Mission`，每项 `small` 元素数量为 `0`。
- hover 实测：Code 显示“面向代码仓库的编程与软件工作。”；Chat 显示“一次直接、流式的助手对话。”。
- 键盘与辅助技术实测：键盘打开产品菜单后，焦点保留在 `LI[role="option"]`，Tooltip 可见；当前 option 通过 Kobalte `Select.ItemDescription` 获得 `aria-describedby`，该 ID 指向同一说明文本，没有新增 tab stop，菜单项高度仍为 `40px`。
- 人工视觉复核：关闭态、产品菜单 hover、对话目标菜单 hover、模型菜单展开四张真实页面截图均确认箭头方向、单行密度、Tooltip、选中态和弹层边界正确，无可见遮挡或错位。
- 隔离 Vite 服务验收后已停止，并确认 `4178` 不再监听。
- 首轮独立审查发现两项：规格文件受 `/specs/` ignore 规则影响，提交时需显式纳入；Tooltip 原先绑定在不可聚焦的内层 `span`，键盘焦点无法触发且说明未关联真实 option。实现已改为让 `Select.Item` 直接承担 Tooltip Trigger，并用 `Select.ItemDescription` 注册相同说明；上述键盘与真实页面证据确认问题已修复。
- 第二轮独立审查核对最终差异、Kobalte Item 上下文与事件组合、普通 Select 隔离、箭头范围、真实截图和规格索引，结论为无未解决发现。
