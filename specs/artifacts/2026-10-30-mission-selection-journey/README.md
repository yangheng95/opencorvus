# Mission 创建搜索与保留选择

对应[原要求、根因、方案与实际结果](../../records/2026-10/2026-10-30-mission-selection-journey.md)。真实开发serve /ui、人工交互与原图查看；无UI自动化。生产修复让原目录请求投影保留实际匹配身份，正确解释保留选择和空结果，不更改搜索算法、选择所有者或数据库。

| 原图 | 实际内容 |
| --- | --- |
| [800-01](800-01-selection-initial.png) | 当前基线Code初始目录，Selected1 |
| [800-02](800-02-search-retained.png) | 原零匹配搜索仍显示选中Dynamic，却没有匹配来源说明 |
| [800-03](800-03-search-cleared.png) | AX点击未改变原选择，仍Selected1；不计作清空 |
| [800-04](800-04-selection-zero.png) | 点击可见勾选后真正Selected0，原前提仍只提示选择专家团 |
| [800-05](800-05-no-match-fixed-en.png) | 候选零匹配说明、保留选择和英文外部匹配标记 |
| [800-06](800-06-zero-selection-fixed-en.png) | 清空后真实空结果前提可见，创建按前提禁用 |
| [800-07](800-07-partial-match-fixed-en.png) | 部分命中列表顶部；保留Dynamic在下面离屏 |
| [800-08](800-08-partial-match-visible-en.png) | 滚动中间位置，Dynamic标题到达底部 |
| [800-09](800-09-partial-match-scrolled-en.png) | 再滚动后原Dynamic选中项与Outside this search清楚可读 |
| [800-10](800-10-type-work-reset.png) | 切Work后查询清空、原上下文选择重建 |
| [800-11](800-11-no-match-fixed-zh.png) | 中文手动表单、原需求、唯一Base选择和零匹配提示 |
| [800-12](800-12-retained-visible-zh.png) | 滚动后中文保留标记、原描述及可用的创建草稿 |
| [800-13](800-13-draft-saved.png) | 实际新草稿出现在待规划列 |
| [800-14](800-14-draft-opened.png) | 打开原草稿显示完整原文及尚未开始说明 |
| [800-15](800-15-goal-entry.png) | 首页/goal原文移交目标确认表单 |
| [800-16](800-16-goal-cancel-draft.png) | 关闭目标表单后原输入保留 |

search-empty-response.json是真实200查询的原JSON，entries为空；draft-qualification与publication-qualification连接真实HTTP原Mission/Session、最终SQLite选择和53新增事实的归属。before/after-data-review是关闭库逐表/附件/文件/Git检查，retirement与provider-audit保存精确物理结算及零Provider。构建、类型和locale合同原输出无损保存在UTF-8 output JSON中，解码即原日志，另有原退出结果。截图模型配置提示来自有意不复制auth的隔离运行，未触碰用户18571或原用户库。

此批没有市场安装、AI创建/执行或全Goal生命周期结论。原包名称/描述作为作者内容保留；新增产品提示覆盖中英文。
