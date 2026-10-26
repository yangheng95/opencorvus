# Mission 草稿完整体验

[Recall、根因与实施](../../records/2026-10/2026-10-27-mission-authoring-journey.md) · [规范运行事实](evidence.json)

17张原图来自652/38157、653/38158和654/38159三个独立开发CLI（Command Line Interface，命令行界面）的真实/ui桌面操作，1280×720，逐张人工查看。未新增或运行UI（User Interface，用户界面）自动化测试、截图基线或像素断言。

| 原图 | 实际观察 |
| --- | --- |
| [01-mission-board-empty.jpg](01-mission-board-empty.jpg) | 652原看板为空 |
| [02-manual-draft-form-en.jpg](02-manual-draft-form-en.jpg) | 手动名称和需求输入 |
| [03-manual-type-mode-preserved.jpg](03-manual-type-mode-preserved.jpg) | 类型/创建模式切换后输入保留 |
| [04-manual-draft-provider-error.jpg](04-manual-draft-provider-error.jpg) | 创建失败后反馈落在视野外，不能当作可见提示 |
| [05-manual-draft-error-visible.jpg](05-manual-draft-error-visible.jpg) | 人工滚动后才看见错误的模型预检400原文 |
| [06-created-draft-board-en.jpg](06-created-draft-board-en.jpg) | 653修复后同样缺执行模型仍保存成功 |
| [07-saved-draft-context-en.jpg](07-saved-draft-context-en.jpg) | 原Mission上下文和完整已保存需求 |
| [08-edited-draft-board-en.jpg](08-edited-draft-board-en.jpg) | 编辑后原身份和新需求 |
| [09-renamed-pinned-draft-context-en.jpg](09-renamed-pinned-draft-context-en.jpg) | 中间发现：页头已改名，正文仍旧标题 |
| [10-real-offline-create-feedback-en.jpg](10-real-offline-create-feedback-en.jpg) | 真实断连后英语简短反馈自动进入视野 |
| [11-real-offline-create-details-en.jpg](11-real-offline-create-details-en.jpg) | 展开首帧；该图未呈现技术正文，不作为正文可见证明 |
| [12-reopened-draft-board-en.jpg](12-reopened-draft-board-en.jpg) | 654新CLI启动后原草稿仍在待规划栏 |
| [13-renamed-context-synchronized-en.jpg](13-renamed-context-synchronized-en.jpg) | 最终代码：改名后页头、侧栏与正文同步 |
| [14-reopened-context-zh.jpg](14-reopened-context-zh.jpg) | 中文上下文与完整原需求 |
| [15-real-offline-create-feedback-zh.jpg](15-real-offline-create-feedback-zh.jpg) | 真实断连后中文反馈可见并获得焦点 |
| [16-real-offline-create-details-zh.jpg](16-real-offline-create-details-zh.jpg) | 展开且滚动后原TypeError及调用信息实际可见 |
| [17-real-offline-preserved-input-zh.jpg](17-real-offline-preserved-input-zh.jpg) | 同次失败的名称、需求完整保留 |

实际缺陷为手动草稿元数据写入误入执行模型初始化、工作项固定缺失精确项目归属、失败主文案直接暴露原诊断且视野外，以及草稿正文标题错误读取最初水合快照。最终使用原单一路由上下文策略、原精确项目会话查询、当前Feedback（反馈）组件和页头同一Work Ledger（工作目录）元数据投影；未新增写入事实源、SDK（Software Development Kit，软件开发工具包）接口或数据库结构。

653完成手动创建→打开→保存编辑→取消另一编辑→改名→固定→返回原看板。654从完全关闭的653只读备份后启动，原Mission/Session（使命/会话）身份、已编辑需求、待启动状态与空消息保持，实际再次改名后页头和正文同步。两个实例准备另外的完整表单后先公共关闭自有服务、结清原执行会话和进程，再真实点击创建触发连接失败；没有网络注入或假响应。

三个源库分别92表608、608、700行，原源全部行逐项保持；原关键消息/执行/自动化事实保持，654仅允许实际手动改名对应的原Mission标题与更新时间变化。schema（数据库结构）8保持。本批不复制认证、模型请求0、累计真实模型222。各实例公共关闭200、原执行会话/宿主/启动器0，物理完成、输出排空和请求清理均结清；精确余量见运行事实。

本批没有启动Mission或AI（Artificial Intelligence，人工智能）创建，没有覆盖运行中执行、并发调度和重试恢复；Task元数据仅有后端公共接口验收，不冒充Task页面实测。无认证实例的模型不可用提示属本批刻意配置，不代表用户已认证环境失败。内置专家团原描述的中文显示仍是后续体验检查点，不因本批双语反馈通过就宣称全产品本地化完成。
