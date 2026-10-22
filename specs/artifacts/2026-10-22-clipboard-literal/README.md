# 代码复制字面实体

[Recall、根因与实页结果](../../records/2026-10/2026-10-22-clipboard-literal.md)。单agent、真实成员输入与模型流、内置浏览器，不造消息/工具或浏览器fixture，不跑UI自动化。

删除main Copy handler对已解析DOM属性再次解码，直接交同一clipboard writer；模型/原文、HTML安全编码和消息保持。原实体、嵌套实体、引号、中文和emoji按代码复制。

| 图 | 实际人工复核 |
| --- | --- |
| [01](01-before-native-baseline.png) | before自有composer原生基准copy/clear/paste |
| [02](02-before-html-entity-copy.png) | reading内HTML实体被展开，属性引号损坏 |
| [03](03-before-nested-entity-copy.png) | reading内嵌套实体被多展开一层 |
| [04](04-before-final-text.png) | before最终24节/结束标记 |
| [05](05-after-native-baseline.png) | after不同自有原生基准 |
| [06](06-after-html-entity-copy.png) | reading内HTML实体/引号/中文emoji原样粘贴 |
| [07](07-after-nested-entity-copy.png) | reading内嵌套实体全串与原围栏一致 |
| [08](08-after-final-text.png) | after最终24节/结束标记，验收输入清空 |

07为修复主图，02/03为原缺陷。8图均实际呈现并人工查看，不是DOM/截图断言。baseline是测量准备，不向产品加预写/重试，不能证明全部宿主首用clipboard交接。追加Main URL因delegation身份缺少conversation元数据按合同404，不计该入口通过，不报告全日志clean。

元数据记录实际8/16 Sol streaming/200/EOF、完整原生与8成员清理、源90表156566原行保持及隔离自然增量、类型/2纯transport正向合同/正式构建。脚本依赖原504/413/446宿主、冻结Bun与闭合523数据，不是独立安装包。完整DB/权限目录/原始Provider正文与runtime私有日志不归档；秘密扫描含所有解压内容和修改源码/契约/三索引。
