# 定时任务详情显示完整模型标识

## Recall

- 用户要求本人独立持续分批迭代，先分析问题及影响并落盘，实页交互和截图人工复核，聚焦检查、范围提交、合并上游和正常推送。上批 `2b921f2c4` 已核对在远端，本地与上游 0/0，原工作区 177 项保持。
- 详情验收覆盖已保存的长服务商和模型标识，在现有桌面详情中能读到并区分模型末尾。全局规则与项目规则各使用一个明确模型，另有两条规则分别继承全局和项目的默认模型。复核当前语言、下一次运行精度、邻近字段和原来的导航。所有规则均为 2099 年未来计划，只读取和呈现，使用自建模型目录和独立项目，无模型调用或凭据需求。
- 已读[定时概要初始阅读位置](2026-11-24-scheduled-detail-starts-at-overview.md)、[规则摘要及精确下次运行](2026-11-12-scheduled-recurrence-readable-details.md)、[面板架构](../../current/architecture/07-panel.md)、`ScheduledAutomationsPanel.tsx` 与 `automations.css`。全仓查 `automation-metadata-grid`、`automation-detail-next-run`、`automations.model`、`automation().model`、模型编辑和保留行为、现有 `overflow-wrap: anywhere`。详情独有网格，由同一个组件展示真实读回的模型及默认文案。现有特定值按需换行的就是同一网格中的下次运行时刻。

## 前态与影响

- 真实桌面 `1280 × 720`，隔离服务 `41781/ui/` 资源 `main-DvhxDtT0.js`。实际公开规则读取返回 `managed-project-compatibility-provider/development-review-structured-response-east` 和 `managed-project-compatibility-provider/development-review-structured-response-west`，分别属于全局和一个精确项目。本人从列表按 Enter 进入两条详情，两页实际界面仅露出相同的 `managed-project-compatibility-provide...`，两个模型名及其差异完全不可见。[实页、字段尺寸与真实定义](../../artifacts/2026-11-25-scheduled-details-show-full-model-identity/README.md)
- 完整标识已经由现组件按原 `providerID/modelID` 投影，定义、目录与回执无截断。直接触发是 `.automation-metadata-grid strong` 对所有值强制 `white-space: nowrap`、`overflow: hidden` 与 `text-overflow: ellipsis`。两个模型字段实际列宽均为 228 像素，单行原文分别需 496、498 像素。相应节点没有浏览器标题，也没有可聚焦展开；阅读其他界面或检查页面结构才能找回后缀。既有换行只作用于下次运行的独立类名，无法处理这个模型字段。
- 影响限详情模型字段的呈现。全局与项目模型原文、空值的两种本地化默认、保存、目录选择和推理适配不会经过样式。保留现有详情列序、状态、运行时刻、历史、动作和导航；不改公开接口、持久数据或调度。当前观察仅在静态已接受的定义上，未发现任务、会话、多步任务执行轮次、排队、唤醒、重启或终态异常。风险主要是较长连续标识撑宽网格、高字号下相邻时间或导航被挤出，以及不同界面语言改变布局后重新裁切。

## 实施与验收

- 模型值复用详情网格中的按需换行样式。维持技术标识的原字符和同一文本读取，不增加替代名或新控件。全局和项目仍使用既有默认文案，下一次运行及原精确日期留在其原格。
- 候选用真实桌面从键盘进入全局和项目详情，人工读取两个确切后缀，并在较大桌面字号的简体中文核对。核对相邻的下次运行、状态、默认模型对照及原返回焦点。可见区域尺寸只用于给截图定位。实际公开路由回读保留四个定义、原模型和未来时间，检查运行历史为空。运行语言、类型、样式令牌、正式构建、文档和架构索引；纯界面调整通过人工交互验证。
