# 导航状态的真实证据

对应[调查与方案](../../records/2026-11/2026-11-06-status-evidence-navigation.md)。本人隐藏原生开发页面验证同一Task801的消息记录、真实执行状态及定位；原图按实际结果补记，不运行UI自动化。

| 原图 | 人工复核内容 |
| --- | --- |
| [01](01-before-pending-zh.png) | 修复前：Task已完成，无执行证据的8MGR却显示等待中、执行及开始时间。 |
| [02](02-before-input-location-zh.png)、[03](03-before-original-input-zh.png) | 修复前实际Enter定位、展开同一Mission原始输入。 |
| [04](04-after-record-en.png) | 修复后英文中性状态、记录身份和时间。 |
| [05](05-after-record-zh.png) | 中文首次复核发现说明末尾单字换行，随后缩短提示；本图不作为最终视觉通过证据。 |
| [06](06-after-original-input-zh.png) | 修复后Enter定位及展开原输入，内容与03一致。 |
| [07](07-after-known-idle-zh.png) | 相邻有真实lifecycle的idle执行仍显示空闲、执行与开始时间。 |
| [08](08-final-record-en.png)、[09](09-final-record-zh.png) | 最终双语短提示正常换行，准确显示状态未记录。 |
| [10](10-final-member-transcript-zh.png) | 真实已完成worker的成员侧栏和完整会话；同时发现“全部 Agent”旧中文控件，另开新冻结资源实页补验。 |
| [11](11-final-members-label-zh.png)、[12](12-final-members-list-zh.png) | 最终新原生服务实际显示“全部成员（1）”，点击后返回唯一真实成员列表；成员名base-tester保持。 |

六个真实HTTP样本包含32条导航记录：三处无执行证据的pending变为unobserved，29处明确状态及原文、身份、顺序、活动逐字段保持。两条真实Session连接事件的11条记录与HTTP精确一致。未改旧Message或接纳批次，也未按父任务终态推断执行完成。

原库没有自然排队标记，真实排队视觉验收未覆盖；其正向后端合同已验证。没有自然的neutral child聚合样本，不能宣称该分支视觉通过。实时新事件乱序、完整编排、崩溃恢复、重试本轮未重新触发，冷页读取和重新连接不能代替这些验收。

[资格记录](qualification.json)汇总四次原生服务读取，全部正常关闭并清退成对副本；schema10/92表，129个项目及Git事实、299份附件、原309211行业务内容保全。四次只增加正常lease/grant，最终309219行。没有新模型请求，累计1469保持；用户服务、窗口和数据库未操作。
