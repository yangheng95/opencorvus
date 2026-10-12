# 367 文件来源的精确列定位

[Recall与影响分析](../source-column-plan-367.md)。当前来源和正文文件链接共用SDK SourceFileRange，单行可记录原始UTF-16列，搜索预览的裁切/脱敏位置不替代原位置。编辑器保留当前列、重复打开与隐藏返回请求，并按当前文档字符边界约束。

## 实际验证

- 01–04：真实Main来源显示L1:2542/L1:5054，两处同文件同一行分别打开到ALPHA/BETA；重复点击保持第二处。
- 05：中文行内代码引用仍是普通代码，点击没有定位。这是新发现的ASCII路径识别缺口，尚未修复，不属于已通过项。
- 06–09：随后模型真实输出标准Markdown相对文件链接，第一处、隐藏后第二处及中文emoji短行2:10都正确定位。06由本地图片读取额外人工查看，全部图片均已亲自复核。
- 10：read第2–3行仍按原合同显示多行标记，光标在起始行。
- 11–13：Side实际search_code来源5054可打开到BETA，返回Side仍保留来源。Side最后回复触发预设累计12请求上限，保留可见错误；未宣称完整Side会话通过。此次未独立进行中文语言标签及所有跨面板矩阵验收。
- `checks/runtime-observations.json`：真实SQLite共9个Source（Main4、Side继承4、Side新1），列/身份/完整作者文件字节/生产ToolOutcome逐值核对通过。12个实际gpt-6.1-sol请求均流式HTTP200/EOF，另一个尝试由固定预算拒绝。当前bundle HTTP200。
- `checks/`：正式SDK生成、55聚焦非UI正向测试（backend40、纯parser/service15）、8/8类型、正式构建、i18n。改前Source4失败/搜索5失败、精确parser1失败及误用Bun根目录pattern的导入错误完整保留；未运行UI自动化测试。

唯一18368隔离scope固定600000ms，实际267121ms内Native exit0、output/request/端口/私有auth+models配对均闭合。原launcher10710 **exit1**，因Provider exhausted=true返回`OWNED_PROVIDER_COMPLETION_INVALID`，不存在成功qualification回执；观察checker通过只证明上述Source合同与物理闭合，不能把原验收改写为成功。没有扩期或重开同一scope。凭据内容不入证据/日志/提交。

单agent持续目标仍active。下一轮处理05的中文代码路径识别；旧359首次复制的浏览器边界未知继续保留。
