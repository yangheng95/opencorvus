# 筛选恢复的键盘焦点验收

本轮使用隔离原生开发页面38665/38666进行真实交互、截图和人工复核。调查与实施边界见[规格](../../records/2026-11/2026-11-03-filter-recovery-focus.md)，原生运行、数据与认证验证结果见[验收记录](qualification.json)。没有运行或新增UI（User Interface，用户界面）自动化测试。

修复前，Enter（回车）清除筛选使按钮卸载，文件恢复但焦点落到BODY（页面背景）；随后Down（下方向键）无法继续导航。修复后，焦点交回原列表中的文件行，Down移动焦点、Enter确认文件并更新预览。截图03仅展示焦点移动，截图04才展示确认选择后的summary.md；两者没有混记为同一步。

| 截图 | 人工复核结果 |
| --- | --- |
| [01](01-before-clear-focus.jpg) | 修改前：清除恢复三文件，但键盘焦点已丢失。 |
| [02](02-after-clear-focus-en.jpg) | 修改后英文：清除后首文件行出现焦点环。 |
| [03](03-after-arrow-selection-en.jpg) | 不点击鼠标，Down把焦点移动到summary.md。 |
| [04](04-after-confirm-summary-en.jpg) | Enter选择summary.md，预览身份同步切换。 |
| [05](05-after-search-return-en.jpg) | 列表按斜杠进入搜索；第一次Escape清查询，第二次返回原列表。 |
| [06](06-combined-empty-en.jpg) | 搜索issue-register并隐藏非文本产生真实无匹配结果，提供清除入口；鼠标清除恢复三条、空查询及未勾选状态，焦点交回summary.md。 |
| [07](07-after-clear-focus-zh.jpg) | 中文键盘清除恢复列表焦点；随后Down、Enter与Ctrl+F（控制键加F）进入文件搜索均完成。 |
| [08](08-other-project-zh.jpg) | **中间态**：跨项目正在加载，不作为完成截图。 |
| [09](09-other-project-settled-zh.jpg) | 另一项目加载完成，显示其原对话与输入框。 |
| [10](10-exact-path-focus-zh.jpg) | 返回原项目并精确打开历史Excel路径，筛选恢复三条，入口按钮保留焦点。 |
| [11](11-exact-reset-zh.jpg) | 同一审阅先筛选为零项，再点击summary.md路径：恢复原列表并显示精确文件，纯重置保留触发入口焦点。 |

两原生实例已通过公开关闭接口200、原句柄退出0并完成物理进程、输出及请求结清；四份配对认证/完整模型目录副本已退休。结构版本10、92表；271260→271262→271264仅新增各自运行的激活租约事实，所有原始业务行、源库、101项目文件/Git（版本管理）与263附件保持。四检查点的15个Mission（多步任务）、4个Task（任务）状态及根会话、24个Mailbox（收件箱）记录保持；12次正式文件读取分别确认缺失路径404/FileNotFoundError、实际Excel 200/binary（5895字节）及完整摘要200/text。没有模型推理请求，累计1309保持。

用户要求自行刷新登录后，已实际调用OpenCorvus正式账号用量接口：HTTP（Hypertext Transfer Protocol，超文本传输协议）200、ok=true、rate_limits；当前OpenAI登录仍有效至2026-11-11T16:15:41Z，无需重复登录。本轮没有强制刷新有效凭据，也没有把账号读取冒充模型推理。原认证和完整模型目录保持。没有操作用户现用18571窗口、进程或真实数据库。
