# 389 成员刷新失败可读性

沿[Recall与实施前分析](../../artifacts/2026-10-05-connection-workspace-authority/child-refresh-retention-plan-389.md)单agent修复。真实已加载成员记录的GET连接中断，使Solid resource getter在派生计算中抛出、child owner退休，局部错误未正常呈现。现在resource和呈现共用其单一storage，真实error与同目标已加载正文并列；初次失败明确重试。没有影子状态或扩大Markdown缓存。

第一轮修后人工复核发现长Details挤出正文，继而加入可聚焦、有本地化名称的限高详情region。正式压缩构建实际Tab聚焦、End阅读错误末尾，Sources仍可见；重试及文件第2—3行高亮通过。中英文刷新提示、首次失败和重试均在独立实际/ui查看。[完整证据](../../artifacts/2026-10-05-connection-workspace-authority/child-refresh-retention-389/README.md)保留原失败截图和诊断记录，没有UI自动测试。

三scope累计23次真实Sol流式请求，全部传输200/EOF；final首条模型消息仍为服务过载失败，经新用户输入才完成后续验收，原Message错误逐字段保留，不能报告23次业务全成功。三原生服务、代理、页面和复制auth/models均按原固定期限正常收尾。类型与正式构建通过，范围提交和上游同步随文档检查收尾。

本次另外定位了仍未解决的成员身份不一致：消息事件work、生命周期assistant导致新消息归属失败；已启动共享入口、轮次、终态、恢复和项目隔离审计，下一轮继续后台身份来源修复。本轮资源错误UI交付不覆盖这项失败，也不覆盖原Research Studio全部场景。持续goal active。
