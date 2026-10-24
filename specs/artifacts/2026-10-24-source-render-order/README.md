# 成员对话实时 Part 顺序修复

对应[调查与实施方案](../../records/2026-10/2026-10-24-source-render-order.md)。573由单一开发agent在自有原生开发服务 `http://localhost:54057/ui/` 手动交互、截图并逐张查看；用户18571实例未操作。

实际持久发布通过生产bridge、重放压缩器和完整成员projector，228个可投影Session/736条消息修复前有22条Part倒序，修复后为0。另两个Session历史含已删除Message而被当前bridge明确拒绝，未计入通过。22条均为user角色输入；原B的一条是orchestrator派发上下文。这修复了确实存在的顺序合同缺陷，不能冒充assistant正文Rendering闪烁的根治证据。

| 实图 | 人工观察 |
| --- | --- |
| [01](01-member-history.png) | 原B完整历史末段、真实W3C说明和表格，侧栏可读 |
| [02](02-source-and-prose.png) | 原计划、webfetch记录、网页来源标题/域名及后文依次显示 |
| [03](03-tool-source-detail.png) | 手动展开原工具，实际输入和返回可读；来源在工具详细内容之后 |
| [04](04-source-after-collapse.png) | 收起后来源卡片、前后正文和阅读位置保持可读 |

[evidence.json](evidence.json)记录真实生产投影前后结果、两个排除错误、公开Task/Session子会话读取、构建、完整数据保留和进程结算。两个公共接口各返回24条消息、77个Part和6个网页来源，原Part顺序相同；原附件公开读取200/643字节，与真实不可变原件一致。两个聚焦非UI测试文件32项通过，类型检查通过。

本批没有复制auth或发起模型请求；隔离页的模型未配置提示属于这个只读范围，不代表用户热认证失败。原90表/197241行及全部原字段时间、schema5、源库与canonical保持；构建期间副本SQLite文件大小和修改时间保持。原exec/native/launcher均0，公开shutdown200且距固定deadline至少五分钟，物理/输出/请求及原进程出生链已收敛，复制的完整模型目录已清退。

没有进行新Provider流或真实断网重连；历史重放checker不是实页重连验收。未复现新的Rendering闪烁，整体问题继续调查。首次私有checker错误使用不存在的sources类型，已修成真实三种Source类型并重跑；首次测试路径过滤误选临时重复工程，精确文件路径已重跑通过；首次构建在自有home保护检查处终止，随后在正确隔离环境完成构建。全部保留为实际验证限制，不计作成功。
