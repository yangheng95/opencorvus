# 全局查找跟进保存标题的页面证据

候选码修改前用实际隔离开发服务打开主项目的空白会话，查找另一个项目的已保存标题。所有名称都是本次合成测试数据，原项目没有被编辑。本人复核实际桌面视口。

| 实际步骤 | 观察 |
| --- | --- |
| [原查询读取已保存会话](baseline-search-before-rename.jpg) | 本项目原输入持焦，唯一命中来自 `control-review`。 |
| [同一会话正式更名后](baseline-search-stale-after-rename.jpg) | 侧栏已显示 Amber，保持打开的全局查找仍显示 Cedar。 |
| [改成新查询](baseline-search-manual-new-query.jpg) | 显示原项目当前标题 Amber 及完整目录提示。 |

[真实更名回执](baseline-rename.json)记录正式搜索前后结果、准确会话 ID、200 回执、统一工作记录流中同一 ID 的 `titleChanged` 通知。基线最后发起 Enter 导航后关闭本次页，只记录查询结果。
