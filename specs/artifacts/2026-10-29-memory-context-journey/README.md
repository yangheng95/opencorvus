# 项目记忆与上下文的真实体验

2026-10-29，单agent在自有38357/38358开发模式`/ui/`完成真实桌面操作、截图与人工复核。用户18571实例、现用窗口与用户数据库未操作。见[调查、完整分析与方案](../../records/2026-10/2026-10-29-memory-context-journey.md)。

## 问题与结果

原页面要求先选Task，无法选择只有Chat的项目，也未呈现受保护的项目MEMORY.MD。实际后台早已按Project查询；两个真实项目的只读GET分别返回2091/1926字符，与原持久内容相同。修复改用同一完整Work Ledger项目库存，默认实际当前项目，通过现有服务读取原文。语义笔记/事实仍使用原项目接口，受保护文档保持只读。项目记忆选择独立于原对话。

| 原图 | 真实操作与人工复核 |
| --- | --- |
| [01 旧Task必选](01-task-required-before.png)、[02 空普通列表](02-task-context-empty-before.png) | Chat-only项目无法选择；选已有Task显示普通语义记忆空列表，没有原项目上下文入口。 |
| [03 原搜索无匹配](03-memory-search-no-results.png)、[04 清空回列表](04-memory-escape-reloads-list.png) | Enter实际提交，Esc沿原onClear重新加载列表；791特殊回调生效，加载禁用输入期间不异步抢焦点。 |
| [05 真实Task的Review](05-file-review-real-history.png) | 完成Task稳定显示无变更，同时存在两份交付附件；比较源/原持久观测仍需独立调查，不能仅凭交付标题认定遗漏或假造diff。 |
| [06 默认Chat项目](06-project-memory-default-en.png)、[07 键盘滚动末尾](07-project-original-keyboard-scroll.png) | 无Task也能读原项目MEMORY.MD，显示revision3/523tokens和英文日期；键盘End后原文末尾与焦点可见。 |
| [08 无Task项目检索](08-chat-project-search-en.png)、[09 清空恢复](09-project-search-cleared-en.png) | 语义搜索真实提交/无结果/清空回列表，受保护文档继续可读。 |
| [10 另一项目](10-other-project-context-en.png)、[11 连续切换返回](11-project-switch-return-en.png) | 账单项目1926字符/revision3/482tokens；实际连续A/B/A选择后回到Chat项目原文和身份。未通过延迟夹具制造竞态。 |
| [12 中文项目记忆](12-project-memory-zh.png)、[13 中文空项目](13-empty-project-memory-zh.png)、[14 中文清空](14-memory-search-cleared-zh.png) | 标题、说明、空态、日期及控件按中文；原模型文档保留真实英文。真实空项目revision0/0tokens，无新造记忆数据。 |
| [15 中文选另一项目](15-selected-project-context-zh.png)、[16 保留原会话](16-original-conversation-retained-zh.png) | 在真实JSON会话打开设置、选择另一项目，再返回；仍是原JSON会话、原Sources、原read5行及真实模型回复。 |

16张原图均实际呈现并人工查看。截图07最初抓到浏览器平滑滚动中间态，后以稳定末尾画面更新同一原图；不是像素/DOM（Document Object Model，文档对象模型）自动断言或UI自动化测试。

## 数据和运行证据

- [project-document-read.json](project-document-read.json)：生产GET的200/Project作用域、真实版本和内容字符数，以及与原SQLite文档直接比较的结果。没有复制文档到普通语义记忆，也没有组织器/模型调用。
- [data-review.json](data-review.json)：92表逐行比较。791源库116092行完全一致；基线116094、候选116096，均schema9/integrity=ok，每阶段仅新增一条运行激活lease和grant。所有旧行、33份项目上下文、61个Session、387条Message、1161条Part及5个Task保持一致；两附件命名空间17+10份原件与两副本全部逐字节一致。
- [runtime.json](runtime.json)、[runtime-after.json](runtime-after.json)：公开shutdown均200，原exec/native/launcher均0、物理/输出/请求结算及精确出生链退休；认证与完整模型目录副本退出后清退，原目录字节/元数据和认证元数据保持。最大请求0、实际0、累计793；清理余3228089/2194108ms，全部沿11:03首次启动的同一60min截止。
- [checks.json](checks.json)：普通Vite私有输出构建、Overlay类型和双语词条检查通过。真实页面使用最终main-D5zo1paJ.js；之后仅补源码说明注释和未发布文档，未再改运行逻辑。辅助checker不替代UI验收。

## 未覆盖与后续

此数据集中通用语义记忆只有空列表，没有真实note/fact条目，因此未冒称非空语义排序、展开或删除已实测；不通过SQL制造数据。没有永久删除、组织器运行、Goal启动/恢复、模型请求、用户数据库迁移或发布。文档失败/待整理提示、断线和故意延迟回应未实页触发；来源保护沿原连接权限和effect生命周期，实际快速选择不等于完整竞态证明。Review无变更线索保留待核查，非空文件筛选尚未验收。当前修复已实页确认，持续产品目标保持active。
