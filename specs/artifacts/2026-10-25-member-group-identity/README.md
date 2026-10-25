# 成员分组与真实事件中的身份变化

[方案与Recall](../../records/2026-10/2026-10-25-member-group-identity.md) · [实际调查证据](evidence.json)。

当前生产bridge、replay压缩器、成员投影器和纯数据分组函数读取完整关闭副本的2861条真实outbox快照。236个Session中234个可投影；另外两个缺失真实Message行的错误原样保留。原发布次序下未发现所记录的祖先分组坐标变化；压缩重放中有21次，均为用户上下文的较早text补齐，没有本样本内助手正文或Source触发的坐标变化。原Task B九个来源、九个正文Part的实际记录单列。

758条实际非空文本在当前Markdown词法解析中都有可显示token。该结果只覆盖持久快照与最终文本，不覆盖每token瞬态、浏览器帧或组件退休，不能当Rendering根因或视觉验收通过。

本批没有产品修改、没有UI或原生服务启动、没有浏览器操作、没有UI自动化测试、没有凭据复制或Provider请求。原有限分析调用者/子进程返回0，Instance owners已dispose；完整schema8/92表214319原行字段、配置、源库bytes/mtime与模型目录原件核对保持，模型目录副本已清退。原高频Rendering仍待真实根因证据，下一步检查Task成员投影和选择生命周期。
