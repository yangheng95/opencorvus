# 对话原来源查找实页证据

[调查与方案](../../records/2026-10/2026-10-30-source-conversation-find.md)。本批只有一个 agent；三次隔离 native 开发服务均访问 `/ui`，真实交互后截图逐张人工查看，没有运行 UI 自动化测试。用户 18571 服务没有操作；来源均为已有消息，不重新抓取网页或执行历史输入，模型请求为 0。

## 基线与返工

- [01 原文件来源](01-before-original-file-source.png)、[02 来源摘录查不到](02-before-source-not-searchable.png)：第 7 来源的原摘录含 `999.999`，原查找为 0。
- [03 原网页摘录](03-before-original-web-source.png)、[04 网页摘录查不到](04-before-web-excerpt-not-searchable.png)：保存的 W3C 摘录含 `Proposal Documents`，原查找为 0。
- [05 首次命中](05-after-source-search-result.png)暴露相邻来源路径混入预览，随后修正。[06 来源展开](06-after-original-source-revealed.png)、[07 原文件第44行](07-after-original-file-location.png)、[08 原位置查询](08-after-location-query.png)为首次候选。
- [09 Task定位未结清](09-after-task-original-source.png)是失败证据：来源容器 `display: contents` 无自身布局框。将定位身份移到现有实际来源行后，在新的冻结实例复验；不把这张图记为通过。

## 最终人工复核

- [10 Task参与者原来源](10-verified-task-original-source.png)：`invoice.py:1:5` 命中原 Builder 消息，回车后查找关闭，原来源行出现在参与者面板。
- [11 网页摘录展开](11-verified-web-excerpt-revealed.png)：`Proposal Documents` 命中保存的原摘录，定位原 Writing 来源并展开；没有在线重新读取。
- [12 来源预览](12-verified-source-preview.png)：`999.999` 仅显示命中来源内的上下文。
- [13 隐藏来源展开](13-verified-hidden-source-row.png)：从默认折叠的 8 来源组定位第 7 个原来源；[14 普通正文定位](14-verified-original-text-navigation.png)继续命中并显示原用户消息。
- [15 中文查找提示](15-verified-chinese-source-search.png)、[16 中文原来源定位](16-verified-chinese-source-location.png)：提示、计数、日期与来源控件使用中文，真实路径保留原文。
- [17 原文件第44行](17-verified-source-file-line44.png)：最终来源打开原 `test_invoice.py`，第 44 行含 `999.999` 的真实代码被选中，未编辑文件。

定位粒度为原来源行及其摘录，不声明摘录内部查询字词的字符级定位。复制按钮实际反馈“已复制”，本次浏览器剪贴板读回为空，不把该反馈当作独立剪贴板内容验收；打开原文件位置已有明确截图证据。文档型来源检索由纯数据合同覆盖，本批没有对应真实文档来源页面截图。

## 运行与数据保全

[检查回执](validation.json)记录聚焦纯数据测试 22/0、47断言，overlay 构建、类型、语言键检查均成功；[数据回执](data-qualified.json)记录原生 SQLite 原值对照、完整 HTTP、附件和项目保全。

三次实例均公开 shutdown 200，原 native/launcher exit 0、物理进程/输出/请求完成；配对认证及完整模型目录副本退休，原认证元数据和模型目录字节/元数据保持。原库 schema 9、92 表、204873 原行完整保留，最终 204879 行只增加三组服务 lease/grant；75 附件、8 项目/28 tracked 文件和 Git 状态逐原件核对保持。Task/Mission/Chat/Work 的完整原会话、选择、分页和 Goal 深度比较相同。

基线在原 60 分钟窗口内退出并保留 3161162ms；离线分析跨过原截止后，候选采用新的固定 B 窗口，after 与 verified 共用该窗口，分别余 2969968ms / 2513510ms 完全退出，没有延长旧截止。
