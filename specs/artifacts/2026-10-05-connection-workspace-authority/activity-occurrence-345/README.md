# 345 活动轮次实际验收

[Recall](../activity-occurrence-plan-345.md)。单agent，原HEAD d144c4317，0新Provider请求，不使用开发子agent。

## 根因与改动

329真实Task tsk_g00VXnHXUY002nUsxVFT 的首条输入msg_g0VXnHYNh00vQfmcZ1yI已经被回复msg_huE9jYvZb3HfJpmexgNX与control输入共同接收。旧projectConversationAgentView只按parentID建轮次，又把首条输入补成独立pending，造成4条活动。实际执行记录只有3轮：首个orchestrator idle、研究员completed、末个orchestrator completed。Task最终完成不改变前一轮真实idle。

当前共享投影复用Message.acceptedInputMessageIDs，把没有独立prepared/lifecycle事实的批次输入归到真实parent轮次；完整批次消息仍可定位。已有独立轮次与后续未接收输入保持各自状态。正文、持久Message、调度和控制协议未修改。Add guidance的历史Session终态并非准入条件，因此没有仅凭Completed隐藏它；终态后新引导尚未在本轮执行。

## 实际页面

原329已物理闭合、Task epoch1完成、全部恢复/权限/消息/发布/Memory和配置重新核验后，两次复制完整90表并逐表完整行比对。18322/ui开发模式直接服务现有main-tuh6dcX2.js，两次固定600000ms寿命且没有auth/models。

- 页面132：01-before-activity.png与02-before-pending-input.png，人工看到4个活动标记；点击Pending定位到已经被接收的原始用户输入。
- 页面133：03-after-activity.png，实际Idle导航定位到首个orchestrator回复，活动表为3轮；04-after-original-input.png，Ctrl+Home仍能阅读原始用户消息；05-after-child-sources.png，原研究员子侧栏的文件第2/3/4行Sources展开正常。
- Task和Session两个实际GET均返回相同3轮数据；完整before/after响应、原始只读执行事实与校验结果随证据保留。

这些截图均由实际交互取得并人工查看，没有UI自动化测试、DOM断言或截图基线。页面的模型配置不可用提示来自刻意不复制auth/models的只读副本，不是本轮制造的产品故障。未发送消息、未改变原项目文件。

## 验证与限制

7个聚焦后端投影测试、14项正向断言通过；opencorvus类型检查通过。实际数据库Message全字段、Source全字段与Provider request身份比较，以及HTTP完整transcript/执行事实比较保留于checks。原始15持久Provider身份不替代329独立审计的17次实际请求；本轮增加0次。

docs:check通过345 ops/25 groups。实际两次运行149156ms与121852ms；完整响应以gzip保留，原始未压缩文件移至本轮私有目录。79份文本/解压内容凭据扫描0命中。

两次页面已关闭；启动句柄47270/11378分别实际join exit0，生产native/output/request结算和配对清理有原始receipt。5个native debug pile按01进程出生核验后精确归档，02复用原已存在文件，没有将其声称为第二组新文件。

调查脚本初次缺输出目录、SQL猜测不存在的agent_id列、格式化命令工作目录错误均已修正并重跑相应步骤；原始数据库只读，产品验收未因此省略。脚本和日志按实际文件完整压缩归档，不用源码哈希作功能验收。

这是历史Task和当前真实HTTP/页面验收，不包含新的实时模型流、所有重试/多项目组合或原Research Studio的旧schema记录；实时Rendering闪烁仍待继续观察。
