# 成员侧栏恢复时的正文身份

576，单agent。修复main用workspace请求epoch清空成员选择的问题。记录见[调查与方案](../../records/2026-10/2026-10-24-member-reconnect-rendering.md)，结构化事实见[evidence.json](evidence.json)。

旧实现真实服务恢复后自动退回成员列表，原正文阅读视图退休。最终构建保持同一B成员、20正文实例、8来源实例和top24721。来源卡片的标题、域名和复制入口均可见；这里的单项Sources直接显示，未新增折叠策略。

| 图片 | 实际状态 |
| --- | --- |
| [01](01-before-bottom.png) | 旧实现B详情与原最终正文 |
| [02](02-before-sources.png) | 旧实现正常连接，Disclosure/Accordion来源 |
| [03](03-offline-sources.png) | 旧实现真实断线，原正文仍在 |
| [04](04-recovered-sources.png) | **失败证据**：恢复后自动退回All agents |
| [05](05-fixed-before-sources.png) | 最终修复新页，服务替换之前 |
| [06](06-fixed-offline-sources.png) | 最终修复真实离线 |
| [07](07-fixed-recovered-sources.png) | **最终验收**：自动恢复后原成员和阅读位置保持 |
| [08](08-fixed-member-a.png) | 真实切换A成员 |
| [09](09-fixed-member-b-return.png) | 返回B的来源区域，允许观察到的小幅垂直差异 |
| [10](10-fixed-new-chat.png) | 离开原来源，新对话清空成员选择 |
| [11](11-fixed-other-project.png) | 跨项目读取575已完成Goal，旧成员选择为空 |

四个自有原生服务全部正常结算，零模型请求，未复制auth；图中Model configuration unavailable来自本批故意不提供凭据的历史阅读隔离环境，不能推断用户已认证OpenAI失效。原用户18571服务、页面与数据库未参与。隔离首库真实5→6使用的是另一工作区任务的未提交迁移，其代码不在本批交付内。90表203799原行在四份隔离库均保持。

这些是实际页面截图及人工身份观察，未使用UI自动化测试。未逐帧录像，也未把本次恢复修复包装成所有流式Rendering闪烁均已解决；原高频流式触发路径仍待实证。
