# 来源摘录阅读证据

对应[调查与方案](../../records/2026-11/2026-11-04-source-excerpt-reading.md)。所有图片是本轮真实原生开发页面的完整桌面截图，已逐张人工查看；不是自动化测试、截图基线或像素断言。

前态 38679 / 隐藏页 251 / main-2viiIibi.js，后态 38680 / 隐藏页 252 / main-BGYH6iZ3.js。均复制自已退役的本人隔离数据，使用已存在的 752 代码检索会话及 875-after 文件/网页交付会话，没有注入消息或来源夹具，没有新增模型请求；用户 18571 窗口和数据库未操作。

|截图|人工复核结果|
|---|---|
|[01](01-original-file-sources.png)|原文件来源只有 quotation 小图标可打开保存摘录。|
|[02](02-saved-file-excerpt.png)|原受控普通弹窗确实能显示和复制保存原文。|
|[03](03-expanded-code-sources.png)|8 个真实 search_code 匹配及原行列，整组复制保留 8 条原位置。|
|[04](04-saved-long-code-line.png)|77 字符原代码行被默认窄弹窗折为三行，含原缩进。|
|[05](05-current-file-line-column.png)|打开当前原文件，实际定位第 24 行第 13 列，与保存摘录分开。|
|[06](06-long-web-excerpt.png)|原 CSV 网页保存摘录可展开，无重新抓取网页。|
|[07](07-web-excerpt-reading.png)|真实 PageDown 阅读内部区域；平滑滚动完成后 top 500。|
|[08](08-reopened-web-excerpt.png)|收起再打开仍从 top 500 继续，非重新从头。|
|[09](09-second-web-source.png)|第二份 JSON 原摘录可独立读到尾部；两项位置复制正确。|
|[10](10-chinese-return-reading.png)|设置切为中文并返回后，来源控件本地化，原文保持。设置悬浮提示不是消息内容。|
|[11](11-collapsed-source-group.png)|实际收起组后，第一份原摘录内部 top 500 保留。|
|[12](12-wide-saved-excerpt.png)|后态使用既有 wide 普通弹窗，含保存时间语义与当前文件说明。|
|[13](13-labelled-file-excerpts.png)|文件保存摘录可见文字入口，8 项按可用宽度自然换行。|
|[14](14-readable-original-code-line.png)|同一 77 字符原代码行完整一行可读，未改 snippet。|
|[15](15-labelled-excerpts-with-file.png)|原文件面板打开时，较窄对话区域每个文件身份、范围与摘录动作仍可辨认。|
|[16](16-chinese-labelled-excerpts.png)|中文“来源摘录”入口，原代码与行列不翻译。设置悬浮提示不计为正文。|
|[17](17-chinese-readable-code-excerpt.png)|中文普通弹窗、说明和完整代码行；关闭返回原入口，原文件面板保留。|
|[18](18-after-web-excerpt.png)|后态中文原网页摘录真实展开与阅读，原来源记录保持。|

[qualification.json](qualification.json) 记录公共状态、原库/schema/文件/附件保全、实际进程收敛及登录验证。数据读取、类型检查和普通构建只是各自的局部证据；视觉结论来自上述交互与截图人工复核。

实际剪贴板验收：前态复制 26 字符文件摘录、8 条含原行列位置、4074 字符 CSV 原摘录和 2 条原 URL；后态复制 77 字符原代码行，保留 12 个前导空格。每阶段先在浏览器内存保存原剪贴板，仅当当前内容仍为本轮写入时恢复，不记录其原内容。

范围限制：本轮没有新增模型输出、当前流中 Sources 行为、Side Chat 独立操作或外部网页打开资格；不以历史模型调用/截图冒充本轮完成。网页标题、摘录和文档版本为原来源事实，不宣称是当前网页版本。纯展示调整，没有 API、schema、迁移、版本或发布变化。
