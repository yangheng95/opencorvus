# 配置连续保存与实例初始化

2026-10-20；[Recall、完整根因及方案](../../records/2026-10/2026-10-20-physical-comparison-cost.md)。单开发agent；三个隔离native开发服务18799/18801/18803，当前正式472前端。未操作用户18571服务、窗口或真实数据库，未运行UI自动化。

本轮修复连续全局保存可能卡死的共享等待环：实例缓存先发布pending discovery，该发现等待全局候选已持有的目录queue，候选又加入该缓存Promise。现在唯一工厂先加入原registration authority，再发布/结算原discovery。现有已就绪缓存、精确继承durable registration、retention、abort、关闭/删除准入保持；不添加新锁或并行事实。另将唯一物理比较调整为精确bigint身份充分时直接判定，未知身份才读取物理路径，不跨准入复用观察。

## 实际结果

|完整数据服务|保存|恢复|最长并发读取|
|---|---:|---:|---:|
|当前基线，143 Project|20.028s|17.210s|20.381s|
|仅物理比较，第1轮，144 Project|16.659s|16.527s|17.004s|
|仅物理比较，第2轮|15.684s|共享等待环，未恢复|15.882s|
|最终两项修复，第1轮，145 Project|15.811s|16.342s|16.041s|
|最终两项修复，第2轮|16.618s|16.228s|16.895s|

[原始生产client/HostTransport/HTTP与阈值](performance.json)。原保存10s/恢复5s仍失败，最终四读20s通过；这些是不同完整历史数量的实际观测，不做严格等量提速百分比。第二轮失败没有藏掉或当成功。最终先通过正常接口[完整恢复原配置](original-restoration.json)，再连续两轮完整保存/恢复，Ask及最初整份parsed canonical均一致。

[实际未结算的writer与目录队列](failed-scope-pending.json)，[修复前真实队列正向用例失败](instance-order-before.log)、[修复后原用例和durable继承通过](instance-order-after.log)。未知异步生产者的具体函数仍未知，不能用标题推断；共享缓存/队列根因已由真实上下文、持有/等待和同一实际合同复现证明。旧alias竞争测试按当前“两个调用读同一持久owner”合同修正，未保留队列外陈旧捕获。

[完整142²实际文件系统矩阵](filesystem-probe.json)交错current/candidate/candidate/current为1204.527/318.386/244.219/1055.157ms，20164组身份关系逐项相同。仅证明本地文件系统成本，不冒充整条保存资格。[基线](before-phase-summary.json)、[中间](after-phase-summary.json)、[最终](fixed-phase-summary.json)按真实HTTP request ID分组；并发累计phase不是wall time。

[运行/真实Provider结算](native-settlement.json)：40950 exit0、失败29596 exit1、最终57855 exit0；三次shutdown200，全部physical/output/request结算。6/原批8实际gpt-6.1-sol请求，全200/stream/EOF。[复制对退休](private-pair-retirement.json)记录runtime/private完整auth/models退休和源metadata保持；无refresh/exchange。[历史](history.json)：原142/191身份/目录/归属完整，最终145/194/schema3；原来源双Session及32 Message/72 Part/62 protocol含rowid逐行保留。

[分阶段验证与纠正](verification.json)。直跑多文件的fixture寿命错误保留原失败日志，改用仓库既有逐文件隔离runner；没有用产品跳过目录掩盖。最终[统一18文件隔离运行](final-all-contracts.log)原10113 exit0，112 pass/2平台skip/236断言；最终类型检查96292 exit0，docs345 operations/26 groups通过。

## 人工截图

17张真实1280×720截图均实际呈现、人工查看，不是截图基线或DOM断言。

|阶段|截图|
|---|---|
|基线：原设置、保存中目录读取、目录恢复、Ask|[01](01-before-settings.png)、[02](02-before-providers-writing.png)、[03](03-before-providers-restored.png)、[04](04-before-ask-restored.png)|
|中间：设置、保存中、目录恢复、Ask、重复保存、失败服务关闭|[05](05-after-settings.png)、[06](06-after-providers-writing.png)、[07](07-after-providers-restored.png)、[08](08-after-ask-restored.png)、[09](09-repeat-providers-writing.png)、[10](10-after-failed-scope.png)|
|最终：原配置恢复、首次保存、目录/Ask恢复、第二轮保存与恢复|[11](11-fixed-original-restored.png)、[12](12-fixed-providers-writing.png)、[13](13-fixed-providers-restored.png)、[14](14-fixed-ask-restored.png)、[15](15-fixed-repeat-writing.png)、[16](16-fixed-repeat-restored.png)、[17](17-fixed-final-ask.png)|
