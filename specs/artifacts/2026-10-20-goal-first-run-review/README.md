# Goal 首次使用与模型恢复证据

本轮只使用一个开发 agent。新建自有477数据根，未打开用户18571或已有147 Project/196 Session历史库。源码CLI（Command Line Interface，命令行界面）开发服务通过18809/18811的/ui验收，未使用单独Vite或任何UI（User Interface，用户界面）自动化测试。

## 人工截图

| 文件 | 实际观察 |
| --- | --- |
| [01](01-before-fresh-home.png) | 全新环境的首页、继承模型与紧凑Goal入口 |
| [02](02-before-guide.png) | 修复前指南缺少模型配置准备、确认前假定当前会话 |
| [03](03-before-create.png) | 有限1轮表单与确认前错误时态；实际取消后ledger仍无会话 |
| [04](04-before-no-model-result.png) | 真实创建后Active/Not running，0轮且无页面错误 |
| [05](05-after-en-blocked.png) | 原Goal显式Resume后，真实缺少模型产生Blocked与操作说明 |
| [06](06-final-zh-blocked.png) | 最终中文提示使用实际“恢复”按钮名称；模型已明确配置，旧阻塞等待显式恢复 |
| [07](07-final-recovered-complete.png) | 同一Goal经真实gpt-6.1-sol流式回复完成，1轮/33,611令牌 |
| [08](08-final-zh-home.png) | 最终中文首页；鼠标仍在新对话按钮，截图保留其真实提示浮层 |
| [09](09-final-zh-guide.png) | 中文模型准备、确认边界和阻塞恢复步骤，正文与关闭按钮完整 |
| [10](10-final-zh-form.png) | 中文创建后不可变目标说明、预算可选及操作区 |
| [11](11-final-en-guide.png) | 英文长指南在1280×720实际页面内完整呈现 |
| [12](12-final-en-form.png) | 英文创建前表单及固定操作区 |
| [13](13-final-en-home.png) | 取消英文表单后原首页，无额外会话创建 |

每张均实际呈现并人工查看；图08浮层没有被抹除或包装为渲染异常。首次中文实页发现新提示误写“继续”，随后修正为现有“恢复”，重建正式bundle再截06及09/10。最终UI与源CLI在独立native occurrence启动，原失败Goal身份和数据库保留。

## 功能和资格

[goal-recovery.json](goal-recovery.json)包含原Goal、真实完整Message、原12条Session协议事实及用量关联；首次失败时没有已接受Message。恢复使用明确配置的默认模型，不以空composer值阻断合法继承。最终仍是pev_g0VYbMZ8t00C0MskiYW0 / ses_-zUROdQv5zz44ZJn5zu0，模型自行调用update_continuous_goal后真实回复FIRST_RUN_477。1条目标用量关联累计33,611，独立Provider预检用量保持在自己的Session。

修复前重复错误的[原工具观察与日志保全限制](model-failure-observation.md)明确区分已观察事实与未保全原日志；没有用重启后的空计数冒充历史结果。

[provider-summary.json](provider-summary.json)：完整凭据+模型目录成对资格、精确gpt-6.1-sol、全流式、整批4/6次实际请求（预检2、Goal2，含所有已观测helper），全部HTTP（Hypertext Transfer Protocol，超文本传输协议）200且原source reader EOF（End Of File，流结束）。没有活跃扩额、refresh/exchange或源凭据写入。首次无凭据阶段不冒充Provider资格；公共providers响应诊断脚本误读connected字段为null，未将null当作未连接证据。

[focused-tests.log](focused-tests.log)：正式test运行器的5个非UI功能文件35例/214断言通过，涵盖三种owner、累计用量、同请求重放、并发版本、正常/终态、归档/恢复、Project隔离与真实控制流式进程重启。最终收紧为仅agent-bound配置错误后的[5例27断言](final-model-block-tests.log)再次通过。首次局部测试误以为相同确定requestID的并发错误会409；原store正确重放同一blocked修订，测试改为验证真实重放及单一持久作者，另以用户Pause竞争验证明确revision_conflict。

[final-build.log](final-build.log)为最终正式前端构建（50.39秒）和renderer surface checker；[backend-typecheck.log](backend-typecheck.log)、[ui-typecheck.log](ui-typecheck.log)及最终检查记录只证明类型/构建合同，视觉结论来自上述实图。

本轮新根最终2 Project/2 Session/schema3，其中一个是独立凭据预检；创建表单取消未创建多余Session。没有schema变动或用户库迁移。实际恢复是在隔离canonical配置中明确设置model/small_model后重新启动自有服务，再通过页面点击恢复；没有声称本轮测试了服务商登录或模型选择器的完整设置流程。

原native、launcher、公开shutdown、运行对退休和源不变证据见settlement.json及credential-retirement.json。长期任务仍继续；原完整配置保存10秒/恢复5秒门槛仍未满足，本轮首次使用小根不能替代它。实际Sol恢复只覆盖Work Chat；Task/Mission的配置阻塞有非UI真实resolver合同，未将其宣称为三种owner的Sol端到端验收。
