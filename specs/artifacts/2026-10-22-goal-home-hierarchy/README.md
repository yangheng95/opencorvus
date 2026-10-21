# Goal 首页信息层级

调查、根因与边界见 [方案及结果](../../records/2026-10/2026-10-22-goal-home-hierarchy.md)。单开发 agent，真实 Source CLI（Command Line Interface，命令行接口）开发页面 /ui，模型预算和实际请求均为0，没有凭据或模型目录副本。

新首页顺序为标题、真实输入框、普通聊天示例、独立持续目标区域；直接展示完成标准、自动续跑、顶部进度/暂停、选用模型与空预算规则。保留原有创建表单和“如何使用”。

| 图片 | 人工复核内容 |
| --- | --- |
| [01](01-before-home-en.png) | 旧首页：Goal 插在输入与普通示例之间，无区域边界，较多顶部留白 |
| [02](02-before-form-en.png) | 旧真实表单，可正常从输入草稿预填 |
| [03](03-after-home-en.png) | 新英文首页，独立目标区域及模型/预算提示 |
| [04](04-after-home-zh.png) | 新中文首页，保留实际出现的设置悬浮提示 |
| [05](05-after-form-zh.png) | 中文真实表单，原草稿、可选预算及确认语义 |
| [06](06-after-guide-zh.png) | 中文实际使用步骤与暂停/停止区别 |
| [07](07-after-narrow-zh.png) | 实际左分栏280→493后的较窄桌面工作区 |
| [08](08-after-starter-zh.png) | 原“改 Bug”示例填入真实输入 |
| [09](09-after-final-home-zh.png) | 最终中文版首页，恢复左分栏280，清除自有草稿 |

09 为交付主图。九张图片全部实际查看；不是截图测试或连续帧验收。关闭表单后原草稿保留，经真实页面观察；没有提交新目标或调用模型。

[观察与命令结果](observations.json)、[原始数据保留检查](data-preservation-observation.json)、[before 物理结算](before-physical-terminal.json)与[after 物理结算](after-physical-terminal.json)记录实际结果：两 scope90表156566原行、schema3、完整 canonical 和来源 bytes/mtime 保持；公开 shutdown200、原42877/99731 exit0，native/输出/request/launcher/精确出生链完整结算，IAB100/101关闭。正式 Node 构建及类型、本地化、样式 token、文档和架构检查通过；构建既有依赖和大 chunk 提示仍在。

归档包含本轮自有诊断帮助脚本；其共享宿主仍位于仓库 .tmp-product-iteration/live-sol-task-guidance-413.ts，执行还依赖记录中的隔离数据、Bun 和原生 supervisor 路径，不能把此目录当独立安装包。完整数据库、原行私有快照、原始运行日志和凭据不归档。真实秘密值只在本地等值扫描时读取，结果在 [扫描记录](credential-scan.json)。

未覆盖新的 Goal 模型执行、右 dock、移动端、所有 Sources 状态、连续帧 Rendering 和认证事件流；不以本轮首页展示改动宣称这些通过。用户18571进程、页面和真实数据库未操作，无schema或版本变更。
