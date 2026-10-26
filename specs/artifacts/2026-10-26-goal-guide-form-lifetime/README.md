# Goal 表单与执行控制验收

本批依据当前真实页面发现并修复三个问题：说明导航丢失未提交字段；Provider 模型不可用导致暂停、预算和完成写入失败；Project 初始化模型错误反复记录却不收敛为目标阻塞。

[方案与根因](../../records/2026-10/2026-10-26-goal-guide-form-lifetime.md) · [脱敏数据证据](evidence.json)

## 真实页面

| 图片 | 人工复核内容 |
| --- | --- |
| [01](01-create-baseline.jpg)、[02](02-budget-reached.jpg) | 修改前真实 Sol 单轮执行与预算限制 |
| [03](03-unsaved-budget-baseline.jpg)–[07](07-evidence-reset-baseline.jpg) | 原预算、说明无返回、重开预算/完成依据丢失 |
| [08](08-guide-return-english.jpg)–[11](11-evidence-retained-english.jpg) | 英文返回入口，创建/预算/完成依据保持及焦点恢复 |
| [12](12-completion-provider-error.jpg) | 中途真实提交失败，未将视觉通过冒充功能完成 |
| [13](13-guide-return-chinese.jpg)、[14](14-evidence-retained-chinese.jpg) | 中文返回与完成依据保持 |
| [15](15-completed-without-provider.jpg) | 模型不可用时原 Goal 仍可完成、保留实际用量 |
| [16](16-model-admission-active-baseline.jpg) | 原初始化失败仍 active 的实际基线 |
| [17](17-model-blocked-english.jpg)–[20](20-completed-chinese.jpg) | 真实阻塞原因、65000/3预算保存、明确重试和中文完成 |
| [21](21-normal-provider-budget-reached.jpg) | 最终源码真实 Sol 回复，36950 tokens、1/1后按预算停止 |
| [22](22-normal-provider-evidence-retained.jpg)、[23](23-normal-provider-completed.jpg) | 说明返回保留原完成依据，实际提交后完成投影 |

## 验收边界

25项后端正向测试、120断言通过；backend 类型检查、普通 Node 构建和两语言2547键检查通过。UI 未创建或运行自动化测试；23张原始 JPEG 均在真实页面操作后逐张人工查看。截图工具捕获宽1119px，实际文档宽1280px；本批目标 Dialog 完整位于360–920px，背景右侧裁切不作为页面溢出缺陷。

615与619真实模型请求分别4和3次，全部 gpt-6.1-sol、流式、HTTP200、EOF结清；累计160→167。616–618新增模型请求为0。五次独立服务均公开关闭200，原进程、输出与请求清理结清，native/launcher退出0；619提前785633ms关闭。配对凭据/完整模型目录副本已退休，源目录及源认证元数据保持。

数据库均从已关闭的前一独立运行只读复制；92表完整源数据逐行保持。619复核249条原业务事实，只有实际执行的同一 Session 的活动时间按真实输入/回复更新，其他原字段与消息、工具、Provider及Goal协议历史保持。未操作用户服务或数据库。Task/Mission的共享入口由真实 Scheduler/领域合同覆盖，本批真实 Provider 网页执行限定 Chat/Work，不扩大端到端声明。
