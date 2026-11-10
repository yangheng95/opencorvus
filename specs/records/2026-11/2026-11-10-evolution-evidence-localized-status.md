# 用当前界面语言阅读演进证据状态

## Recall

用户要求本人独立持续分批迭代，不使用子 agent。每批先调查实页、功能和源码，落盘根因/影响，再实现、手动桌面截图、聚焦正向验证、提交、合并上游、普通推送。B171 `7066e55b3` 已正常推送且 0/0，177 项无关工作区状态逐行保留。已读根 AGENTS、当前 `07-panel`、[B169 读取所有权](2026-11-10-evolution-history-pagination-ownership.md)、[B171 邻接详情](2026-11-10-evolution-history-inline-detail.md)、演进面板、`t`/`localeTag` 的既有用法、两份语言资源、规范 `expert-squad-evolution-history.ts`、`expert-squad-evolution-artifact.ts`、生成客户端和服务端精确证据投影。全仓搜索了 `confidence`、`visual_review.status`、`slot.arm`、`result.status` 在演进数据与页面的生产调用，以及所有拟调整的翻译键。面板是唯一的对应显示消费者，不改服务协议、跨项目读取或模型。无委托、无外部凭据。

## 基线、根因与影响

真实开发服务 39451 `/ui` 提供 `main-Dk4SyIXc.js`。隔离项目中，在简体中文界面点击演进历史和有比较的第 22 条，标题和一部分产品文案已中文，页首仍有 `Package 摘要`、`Artifact Catalog 修订` 和 `Campaign 已冻结`；候选区显示 `已保留 Run`/`Evaluation`，比较区直接显示 `low`/`not_applicable`；两组证据显示 `baseline`/`candidate`、`Run trace 缺失`、`Evaluation 缺失` 以及 `quality: missing`。四张基线截图已人工查看。直接公开精确详情实际 200 `3e54d638-ee39-4e04-9bd9-f22df02a36c7` 给出相同源值：上界 27，Task（任务）`tsk_g00VaWxxuG00Ru0c08mw`，比较 `art_g0VaWxygM00JkgwzCENW`，两组 `case-a`、评分器 `quality` 均为 `missing`。

根因是部分界面固定文案仍是中英混合，且受规范限制的置信度、视觉复核、对照组和评分状态直接插值，绕过已接入的界面语言。实际协议值正确，不能把制品来源、原始假设、模型、用例/评分器标识、缺失维度路径或诊断当作翻译目标。旧工作接通面板标题和读取错误，保持源端状态，但不能自动翻译直接渲染的枚举。影响是两种语言都需要解读底层状态，在中文尤明显。本次变更限于演进历史读取界面的显示；不改变目录、筛选、比较意义、公开应用程序接口、生成客户端、持久数据、Task/Mission（多步任务）/Session（会话）执行轮次、恢复、并发或发布。既有提升/恢复回执及其时间格式没有进入本次实页场景，范围排除。

## 方案和验收（修改前）

1. 把可见的固定产品文案换成一致的当前界面语言。使用规范类型穷尽映射 `high/medium/low`、`reviewed/not_applicable/unavailable`、`baseline/candidate`、`measured/unavailable/missing` 到原国际化配置面。现有警示颜色、缺失含义、评分器数值/诊断/证据身份、制品路径和用户/模型内容不改。不使用文本猜测或翻译原始证据。
2. 在最终真实桌面以两种语言选择同一个第 22 条，截图比对页首、比较与两组矩阵；保留 `B169 campaign 22`、`fixture-no-execution`、`case-a`、`quality` 和缺失维度技术路径，确认中文空历史产品文案和实际安装品牌。在公开正向读取上核对完全相同的精确比较、置信度/复核/分组和评分契约。类型检查覆盖各枚举分支；实页 fixture 只包含 `low`、`not_applicable`、两组和 `missing`，其它分支不冒充实页验收。不运行界面自动化，跑 Overlay 类型、国际化、构建及根文档检查。不需要外部模型验收。

## 交付验证

- 真实候选服务 39452 提供 `main-Bdw-YmXI.js`。英文第 22 条显示 `Low`、`Not applicable`、`Baseline`、`Candidate`、`Missing`；简体中文显示低、不适用、基线版本、候选版本、运行轨迹与评测记录缺失。实际计划名、模型、`case-a`、`quality` 和维度标识原样。中文页首和独立 Evolution Lab 空历史也已人工检查。
- 基线和候选的公开精确详情回执身份不同，内容的状态、两组评分、目录上界、任务和比较完全相同；隔离库都通过快检，保留相同任务/根会话和 23 个计划，模型用量事件均为 0。十张[真实截图与回执](../../artifacts/2026-11-10-evolution-evidence-localized-status/README.md)已入库。
- Overlay `typecheck`、`check:i18n`（2 种语言、3067 项）、`build` 及根 `docs:check`（353 个操作）通过。没有运行界面自动化，没有调用外部模型。源数据中的其它可选状态由规范穷尽类型覆盖，未在桌面样本中声称实证。
