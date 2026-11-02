# 收件箱筛选选择验收（905）

本轮使用开发CLI（Command Line Interface，命令行接口）38642/38643/38644的/ui与本人隐藏页面213/214/215，未操作用户18571窗口。21张图均为实际交互截图并已人工查看，没有UI（User Interface，用户界面）自动化测试。

| 截图 | 实际观察 |
| --- | --- |
| [01 原筛选](01-before-filtered-inbox.jpg) | 原两条通知的筛选状态，页头只剩搜索。 |
| [02 原单选](02-before-selected-action-missing.jpg) | 第一条已勾选，但页头没有选择数量或批量入口。 |
| [03 原双选](03-before-two-selected.jpg) | 两条均已勾选，仍没有批量入口。 |
| [04 原搜索关闭](04-before-close-clears-selection.jpg) | Escape退出搜索后，选择也随查询重置，无法拿回原筛选选择。 |
| [05 独立操作栏](05-after-search-with-toolbar.jpg) | 搜索框与同一套选择控件同时可见。 |
| [06 单选数量](06-after-single-selected.jpg) | 原一条消息对应1 selected，批量入口可用。 |
| [07 键盘全选](07-after-keyboard-select-visible.jpg) | Tab进入复选框、空格全选原两条，显示2 selected。 |
| [08 原确认](08-after-two-message-confirmation.jpg) | Enter打开两条消息的应用内普通确认窗，初始焦点是Cancel。 |
| [09 按钮取消](09-after-cancel-retains-selection.jpg) | 取消后原查询/两条勾选保留，焦点回到批量入口。 |
| [10 Escape取消](10-after-escape-retains-query.jpg) | Escape只关闭确认，原搜索/两条勾选仍保持。 |
| [11 清除选择](11-after-clear-visible-selection.jpg) | 键盘清除当前两条选择，保留原查询并恢复全局未读摘要。 |
| [12 查询替换](12-after-query-change-clears-selection.jpg) | 从两条已选切到另一项目七条结果，旧选择重置。 |
| [13 空结果](13-after-empty-search.jpg) | 空匹配保留搜索和清除入口；实际点击清除后列表与搜索焦点恢复。 |
| [14 中文选择](14-after-cn-filtered-selection.jpg) | 经真实设置切中文后，原查询和两条选择仍在，数量与控件本地化正确。 |
| [15 中文确认](15-after-cn-confirmation.jpg) | 原两条消息对应中文确认，取消为初始焦点。 |
| [16 中文取消](16-after-cn-cancel-retained.jpg) | 取消后原搜索/选择保留，焦点回到原批量入口。 |
| [17 中文默认](17-after-cn-default-inbox.jpg) | 退出搜索恢复原默认页头和24条未读。 |
| [18 最终单选](18-final-one-selection-label.jpg) | 最终语言产物中一条选择的无障碍按钮名为Delete selection (1)。 |
| [19 最终单条确认](19-final-one-message-confirmation.jpg) | 原单条消息使用原主题确认，取消后仍保留该选择。 |
| [20 最终双选](20-final-two-selection-label.jpg) | 最终产物中两条选择的无障碍按钮名为Delete selection (2)。 |
| [21 最终取消](21-final-cancel-preserves-selection.jpg) | 原两条确认后Escape退出，保留搜索/两条勾选并返回批量入口焦点。 |

05–17验证最终页头结构及中英文交互；18–21在增加英文数量措辞修正后的最终构建重核一条/两条和确认取消。中文字段及页头代码在此修正中保持。全局已读按钮当前明确命名为“将整个收件箱标为已读”/“Mark all inbox messages as read”，实际范围仍是整个收件箱；未执行它。无障碍名称及焦点观察仅为补证，视觉验收来自以上实际截图。

[验证摘要](verification.json)记录三轮原生进程正常退出、三对认证及完整模型目录副本退休、原259688行及源数据库、100项目文件/Git（版本管理）/229附件保持。0模型请求，累计1260。原24条完整通知响应、15Mission（多步任务）和四份完整TaskStatus（任务状态）在各轮初末一致，目录查询返回原2/7条。类型、语言、样式标记、文档和最终Node.js构建检查通过。

边界：桌面当前系统深色主题、中英文、当前真实两条/七条结果及空匹配；未确认删除、全部已读或消息展开，不宣称验证了删除成功或已读写入。未覆盖分页超过一页的批量选择、服务失败/断线/竞态、其它主题/缩放/设备或模型执行。取消保护由原数据精确保持补证，不能以此替代未执行的删除分支。
