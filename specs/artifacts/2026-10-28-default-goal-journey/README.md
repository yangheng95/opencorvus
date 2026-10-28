# 默认页与持续目标真实体验

[方案与Recall](../../records/2026-10/2026-10-28-default-goal-journey.md)。764批次为持续产品迭代的一部分，非整体Goal完成声明。用户授权单代理、内置浏览器调试与提交推送。

首页原副标题不暴露现有持续目标能力；本轮复用唯一副标题，加入当前本地化标签的+菜单及/goal提示。没有新增创建面、按钮、CSS、调度或持久数据实现。代码类型、普通构建、双语及最终文档结果见[checks.json](checks.json)，真实隔离实例与完整数据比较见[runtime-and-data.json](runtime-and-data.json)。这些检查不代替视觉复核。

15张原始JPEG逐张人工查看，未编辑或重采样。01—10为原版本，11—15为main-C-ao02O_.js改后真实页面。没有新增、更新或运行UI（User Interface，用户界面）自动化测试。

| 原图 | 实际观察与界限 |
| --- | --- |
| [01](01-current-default-home.jpg) | 原首页泛用副标题，没有Goal入口提示。 |
| [02](02-current-goal-menu.jpg) | 现有+菜单Continuous goal入口。 |
| [03](03-current-goal-draft-form.jpg) | 输入明确未提交目标，唯一创建表单。 |
| [04](04-goal-draft-budget.jpg) | 展开预算，自动轮次填1，未确认执行。 |
| [05](05-goal-guide.jpg) | 原About goals指南。 |
| [06](06-guide-returned-draft.jpg) | 从指南返回，原目标、额度1和预算展开态保留。 |
| [07](07-goal-command-opens-form.jpg) | 输入/goal带目标，Enter打开同一表单；原composer提取命令前缀，不执行。Esc返回原草稿。 |
| [08](08-default-composer-right-edge.jpg) | 右边裁切诊断，截图1119而DOM为1280；不能当作CSS溢出证据。 |
| [09](09-browser-viewport-capture.jpg) | 直接浏览器截图仍1119，原返回JPEG，后缀修正。 |
| [10](10-default-viewport-reset.jpg) | reset后DOM1280、截图1119；预定shutdown后状态，仅捕获诊断，不作为在线操作通过证据。 |
| [11](11-after-english-home-hint.jpg) | 调试视口1119×720与捕获一致：英文提示、原布局、完整输入区及Send。 |
| [12](12-after-chinese-home-hint.jpg) | 真实Settings切中文后：首页当前语言提示，完整输入区和Send。左侧设置tooltip为自然鼠标状态。 |
| [13](13-after-chinese-goal-form.jpg) | 根据提示从+菜单进入实际中文目标表单，未确认执行。 |
| [14](14-existing-completed-goal-details.jpg) | 同一原Work完成目标详情：完整目标、完成证据、148,493令牌、3自动轮次及预算入口。 |
| [15](15-existing-goal-budget-readonly.jpg) | 完成目标预算展开，只读；下半部字段需滚动，其数值未读取/修改。截图仍在线。 |

默认DOM1280与原始1119截图差异根因未知。本轮为回答真实布局问题临时对齐1119，结束已reset，未据裁切修CSS，也没有完整1280像素视觉结论。两个自有页均关闭，用户18571未操作。最后观察的服务离线源于提前设置的正常shutdown，而非UI异常。

既有完成Goal的指南返回、新建后取消、创建确认及新Provider执行未在本轮完成；750真实三轮为既有数据。基线草稿/指南/命令通过不能替代这些未验项目。无凭据副本，模型请求0，累计759；自有模型目录副本在物理退休后清退，源库和旧行、原输入、源目录及auth元数据保持。原两个exec均0，公开shutdown200、三项结算、精确出生身份及同一固定截止余量有机器证据。
