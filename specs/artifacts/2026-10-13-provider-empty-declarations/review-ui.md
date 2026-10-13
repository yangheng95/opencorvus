# 第11批 UI 差异只读审查

## Recall 与边界

按 Root 指示，先读 `specs/records/2026-10/2026-10-13-provider-empty-declarations.md` 的 Recall、根因、实施方案及新增共享空对象 writer 分析，再审查当前 ProvidersPanel 和两个 locale 的差异。仅允许写本 scratch；没有改产品、测试、正式spec，没有运行UI自动化或其他测试，没有操作页面、进程或凭据，没有再次委托。Root 的 Node after 构建与后态真实交互由 Root 单独负责，源码审查不代表这些资格通过。

## 审查结论

本次 UI 功能差异没有发现阻塞问题，范围与正式方案一致；英文文案精度建议已发送 Root，结束前只读复核确认 Root 已采用“inherited models are preserved”。后态视觉密度尚未验证。

Panel diff 仅两处：删去 `providerModelIDs` import，以及 handleSave 中空模型数组的五行提前拒绝。没有新增配置事实、缓存、特殊Provider分支、运行准入或另一条保存路径。两语言目录各删除唯一的 `provider.form.error.models_required`，并只调整已有 `provider.form.models_hint`。限定三文件 `git diff --check` 实际退出0；这仅是差异格式检查。

## 字段意图与保真

- `packages/overlay/src/services/provider-form.ts:92–109` 仍以保存时 current 为基础，仅写入明确变化的 name/API/env；原 ID 冲突与API错误合同原样。
- 同文件111–132仍比较 initial 与 selected ID集合。空→空不修改 models，保留原缺席/{}以及保存时新出现的并发模型；明确清空只移除初始集合中的ID，保留peer新增；新建空集合自然得到 models:{}。这不是对GET→PATCH整个间隙的CAS保证，未扩张原并发合同。
- `packages/opencorvus/src/provider/provider.ts:377–380` 仍先继承catalog models再应用配置覆盖；项目GET/config还包含global继承。新文案使用“继承的模型”而未声称表单全部是项目本地声明，符合本批spec纠正。
- 可稍后添加/发现明确表达模型不是此表单的保存必填项。已有名称与能力保留是针对仍保留的ID；显式移除覆盖可能恢复global/catalog同ID，不等价于删除继承模型。没有必要因此在提示里重复长篇运行规则，但不能将空models宣称为禁用Provider或删除Auth。
- Shared writer 将缺席/非object初始化为{}的改动，是本批新增且已落盘的后端合同。models-only:{}能否正确持久化并保持编辑入口，必须依赖本批真实后态读回；本UI删除不会自行解决writer省略对象的问题。本审查不代替后端primitive与全部consumer验收。

## 原成功边界与生命周期

本次差异没有修改以下现有路径：

- `ProvidersPanel.tsx:615–645` 保存busy、scope missing、ID、API验证与 occurrence/isCurrentDirectory组合归属。
- 651–660同一个scope配置writer及 configCommitted事实；仅非空输入Key才进入662–670 Auth写入、配置Key清理与reload。
- 673–700原ownsForm检查、表单关闭/reset、Key已保存后的issues、配置已提交后的后续失败、原始保存失败与finally退休。
- startEdit/startAdd/reset/cancel、scope/authority/selectEpoch变化、卸载、discovery revision、两类refresh sequence均无改动。
- 新建有效API、未编辑缺席/模板API、配置引用错误、models-only无API编辑仍走原公开合同。模型运行准入、测试连接、testResults、Key presence与0数量tc均未改变。

因此未发现这次删除误丢成功receipt、绕过权限/作用域guard或多加状态。共享后端修改若影响实际保存错误，应由Root以原typed error及持久化事实验证，不能仅凭上述UI源码判成功。

## 死引用与语言键

当前全src检索 models_required 无生产引用。`providerModelIDs` 仍在 provider-form.ts:49定义、111/112使用及纯数据测试使用；只删除Panel import正确，不应删除helper或测试所需导出。新hint仍由Panel1361同一个TextField.Description在渲染时`t`读取，无预翻译signal、额外locale面或重复key。

中文现文案“可稍后添加或发现模型，继承的模型会保留”与保存事实吻合。英文 `en-US.json:509` 的“inherited models remain available”比同处中文“会保留”更强：模型实际可用仍受enabled/disabled、loader、过滤和引用等条件影响。建议用“inherited models are preserved”使双语都陈述保留事实；这是低风险精度建议，不是已实页证明的运行缺陷。Root决定后若改动，须由最终构建截图使用最终文案，不将本审查当已验证后态。

结束前实际重读同一locale文件，Root已改为“inherited models are preserved”，上述精度建议已处理；本分工没有修改产品。最终构建及实际截图是否已包含该版本仍由Root核对。

## 实际前态人工复看与待验收

本分工已亲自通过view_image打开并查看：

1. `before-global-name-blocked-en.png`：Edit owned-bootstrap，显示name草稿“Before rename only”、空模型textarea及“Add at least one model.”，Update provider可见。
2. `before-global-api-blocked-zh.png`：上方已保存地址/global/v1、下方草稿/global-revised/v1，0模型与“请至少添加一个模型”同时可见。
3. `before-project-api-blocked-zh.png`：已保存/project/v1、草稿/project-revised/v1，同样空模型阻挡；没有把placeholder示例文字误认成已填ID。

三图均只证明修改前阻挡及当时布局，不能证明后态成功。前态hint为一行；新增双语hint长度增加，尤其英文预计换行。需Root在最终生产/ui双语后态人工检查描述、Discover、textarea和保存/取消的相对位置、可读性及单列密度，不能以CSS未改推断视觉通过。

至少保留已定spec矩阵：global/project空声明改名/API/env保存及重开、models-only:{}无API入口、新建空声明、明确发现后保存、清空最后未引用模型、继承恢复、并发peer保真、引用400错误、普通单模型对照和取消/scope退休。后态应同时读取真实Config/source，区分草稿与已持久值。UI自动化测试不适用；本分工未新增或运行任何此类测试。

## 文件安全

开始工作区已有本批与其他owner的大量修改，本分工全部保留。本次唯一写入为本ignored scratch文件，不暂存、不提交其他文件；Root负责正式文档、共享hunk归属、最终资格和范围交付。
