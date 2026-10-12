# 360 来源展开与收起动作

[Recall与方案](../source-toggle-plan-360.md) · [月记录](../../../records/2026-10/2026-10-13-source-toggle-360.md)。来源顶部按钮现在明确表达当前可执行的展开/收起动作，并保留真实数量。单agent完成共享UI（User Interface，用户界面）修改与真实桌面页面复核。

## 改动与实际结果

此前已展开的来源组仍写“63 more sources”，点击却会收起；351只增加末尾收起入口，358只调整文件名/行号，未改变这个顶部文案。现在同一cardExpanded决定Show 63 more sources / Collapse 63 sources；中文为展开其余63条来源 / 收起63条来源。两条来源的分组对应Show 1 more source / Collapse 1 source，计数明确排除一直可见的第一条。

只修改SourceParts文案派生、中英文catalog与07-panel合同；保持单一details/summary、既有底部按钮、Source身份/顺序、阅读暂停和焦点返回。没有API、数据协议、Provider、调度、队列或新的状态Store。

| 实际画面 | 人工复核 |
| --- | --- |
| [03主聊天折叠](03-main-collapsed-visible.png)、[04展开](04-main-expanded-visible.png) | 文案从Show切换Collapse，实际其余63条展开 |
| [05键盘收起](05-main-keyboard-collapse.png) | Space收起，焦点仍在原summary，文案返回Show |
| [06英文窄Side](06-side-expanded-english.png)、[07 Enter收起](07-side-keyboard-collapsed.png) | 380px侧栏按钮完整可读，Enter和鼠标行为一致 |
| [08中文折叠](08-main-side-chinese-collapsed.png)、[09侧栏展开](09-side-chinese-expanded.png)、[12主聊天展开](12-main-chinese-expanded.png) | 中英文切换后主/Side提示与状态对应 |
| [10列表末尾](10-side-trailing-collapse.png)、[11末尾返回](11-side-trailing-return.png) | 原末尾收起动作将焦点返回顶部，顶部同步恢复展开提示 |
| [14真实两条来源](14-live-two-sources.png)、[15英文展开](15-live-singular-expanded.png)、[16键盘返回](16-live-singular-keyboard-return.png) | 新实际gpt-6.1-sol检索的两条Source，单数语义与真实数量一致 |
| [17中文保持展开](17-live-chinese-singular-expanded.png)、[18中文末尾返回](18-live-chinese-collapsed-return.png) | 展开时切换语言仍保持原状态，末尾返回正确显示展开其余1条来源 |

前两scope的18张截图已实际呈现人工查看。01为尚在加载的空视图，02尚未把来源滚入视口，13为请求刚提交时的中间画面，三者不作为完成或来源视觉验收。没有DOM（Document Object Model，文档对象模型）/文案/组件/快照/像素断言，也没有UI自动化测试。

## 真实运行与数据边界

history / localhost:18355/ui / 页173：原启动95647实际exit0，Native耗时232516ms。重新读取356-live-02原库的全源启动条件后完整copy90表，11 Message/192 Source逐值与原库一致。Main及Side各自64来源和Side继承来源保持原事实。历史无凭据，Model configuration unavailable是该阅读模式限制，不能宣称新的Provider资格。

live / localhost:18356/ui / 页174：原启动78524实际exit0，Native耗时203967ms。复制授权OpenAI entry及完整models.json，独立确认credential usable、catalog projected、actual gpt-6.1-sol streaming。当前会话ses_-zUS8Ihb7zz9s4WDV7x3通过真实Web UI提交search_code，工具输入为pattern SOURCE360、path资料/展开核对、include *.md；返回两条实际匹配，Source分别为乙.md:2和甲.md:2。[原始输入文件记录](search-inputs.json)与真实工具结果核对一致，未重写来源或合成消息。

本次5个Provider请求全部gpt-6.1-sol、streaming true、HTTP 200、reader EOF（End of File，流结束）；NativeService资格通过，复制auth/models成对清除。两个scope均固定600000ms，自建页面先关闭，公共shutdown及原handle join完成，精确Host/Native/端口/输出/request闭合，自有Bun pile按精确出生与路径归档。没有用户应用操作、子agent委托或产品成员派遣。

[实际runtime checker](checks/runtime-qualification.json)仅检查原库/当前SQLite、输入文件、Source/工具结果、实际Provider流、HTTP资产交付及Native事实；两个scope实际交付main-C-GbKPJC.js。它不检查UI文案或剪贴板，不替代人工截图。类型76697、正式构建15046及两locale结构检查通过，docs见[检查日志](checks/docs.log.gz)。[完整归档](checks/archive-receipt.json)及[凭据扫描](checks/credential-scan.json)包含所有文本和解压内容；归档回读只证明压缩字节完整性。

## 上游SDK 7合并后的独立补验

05ac270c4首次push的检查全部通过，远端并发升级到2ccf6a76d导致正常拒绝。fresh fetch后把两份阻挡合并的其他任务索引追加精确备份/暂存，普通merge为6d3a6c230；随后完整恢复原追加内容并清理自有stash，私有备份保留。没有覆盖其他工作、rebase或force push。上游升级本身已在独立用户任务验证；此处补的是当前实际Sources与OpenAI路径，不把旧SDK的回执算作新结果。

冻结安装完成；完整8/8类型检查94424 exit0、正式构建8776 exit0。当前实际依赖ai7.0.138，main-GGpG4cxE.js。fresh integrated /18357 /页175的5个gpt-6.1-sol请求全部流式200/EOF，独立预检usable/projected/actual model通过。新会话ses_-zUS8E6JXzzq8naGiv7Z实际检索[新输入文件](integrated-search-inputs.json)，返回原甲/乙各第2行的两条Source。

[19英文折叠](19-integrated-english-collapsed.png)、[20英文展开](20-integrated-english-expanded.png)、[21 Space收起](21-integrated-keyboard-collapse.png)、[22展开时切中文](22-integrated-chinese-expanded.png)、[23末尾返回](23-integrated-chinese-return.png)均已实际人工查看。合并后新结果与之前18图分别保留，共23图。原启动40203实际exit0，Native耗时232279ms，固定600000ms内关闭，复制auth/models清除；所有自建页面/服务均已关闭。

[独立集成checker](checks/integrated-qualification.json)核对新canonical Source、真实输入/output、5个模型请求、依赖版本、HTTP及Native事实，无UI断言。[追加归档](integrated-checks/archive-receipt.json)、[全证据凭据扫描](integrated-checks/credential-scan.json)、[合并后docs](integrated-checks/docs-integrated.log.gz)。本轮没有改变来源实现以兼容旧SDK，也没有修改其他用户任务的国际化或更新日志。

## 限制与并行工作区

359的跨网站首次复制异常保持未解决，未改clipboard实现，也未把本轮交互当作复制验收。新的持续Rendering、大Research Studio历史、附件和child独立视觉不属于本轮已验证结果；长期目标继续active。

构建期间另一个用户任务修改了TitlebarBrand、ReleaseNotesPanel、changelog与titlebar.homepage语言键，并给根/月索引添加独立记录。这些变更保持原状，不混入本轮提交；本轮locale只提交Sources的四条动作文案，索引只提交360条目。当前工作区i18n结构检查2142键包括该独立键，不能把键数宣称为本轮单独新增数量。本轮未发布或升级版本。
