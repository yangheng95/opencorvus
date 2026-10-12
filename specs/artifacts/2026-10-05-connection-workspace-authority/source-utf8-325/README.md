# 325 来源与附件的完整 UTF-8 前缀

2026-10-12，单 agent。[实施前 Recall](../source-utf8-plan-325.md)。本轮修复来源正文和工具文本附件在 UTF-8（8-bit Unicode Transformation Format，8位统一码转换格式）字节预算处的字符破损，没有前端改动或 UI 自动化。

## 修复与根因证据

[原生产实现红测](before.log.gz)通过真实 HTTP 和真实 AttachmentStore/Message 投影复现：Arabic 首行截断尾部变成 `�`，50688 字节预算实际显示 50690 字节；中文和 emoji 的内部切点也损坏。inline 与 persisted 文本附件都把截断后的半个汉字解码为替代字符。根因是把人为字节预算当作实际输入结束，324 的 HTML 语义转换没有改变这个最终边界。

新增唯一标准 TextDecoder 前缀解码 primitive，webfetch、文本附件及 Bash 实时预览共同使用，删除 Bash 的局部实现。裁剪尾部以流式 chunk 语义处理；真实完整输入正常结束解码，保留 BOM 与合法的替代字符语义。没有屏蔽所有 `�`、猜测省略字符、修改原文、引入新依赖或第二套预算。

[聚焦测试](after.log.gz)24项、134断言通过：网页实际 HTTP 的所有 2/3/4 字节内部切点、恰好边界、ASCII 与行优先，inline/persisted 附件，BOM、非零 TypedArray 偏移、真实非法 EOF，以及 Bash/网页元数据/HTTP 生命周期。核心[typecheck](typecheck.log.gz)通过；测试88874、类型25161均已 actual join exit0。没有全量测试或 UI 自动化。

## 真实公开来源与页面

普通单人 Work Chat `ses_-zUSD0wObzzWIfrgMMs4` 实际读取中文维基百科 `北京市` 的 JSON extract，format=text。[完整规范工具数据](live-01/canonical-current-conversations.json)与[字节契约核对](actual-utf8-contract.json)表明：原响应80190字节，正文前缀50687字节，准确省略29503字节；最后一个完整汉字为“并”，下一字“在”归于省略部分。

核对器独立逐 Unicode scalar（标量值）累计原始公开响应，完整比较 canonical Tool output 与预期前缀加提示；没有用模型自述当 oracle，也没有用源码哈希代替行为。原公开响应仅留在私有探查目录；仓库证据保留实际模型工具前缀、Source URL、长度和核对事实。[公共 API](https://zh.wikipedia.org/w/api.php?action=query&format=json&utf8=1&prop=extracts&explaintext=1&titles=%E5%8C%97%E4%BA%AC%E5%B8%82)用于这一具体读取，资料内容本身不属于本次结论。

四张真实截图均人工查看：[来源和简短引用](screenshots/01-source-and-complete-prefix.png)、[工具展开](screenshots/02-expanded-actual-output.png)、[展开长正文](screenshots/03-actual-output-boundary.png)、[真正工具末尾](screenshots/04-output-end-visible.png)。第三张滚动尚未到末尾，不据此宣称看到了截断；随后使用实际键盘定位，第四张同时显示工具末尾和准确截断提示。

本轮真实 Provider 的5次请求（含预检）均为 gpt-6.1-sol、流式HTTP200并正常读到末尾，处于原12请求预算。没有派发Task或产品worker。附件验证属于真实存储/投影的后端契约，未宣称执行了额外附件 LLM 端到端。

## 退出与剩余工作

首次启动参数误写已存在配置的目录名，在读取配置阶段即失败，尚未创建runRoot/进程或复制凭据；查找实际 `source-render-312/builtin.json` 后正常启动原计划的新 occurrence。未绕过启动检查。

自己的tab97已关；Native62952/Host70984物理退出、输出与请求收敛，18295释放、复制auth/models配对清理完成。[终态记录](live-01/source-utf8-325-live-01-qualified-surface-completion.json)与原启动执行器49097 actual exit0相互核对。4229条运行日志按原进程出生边界脱敏归档，0条未知时间；原始日志保留私有副本，压缩还原字节与原归档完整一致。

截图同时暴露下一项体验问题：没有发布者标题的 Source 会把较长且含百分号编码的查询串直接作为主标签，阅读负担仍大。这一观察已保留，尚未分析/修复，不把本轮字节修复宣称为全部 Sources 视觉完成。持续 goal 保持 active；剩余本轮提交和正常上游推送。
