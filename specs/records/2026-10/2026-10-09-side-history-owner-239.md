# 239 历史消息owner独立于当前Session actor

[Recall与修改前分析](../../artifacts/2026-10-05-connection-workspace-authority/side-history-owner-plan-239.md)。单agent，修复三处Side阅读问题：历史work引用与新chat的owner解析冲突、状态读取依赖缺失模型、关闭重开跳到底部。

共享parser改用现逐消息sessionAgentID校验，Session membership、Part、真实participant/order/time/parent约束保留。公开/status以现Project identity准入，将同一process状态按真实可见Project Session投影，内部全process用途保持；配置/执行入口仍验证runtime。Side数字top/following intent归现有有界UI store，selected controller/primary epoch/authority/可见geometry管理恢复；原onMount bottom与无条件tracking路径删除。无新协议/消息/Shadow内容、无fallback或UI自动化测试。

聚焦数据25pass、真实fork→HTTP→parser及冷模型两个Project终态输出2pass、route与runtime错误18pass，共45。类型99926/7143、build93616（49.81s）实际0。旧纯数据fixture更新已存在owner字段，runtime候选测试改用当前runtime路由，不为旧测试保留错误/status语义。

[原失败与完整真实after](../../artifacts/2026-10-05-connection-workspace-authority/side-history-owner-239/README.md)：review01恢复正文后暴露真实/status400，保留；review02读正常但中段1023→1342，后完成位置修复却触及原期限、Native/fore1，后段不算在线完整通过。review03全部修复预先构建，fresh完整原238 history90表复制，own80/18173实际Source5/引用4/原回复可读，native close/current-focus reopen中段720保持，状态请求200与正常连接亲自复核。

review03 sole shutdown/原fore6100/Native41636 actual0（14:20:27Z，原期限14:32:54Z），完整输出/请求/物理与pair读回；archive/custody0，13个核心表原行相同，两Project仅primary .git目录mtime变化。现Goal active。最终中文深色、真实新stream/成员/Mission/Tauri、selection/API竞态、缓存淘汰与resize语义锚点仍未知。

交付检查首次拒绝route层SQL和OpenAPI文案未同步；按现分层将同一投影移入Session.statusInProject，HTTP合同2项重跑/后端type0，route保持薄调用，未改变用户行为。SDK构建仅同步openapi/sdk注释的Project描述，api:routes-check原检查重跑0，docs/architecture0，原失败不隐藏。三scope own五个Bun文件均精确birth/bounds归档，03在全部运行观察器完成后归档；后续常规代码/生成器检查与Git hook不属于已退役Native观察器。
