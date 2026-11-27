# 跨对话项目记忆接续证据

关联[规格与Recall](../../records/2026-11/2026-11-28-memory-session-continuity.md)。不保存凭据、模型目录或完整系统提示。各类证据只证明其实际范围。

- [改前位置数据](before-reference-facts.json)：真实`records.csv:1–5`仍被当完整路径，区间为空。修复后的仓库纯数据检查31项50断言，四种EN DASH范围精确映射到含首尾SourceFileRange；它不是UI自动验收。
- [实际模型请求背景节选](context-facts.json)：两项目各4条work请求的完整正式记忆对应版本`[1,1,1,2]`，源读取者绑定实际Session/输入/角色。首条精确等于各自原记忆，最后一条等于新版；原内容在`before-*-memory.json`及`run140-*-memory.json/md`。仅原样截取实际`/instructions`中的session-state，全文身份直接比较，没有摘要/源码哈希门槛或模型自述替代。
- `continuation-inputs.json`是创建前确定的两个任务和原表数据；`run140-{north,south}-*`保存真实用户消息、三个实际工具、正式发表及记忆。本人已阅读两篇全文，记录4条/18.00与4条/22.00、退款及样品、来源和解释边界正确。`run141-*-*`及[重开事实](reopen-facts.json)证明同一消息/发表物/记忆在候选服务重开后完全一致。
- 消息文件为[可复核字段投影](message-projection-facts.json)：保留实际消息身份、角色、原文、工具、来源、发表和步骤，不归档Provider推理及其不透明协议元数据。完整原始公开对象先在私有检查器比较相等，投影不会修改产品消息或持久数据，也不被描述为完整协议导出。
- [原始字节包](original-bytes.zip)保存north/south原handoff.md 153/159字节、新records.csv各111字节、旧CSV 59字节，逐成员与创建前规定的输入或原保护原件比较；避免Git（版本控制工具）文本换行转换改变原件。`facts-run{140,141}.json`及`reference-facts-run{140,141}.json`保留原23文件/2765旧行/两个Task和23引用行、实际旧CSV读取合同与[定位器](csv-locator.json)。
- [140流](stream-facts-run140.json)12条、[141流](stream-facts-run141.json)2条精确Sol流均HTTP200/自然EOF、源读取者收敛。[退役事实](runtime-cleanup-facts.json)记录原67389/96413均退出0、配对凭据/目录副本退役、57548端口停止。本批412页已由绑定API关闭，中文/系统主题未改；旧392页失去绑定仍未安全关闭，未记为通过。

12张原生截图均本人查看，未经图像编辑或UI自动比较：

|截图|人工复核对象|
|---|---|
|[01](01-north-continuation.jpg)、[02](02-north-source.jpg)|基线北仓文档/原表和底部尚无动作的实际EN DASH引用|
|[03](03-south-continuation-before.jpg)|基线南仓文档、4条/22.00；裸文件名保持普通代码是现有合同|
|[04](04-north-en-dash-link.jpg)、[05](05-north-en-dash-range.jpg)|同一真实引用在候选中可点击，并打开北仓原表、完整标出第1至第5行|
|[06](06-north-document-expanded.jpg)、[07](07-north-document-end.jpg)|北仓完整作品视图首部/总数4/18.00及底部结论/来源|
|[08](08-south-source.jpg)|南仓同名原表S01—S04及原始金额，Project归属正确|
|[09](09-south-document-expanded.jpg)、[10](10-south-document-end.jpg)|南仓作品视图总数4/22.00与退款样品/利润/实际验证边界|
|[11](11-south-memory-v2.jpg)、[12](12-north-memory-v2.jpg)|正式项目记忆版本2、552/559词元、各自新records.csv任务|
