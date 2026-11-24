# 全局查找跟进保存标题的页面证据

候选码修改前用实际隔离开发服务打开主项目的空白会话，查找另一个项目的已保存标题。所有名称都是本次合成测试数据，原项目没有被编辑。本人复核实际桌面视口。

| 实际步骤 | 观察 |
| --- | --- |
| [原查询读取已保存会话](baseline-search-before-rename.jpg) | 本项目原输入持焦，唯一命中来自 `control-review`。 |
| [同一会话正式更名后](baseline-search-stale-after-rename.jpg) | 侧栏已显示 Amber，保持打开的全局查找仍显示 Cedar。 |
| [改成新查询](baseline-search-manual-new-query.jpg) | 显示原项目当前标题 Amber 及完整目录提示。 |

[真实更名回执](baseline-rename.json)记录正式搜索前后结果、准确会话 ID、200 回执、统一工作记录流中同一 ID 的 `titleChanged` 通知。基线最后发起 Enter 导航后关闭本次页，只记录查询结果。

## 候选证据

| 实际操作 | 桌面记录 |
| --- | --- |
| 活跃的 Cedar 查询收到原会话更名通知 | [改名前](verified-search-before-rename.jpg)和[自动退出旧命中](verified-old-title-removed.jpg) |
| 已确认无匹配的 Spruce 查询刚获得匹配标题 | [出现新命中](verified-new-title-appears.jpg)和[按 Enter 打开另一项目的原会话](verified-opened-exact-session.jpg) |
| 现有查询键盘加载第二页，再接收三次真实更名 | [原 H-02 活动项](verified-harbor-deep-focus.jpg)和[重读后原位置与更新标题](verified-harbor-refresh-depth.jpg) |
| 标题刷新响应被中转截断，在同位置键盘重试并续页 | [原错误和 Retry 焦点](verified-harbor-failure.jpg)、[成功接纳新标题且页脚仍持焦](verified-harbor-retry-success.jpg)、[续页完成后焦点回到查询](verified-harbor-retry-followed-by-page.jpg) |

[旧词不再匹配](verified-rename.json)及[新词成为匹配](verified-rename-into-query.json)保留实际更名请求 ID、所属项目和服务器的统一通知。[三次更名](verified-harbor-burst.json)、[失败时的更名](verified-harbor-fail.json)与[真实搜索传输](verified-search-transport.jsonl)记录读取、扣留、释放、截断以及重试和续页游标。[原会话导航及数据库事实](verified-isolation.json)列出实际打开的浏览器地址、会话保存身份和模型活动计数。
