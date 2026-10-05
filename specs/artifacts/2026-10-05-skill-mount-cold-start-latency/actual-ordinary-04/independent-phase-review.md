# Actual ordinary04 independent phase review

## Recall / scope

Root要求只读独立复核本目录完整result、两份case result、phases、server log、launch/startup事实：核对11个实际HTTP/取消身份、冷initializer/creator/join、矩阵与安全pool、phase配对、边界和cleanup，明确noAuth与原Write02/19456ms mix不等价。仅新增本文件；未改raw/source/tests/index/record、未运行checker/HTTP/进程/Provider、未读取私有目录/auth/models内容、不委托。

已逐行解析两个完整server.log并对照phaseJSON及resultJSON，按真实requestID/spanID/initializerID交叉核验；不是仅接受status=passed或checker自述。时段2026-10-05T20:17:12.030Z–20:17:24.296Z，parent72984，ordinary unconnected port17955。源码参数为empty configuration，fresh ownedProjectA/B，compatibility disabled，未写N-Skill夹具。此范围是本次实际输入资格，不是原19.456s修复。

## Exact requests

每一行对应server started/completed、同ID诊断request started/completed；11个server结算均HTTP200。客户端实际接受10个200、1个caller-aborted，取消不能计入acceptedpool。

| occurrence / label | exact requestID | client ms / outcome | server ms | request phase ms |
| --- | --- | ---: | ---: | ---: |
| serial first-a | 583685b0-2f2e-46e5-9e69-c721c1e3456d | 399.20 /200 | 388 | 387 |
| warm-a | ecbd45ae-6d7d-428f-816a-6dda5a2b9399 |105.14 /200 |99 |99 |
| first-b |8cf5c2ce-7dba-4d4d-915c-7e85df7ea2a8 |169.66 /200 |167 |165 |
| parallel-a1 |ac26cfd4-c50f-4be5-bf9a-1e5b2f084f3e |168.62 /200 |165 |165 |
| parallel-a2 |36879fb5-e607-4e93-9678-30d507289a7c |230.72 /200 |221 |221 |
| parallel-b |bc5a94c3-5fc3-4820-b67d-c25e8c9ec66c |250.32 /200 |242 |242 |
| refresh-a |6061db80-e127-4e6b-86b3-492004ee02a1 |130.36 /200 |125 |125 |
| restarted cancel-observation-a |138712d5-ee54-491f-aa54-813a49bf0095 |179.38 /caller-aborted |384 |384 |
| post-cancel-a |077415ff-9edf-475b-a697-dc90f541606e |175.96 /200 |166 |166 |
| parallel-b |df020cc8-cd70-497f-b62c-84d4420e883f |213.30 /200 |205 |205 |
| settled-a |7e27364c-59d1-4f7d-a4bd-f5bb307ea0a0 |112.07 /200 |107 |106 |

serial7accepted、restart3accepted+1cancel。原15s未触发；最大accepted client399.20ms。取消exactID与fact.cancelRequestID/cancelOutcome一致，backend晚完成384ms200；它不是clientpass，随后A/B返回正确。没有unknown identity或latest任意请求兜底。取消report仅实际outcome/requestID，不携带完整bundlebody。

## Cold creator, refresh and concurrency

两个occurrence真实首个Project请求均是/skill/mounts，公开Project探针在矩阵/取消之后。serial first request20:17:16.510Z，诊断request16.511，matrix.config16.671；重启first request22.832，matrix.config22.996。各自实际创建config/skill/inventory，所有creator的initializerID都对应同份记录的state.initialize span；首个creatorRequestID指向该exactcoldrequest。因此不同于actual03的先Project探针预热，当前确有首次Skill状态构建。

serial首读config初始化28ms及另一次12ms、Skill22ms、inventory26ms；matrix.config31ms、catalog admission3ms/held37ms/release4ms、matrix.inventory45ms、projection.package117ms、matrix.projection139ms。重启取消原读config33ms和13ms、Skill29ms、inventory32ms；matrix.config36ms、catalogadmission7/held39/release1ms，matrixinventory47ms，package101ms/matrixprojection124ms。真实initializerstarted时取消发生、initializer仍正常settle，符合共享读继续完成合同；不能将这件事实解释为生产取消失败。

refresh触发当前真实reset入口后，config11ms、Skill4ms、inventory5ms；catalogadmission4/held12/release0ms、matrixinventory16ms、package78/matrixprojection92ms。A+A+B的三个真实started请求发生并行，均结束；observedcatalogadmission最大47ms，说明本次有等待，但不是长死锁证据。

serial总17initializer（config9/skill4/inventory4）；restart7（config3/skill2/inventory2）。state.read disposition分别creator17/cached-settled35与creator7/cached-settled24；**本次join-pending计数0**，不能宣称验证了真实join-pending场景。旧actual02夹具的join证据不能移作本轮证据。

特别字段边界：serial result.timing.startupInitializations=7只是HTTPrequestID=null的计数。七条原phase标注origin=startup-or-unattributed，实际时间17.895–18.352Z，全部在后置Project探针A17.573/B17.966之后；它们是未归属SkillHTTP的后段初始化，不能改称启动前预热。restart此计数0。未改变raw或替它重新归属creator；当前cold证据来自真正HTTP关联initializer，而非这个字段名。

## Slow phase ranking and unpartitioned time

按completed span最大wall duration排名（嵌套span不能求和当routewall）：

| phase | serial max ms / count | restart max ms / count |
| --- | ---: | ---: |
| matrix.projection |186 /7 |141 /4 |
| projection.package |171 /7 |125 /4 |
| catalog.total |121 /11 |47 /6 |
| catalog.held |97 /11 |39 /6 |
| catalog.reentrant |96 /14 |30 /6 |
| matrix.inventory |50 /7 |47 /4 |
| catalog.admission |47 /11 |15 /6 |
| matrix.config |31 /7 |36 /4 |

首request phase到matrix.config start另有160ms(serial)和164ms(restart)；日志没有为这段前导分配具体子phase。不能凭位置断言是扫描、模块加载、锁或Config成本，也不能把stage之和强行解释完整387/384ms。已量到的主要内层成本为package/projection，其最大值171/186ms远低于原19s；没有证据要求优化它作为原根因。

## Complete safe projection and phases

全部10accepted结果的safeprojection完全相同：scope=project，activeProfile=base，totalSkills7；source_type builtin6/unknown1，风险low6/medium1；真正source admission分类builtin6/package-resource1，均accepted，unmounted6。unknown1是canonical package resource类别，不是未知私有路径许可。六个agent为orchestrator(orchestrator)、universal-build(build)、base-developer(build)、base-planner(delegated-worker)、base-researcher(explore)、base-tester(delegated-worker)。grants依次7/6/7/7/7/7，总41。已保存安全结果不会证明每个resource正文，但checker实际完整Matrix schema和完整内存冷暖比较已执行；原池未fixture过滤。

serial558条Skill diagnostics=279started+279completed；restart296=148+148。对每个spanID进行Counter比对，完全一致：总854条/427对，无漏配或重复phase补造。11个request各自一started一completed且正常fulfilled。两个完整raw日志未见level=error；completeddiagnostic rejected计数0。这只限定这些actual04日志，不能消除Write02已保存的skills timeout。HTTP-null后置initializer也配对正常。

## Public boundary and lifecycle evidence

serial启动occurrence853547f5-cfef-4489-ab3f-ca1915fdee7a，source45216/helper72424；restartoccurrencef965c881-b9b7-4503-94ab-3a34a4d88939，source62588/helper74512。两份startup各自pid/occurrence/listening URL127.0.0.1:17955匹配case。public ProjectA/B共4次200，返回worktree精确等于各freshproject；serial IDs fc853277-4ed6-4c5d-b81f-833b410b3fcf /11da41e6-2690-45ca-aa77-bb94ca3995f8；restart440e9034-ea0d-44dd-99ed-0287f938d558 /336e2206-fd43-40d9-95f7-e5c8c75c4795。

两case shutdown200 ok=true，terminal和disposal均reason=exited/exitCode0/signalnull。checker保存physicalOwner/Helper=dead_or_reused与finalPortfree；这是当时checker的实际检查回执，本agent没有执行现时CIM/listener核验，不能替代Root独立physical review。ordinaryownedroot明确保留，未自动删除；parent72984现时状态/后续目录清理由Root核验，不宣称该目录已删或parent已gone。

两case启动metadata auth.json absent、models.json absent；expectedProducer记录canonicaldefaultcatalog，observedProvision=false。本轮raw没有models.dev provisionlog。因此不能沿用ordinary01的2001983B catalog存在事实或声称actual04生成/复制了它。只读metadata不验证auth内容/可用Provider，不读取模型目录。

## Independent conclusion

Actual04已独立资格化fresh UNCONNECTED普通输入的冷/暖A、首次B、A+A+B、refresh、同owned持久root重启、真实caller cancellation+backend结算、完整安全pool与公共Project边界；当前输入下没有19.456s慢请求。它没有Auth、授权Solpreflight、实际UI并发入口或Write02已连接配置状态，不能宣称原Skills timeout根因已排除或修复，也不能拿“passed”降级共享问题。下一是否复现实际mix以及安全授权与精确physicalcleanup由Root决定；本review不建议猜测性能补丁或deadline增加。

