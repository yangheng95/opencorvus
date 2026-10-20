# Git可执行路径传递：完整对照后撤回

[修改前方案、Recall与修复器失败](../../records/2026-10/2026-10-21-git-executable-flow.md)。492单agent，Bun1.4.0/Git2.45.1.windows.1，真实Source CLI/正式488 UI（User Interface，用户界面）/446原生监管。**候选没有证明收益，已精确撤回；生产与2963e805基线一致。完整配置保存10秒/恢复5秒要求仍未达成。** 不操作用户18571或迁移用户库。

## 原完整checker与匹配对照

[原始矩阵](matrix.json)保留全部149原Project、148真实Git目录与真实预检产生的一个匿名Project；四组均150Project/199Session，同完整原5键canonical。每组经production config service→browser HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）保存后整份恢复，新增username显式删除；四读为Config、Provider、global providers及实际Session，不用局部Git耗时代替。

| 组 | 保存ms | 完整恢复ms | 最慢并发读取ms |
| --- | ---: | ---: | ---: |
| before | 17110.4444 | 16434.4720 | 17235.3124 |
| 候选after | 20718.7455 | 18054.9036 | 20821.1144 |
| 无页面control-before | 18999.3559 | 17632.8049 | 19081.1719 |
| 无页面control-after | 19059.5520 | 20866.6332 | 19120.5322 |

四组功能均正确，完整227 Provider/8133当前投影模型身份集一致，原目录为227 Provider/8423原始模型，不将正常投影差别误报为丢目录。候选首轮四读20秒也失败；其余三组四读通过。所有组10秒保存/5秒恢复失败。[各组-config.json与-readers.json](before-config.json)保留各自阈值和实测，不把checker功能exit0当作性能通过。

匹配control无页面、无并行测试/typecheck，使用同一已结算before库与配置，模型上限0；[实际旧源加载清单](control-before-source-selection.json)绑定不可变2963e805两个源模块，其余代码、模块解析、真实HTTP与数据保持。匹配保存几乎相同，候选恢复慢约3.23秒。单对样本不证明所有机器稳定回归，但不能支持部署该性能候选；旧which结果丢弃的代码事实也不能代替收益证明。首轮UI请求集合与inventory150/loaded2、4已比对相同，不能推给页面差异。

[撤回候选差异](withdrawn-candidate.patch)和[仅属于候选的正向实际Git测试](withdrawn-host-git-executable.test.ts.txt)作为文本证据保存，不在生产保留可选API（Application Programming Interface，应用程序接口）或失效测试。[候选11 pass/1 POSIX skip](git-tests.log)及[typecheck](typecheck.log)通过，只证明当时局部行为。无新持久格式、schema、缓存、Git替代入口或生产执行路径。

## 实际页面与资格边界

[九张人工截图与实际保存时间](screenshots.json)，全部通过授权内置浏览器自有页61/62呈现并查看：

- [英文Home](01-before-home-en.png)、[英文Goal说明](02-before-goal-guide-en.png)。
- [完整Provider目录](03-after-providers-ready.png)、[配置运行窗口内目录](04-after-providers-during-config.png)、[整份恢复后目录](05-after-providers-restored.png)。04的文件保存时间落在原writer起止内，仅此时间绑定，不声称loading画面或精确浏览器绘制时刻。
- [中文Home](06-after-home-zh.png)、[中文Goal说明](07-after-goal-guide-zh.png)、[中文创建表单](08-after-goal-form-zh.png)、[取消空表单后的Home](09-after-home-final-zh.png)。

仅打开/取消空表单，没有创建Goal/Task或从页面发送业务消息。界面沿用正式488版，本轮未新改UI；不把这组图称为新Sources流/Rendering复现或修复。两自有页已关闭，用户18571未刷新或关闭。不存在UI自动化测试。

## 请求、数据与原scope结算

固定4次实际gpt-6.1-sol请求，before/after各2，都是平台真实memory/chat流（非委托agent）；[before](before-physical-and-pair-cleanup.json)/[after](after-physical-and-pair-cleanup.json)每次实际outbound模型一致、streaming200、provider-source-reader settled/terminal eof。额外两个control各0/0且未耗尽，无新预检Session或假造原owner证明；独立api-ready明确关联此前真实完成的预检。

[全部九个原scope](physical-scopes.json)：四服务、四成功checker及原失败checker，原native物理/output/request/launcher全部完成，当前原host/target出生身份dead_or_reused。四服务各公开shutdown200，所有runtime完整auth/models配对退休。私有authority在原source EOF与物理完成、实际秘密值扫描后完整退休；凭据不进入归档。

[源与四clone保留](data-and-authority-preserved.json)：源schema3/integrity ok，149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome共3665行，全部原rowid/字段/时间及源bytes/mtime一致；四clone全部原行保留，完整canonical等于原对象。仅源SQLite只读serialize，没有源initializer或业务输入。四clone共用原实际物理Project目录，不把数据库克隆称为整个文件系统克隆。

首准备器Bun copyFileSync混合路径ENOENT，在任何服务/模型启动前修为标准绝对路径；原失败准备目录保留。首checker误用CLI默认Project查询真实匿名Session，后端返回正确NotFoundError404；[原失败日志](checker-before-private.log)与原exit1完整保留，修checker从当前clone选真实目录后重跑原完整验收，没有重启活跃服务或扩请求预算。

相邻准备/启动/checker/清理脚本用于审计重现，原私人库/历史/权威对不入仓库。后续须沿真实Git启动与完整配置调用链继续调查，不能以本轮排除一项候选宣称长期Goal完成。

[实际秘密值扫描与配对退休](credential-cleanup.json)：248个自有文本文件/153497041 bytes实际当前秘密值匹配0，原4/4 Sol及两个control0/0；所有runtime和private authority完整对退休。[原扫描/精确清理器](scan-and-retire.mjs)只删除已核验自有目录内两确定文件。源凭据bytes/mtime与选定值保持，无refresh/exchange；不在记录中输出凭据值。
