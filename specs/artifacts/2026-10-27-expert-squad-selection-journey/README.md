# 专家团理解与明确选择

[Recall、根因与实施](../../records/2026-10/2026-10-27-expert-squad-selection-journey.md) · [实际运行事实](evidence.json)

16张1280×720原图来自655—658四个独立开发CLI（Command Line Interface，命令行界面）的真实/ui桌面手工交互，逐张人工查看。未运行UI（User Interface，用户界面）自动化测试、浏览器夹具、截图基线或像素比较。

| 原图 | 实际观察 |
| --- | --- |
| [01-installed-details-en.jpg](01-installed-details-en.jpg) | 已安装详情正常打开，原完整包描述可读 |
| [02-installed-details-zh.jpg](02-installed-details-zh.jpg) | 中文控件和原包内容，名称及身份保持 |
| [03-truncated-selection-descriptions-zh.jpg](03-truncated-selection-descriptions-zh.jpg) | 创建表单原说明被单行硬裁掉 |
| [04-query-cleared-selection-preserved-zh.jpg](04-query-cleared-selection-preserved-zh.jpg) | 原有非空选择在查找/清除后正确保持 |
| [05-cleared-choice-misreported-unavailable-en.jpg](05-cleared-choice-misreported-unavailable-en.jpg) | 明明五项可用，却把取消全部选择误称不可用 |
| [06-search-reselects-first-candidate-en.jpg](06-search-reselects-first-candidate-en.jpg) | 仅输入查询就自动勾选第一项 |
| [07-cleared-choice-select-hint-en.jpg](07-cleared-choice-select-hint-en.jpg) | 修复后0及准确选择提示；工具深层滚动状态，仅用于局部证据 |
| [08-search-retains-cleared-choice-en.jpg](08-search-retains-cleared-choice-en.jpg) | 修复后查询仍0，完整说明自然换行 |
| [09-no-match-cleared-choice-zh.jpg](09-no-match-cleared-choice-zh.jpg) | 中间中文空态；随后进一步明确为已安装列表 |
| [10-explicit-single-selection-zh.jpg](10-explicit-single-selection-zh.jpg) | 用户明确点击后才成为1项 |
| [11-saved-explicit-selection-board-zh.jpg](11-saved-explicit-selection-board-zh.jpg) | 实际保存的新草稿在待规划栏 |
| [12-saved-mission-context-zh.jpg](12-saved-mission-context-zh.jpg) | 同一原需求可读，输入区另显示当前配置资料 |
| [13-final-installed-no-match-en.jpg](13-final-installed-no-match-en.jpg) | 最终英语已安装范围与市场结果明确区分 |
| [14-final-installed-no-match-zh.jpg](14-final-installed-no-match-zh.jpg) | 最终中文已安装范围与市场结果明确区分 |
| [15-final-readable-explicit-choice-zh.jpg](15-final-readable-explicit-choice-zh.jpg) | 最终说明全文、明确勾选和已选数量一致 |
| [16-final-reopened-original-draft-zh.jpg](16-final-reopened-original-draft-zh.jpg) | 新CLI启动后原草稿身份和需求保持 |

真实根因为查询响应额外写入所选ID（Identifier，标识）、空选择与候选可用性混同，以及下拉目录/专家团说明共用单行裁切样式。修复使用原唯一选择数组与原计数派生值：搜索只更新候选，初始化/显式安装/用户勾选仍是原选择入口；可用未选、无匹配和真正无兼容目录各有准确提示。已选数量和多选说明接入当前语言，说明全文保留原包原文，原生列表可以滚动，项目路径下拉保持原紧凑呈现。

真实选择循环覆盖英语0→查询0→明确1→清除1→增加2→移除1；中文0→无匹配0→Research查询0→明确1→保存。实际Mission 54a50f018d0c2d91 / Session ses_-zUQoHGCfzzOdSg0GuuG的公开规范metadata.mission.visibleExpertSquadIDs精确为research-studio单项，原需求、work/backlog（工作/待规划）和空消息一致。658从完全关闭657只读备份后，原身份、需求和固定快照再次通过公开读取与实际页面重开验证。

固定可见专家团快照与当前生效PromptProfile（提示配置）是不同公开事实。12/16输入区Dynamic属于当前配置；其弹层与公共catalog（目录）均明确这个含义，不能把它当作固定快照标签或据此声称草稿保存失败。未执行Mission，不能宣称模型执行包选择已经验收。也没有安装市场包、改变项目默认配置或提供整个包库翻译。

四次源数据库分别92表713、713、713、766行，逐表源行精确保留；原关键事实分别25、25、25、26条严格保持，无原Session字段变化，只有657新增自己的草稿。schema（结构）8、原README（项目说明）字节保持。本批未复制认证、模型请求0、累计真实模型222。所有自建标签关闭，公共shutdown（关闭）200、原执行会话/宿主/启动器0，物理完成、输出排空和请求清理结清；精确余量见运行事实。
