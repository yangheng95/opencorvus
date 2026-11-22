# 多步任务草稿编辑反馈的桌面验收

2026-11-22，隔离服务和桌面浏览器的实际截图。

| 基线 | 人工观察 |
| --- | --- |
| [列表查询](baseline-list-search.jpg) | `silver lanterns` 从真实请求正文匹配北区。 |
| [切换看板](baseline-board-filtered.jpg) | 查询及北区项目仍参与筛选。 |
| [北区草稿详情](baseline-north-draft.jpg) | 真实详情保留北区的原请求。 |
| [返回看板](baseline-board-return.jpg) | 返回到同一布局和原筛选。 |
| [冲突筛选](baseline-empty-south.jpg) | 查询和南区项目组合后空结果。 |
| [键盘重置](baseline-reset-keyboard.jpg) | 可聚焦重置按钮。 |
| [重置结果](baseline-reset-result.jpg) | 搜索恢复焦点，两个草稿均可见。 |
| [编辑请求](baseline-edit-form.jpg) | 同一北区草稿的新正文改为 `amber lamps`。 |
| [保存后仅有空结果](baseline-edit-empty.jpg) | 原查询保留，已编辑草稿退出筛选，页面只显示无匹配。 |
| [保存后的 Tab](baseline-edit-tab-jump.jpg) | 焦点落到重置筛选。 |
| [重新查询新正文](baseline-edited-found-by-query.jpg) | `amber lamps` 可在原草稿上匹配。 |

实际 [初始创建及列表](baseline-missions.json) 和 [编辑后列表](baseline-missions-after.json) 记录了两个草稿、未改的身份及更新后的请求。

| 候选 | 人工观察 |
| --- | --- |
| [英文取消](candidate-en-cancel.jpg) | 看板保留草稿、查询和项目，焦点回到该编辑按钮。 |
| [英文保存与空筛选](candidate-en-save-empty.jpg) | 保存提示和无匹配结果同时可见。 |
| [英文直接打开](candidate-en-open-exact.jpg) | 确切北区草稿显示 `amber lamps` 新正文。 |
| [英文返回](candidate-en-return.jpg) | 原看板、两个筛选和成功提示保留。 |
| [英文关闭回执](candidate-en-dismiss.jpg) | 当前筛选仍然保持。 |
| [中文保存并匹配](candidate-zh-save-matching.jpg) | 回执与仍匹配的南区卡片一起可见，正文更新为 `ceramic trays`。 |
| [中文直接打开](candidate-zh-open-exact.jpg) | 打开确切南区草稿，新正文完整可见。 |
| [中文新建回执](candidate-zh-create-receipt.jpg) | 新建草稿仍使用原回执，`ceramic` 筛选保持。 |
| [中文打开新草稿](candidate-zh-create-open.jpg) | 回执打开新建的「南区货架标签复核」及其中文原请求。 |

[候选运行回执](candidate-runtime-proof.json) 包含实际候选服务与构建入口、编辑前后保存身份和请求，以及两套隔离数据库的只读计数。
