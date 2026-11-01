# 持续目标入口与会话切换：真实验收

单agent在正式开发服务`/ui`的自有后台页验收，未操作用户窗口。全部23张原图均真实呈现并逐张人工查看，没有图像编辑或UI（User Interface，用户界面）自动化测试。

| 原图 | 构建与实际观察 |
| --- | --- |
| [01](01-before-existing-work.jpg) | 基线：已有空闲Work缺少直接可见Goal入口。 |
| [02](02-before-menu-goal-form.jpg) | 基线：“+”菜单正常打开原当前会话表单，确认是发现性缺口。 |
| [03](03-after-existing-work-header.jpg) | 首候选：英文头部文字入口可见。 |
| [04](04-after-english-guide.jpg) | 首候选：英文指南说明已有对话标题栏入口。 |
| [05](05-after-guide-return-draft.jpg)、[06](06-after-header-reopen-draft.jpg) | 首候选：指南返回/关闭重开保留原草稿及120000/2预算。 |
| [07](07-after-dock-header-layout.jpg)、[08](08-after-chinese-header.jpg) | 首候选：侧栏展开后的中英文头部布局。 |
| [09](09-after-chinese-guide.jpg)、[10](10-after-chinese-current-owner.jpg) | 首候选：中文指南及当前Work归属。 |
| [11](11-first-candidate-owner-loading-bug.jpg) | **首候选失败**：即时切换后，背景已有暂停Goal，前景却是创建表单；该构建未作为通过版本交付。 |
| [12](12-final-work-header.jpg) | 最终构建：原Work头部入口。 |
| [13](13-final-immediate-switch-details.jpg) | 最终：相同即时选择+点击流程打开原暂停Goal详情，36322令牌/1轮。 |
| [14](14-final-reverse-switch-create.jpg) | 最终：反向切回无Goal Work后打开该会话创建表单。 |
| [15](15-final-draft-budget-reopen.jpg)、[16](16-final-chinese-draft-budget.jpg) | 最终：指南/关闭重开及语言切换保留GOAL856_FINAL_KEEP和120000/2预算。 |
| [17](17-final-chinese-guide.jpg) | 最终：中文指南完整显示标题栏、首页与原快捷入口。 |
| [18](18-final-chinese-immediate-details.jpg) | 最终：中文重复即时切换，仍打开原暂停Goal详情。 |
| [19](19-final-home-entry.jpg)、[20](20-final-home-goal-form.jpg) | 最终：首页仍是原介绍按钮和原新会话表单。 |
| [21](21-final-archived-chat-header.jpg)、[22](22-final-archived-readonly-guide.jpg) | 最终：原归档Chat只读页面，头部入口按原合同打开指南。 |
| [23](23-final-chinese-dock-layout.jpg) | 最终：中文Work与展开侧栏，头部文字入口完整可见。 |

最终实现只有现有App打开请求和现有owner-bound（归属于当前工作）表单；共享读取判断等待当前作用域的投影，再决定详情或创建，不引入延迟、第二次查询或平行Goal状态。同一owner的已有当前投影在后台刷新时继续可用。

三轮原schema（数据库结构）9/92表、业务行所有列、140附件、62项目旧文件/Git（版本管理）身份和源库均保全；九个原公开Goal完整事实一致。未创建目标、发送消息或恢复/完成原目标。模型请求新增0/累计1180，三轮六份auth/models配对副本已退休。详见[验证数据](verification.json)和[完整方案/根因/记录](../../records/2026-11/2026-11-01-goal-header-entry.md)。

类型、2676键/两语言、普通构建/renderer公共面及当前文档检查通过。没有UI自动化，构建不替代视觉验收。Task、Mission和SideChat消费同一共享控件，但本批没有逐个进行视觉重放；不扩大为这些分支、读取失败、目标执行或任意网络延迟都已实测。

文件字节保全范围为各项目快照内的原业务文件；原.opencorvus运行元数据目录不在该逐文件快照内，.git通过HEAD/ref/index/status核对。项目排除数量为0不表示这两个元数据目录已作逐字节覆盖。
