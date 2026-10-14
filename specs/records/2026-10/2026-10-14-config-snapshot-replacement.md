# 第28批：完整配置快照替换

## Recall

- 用户要求持续批次迭代直到明确停止，Root独立做并验收，无子agent、不发其他聊天。B27 7b31ac496范围提交，13原图/13真实部分GET/三父和配对隐私0；正常推送尚在收束，以随后原回执为准。共享compaction、Subagent UI、grant与Git调查均属其他人类授权任务，保留其改动/staging/进程。
- 本批真实触发是B27 final after02 PID8136/32668161-c272-4a07-9bbc-4196e5248c31：清空公网地址并Save，真实GET200为null，12/13稳定页面仍是原/secure；不是Saved提示或类型测试推断。新批先落本方案，再改共享源，不在Channel局部补值。
- 已读app store/createStore/setSkillMounts/setMcp原reconcile primitive；config完整GET→diff→PATCH/六个正常、已提交错误、无diff返回；config-load全部独立加载/sequence/authority/directory ownership及两个config批量提交；permission-mode单tail/代际与全局写后接收；workspace原config:null清理；Channels原storeUrl effect。全src搜索七个直接config对象setter+两个bulk配置接收；其他config字样为参数/业务数据，workspace null是合法scope重置。调用者51处搜索读其公开update/patch/load作用；既有scope守卫不改。
- 历史搜索2494f5da5/d81ba1145/b2662a3f8/677f7afd1/a15cef3ad分别provider保存、语言持久化、历史可读、connection/selection归属等，没有当前完整快照删除投影实现。全仓setConfig/replaceConfig/setConfigSnapshot命名无现有实现。已读current07-panel及07-panel-reactivity归属合同、package当前测试/Node构建脚本。
- 已全文分类4个相关test：config-service-fail-fast、config-load-ownership、project-configuration-ownership为传输服务和store状态正向合同，无DOM/组件/截图/浏览器自动化；config-mutation-receipt是纯解析/诊断合同。不把fake transport局部合同说成真实端到端；不扫描无关UI tests，不新增UI测试。

## 根因和影响（实施前）

1. 可观察事实：持久配置已删server.publicUrl，但完整响应经setAppStore("config", saved)合并时，旧server根键留存；原Channel effect在finally重新同步该旧值。旧保存已正确发JSON Merge Patch删除，不能再改低层API或Channel草稿掩盖。
2. 安装的Solid store/dist/store.js updatePath明确对可wrappable对象mergeStoreNode；root批量对象仅浅合并config本身，因此project reload/global load在整体config层会替换，但其语义与直接setter不统一、不可逐处假定。reconcile applyState以目标键递归更新并删除缺失键。官方[createStore](https://docs.solidjs.com/reference/store-utilities/create-store)说明默认对象浅合并，[reconcile](https://docs.solidjs.com/reference/store-utilities/reconcile)明确用于完整输入快照。工具文档查阅在2026-10-14，不以新版本猜当前安装行为。
3. 范围：唯一setConfigSnapshot helper放现app store，setAppStore("config", reconcile(value,{merge:false}))；接收Record或null，不加新配置面、解析/校验/credential copy/持久格式。将六直接正常/committed/no-diff分支、permission全局正常分支和config-load两bulk接入，删除原对应setter路径。后两用Solid batch保持原config/channels/issues或provider响应的原子发布，原request/selection/sequence/owns/authority/public errors/返回原saved事实不变。workspace null原子清理已可准确替换，保留原reset。
4. 影响覆盖：任何Provider/model/network/server/permission等config根与嵌套删除都应投影当前真实快照，不能留下前快照字段；直接patchGlobalConfig正常返回仍由原caller接收，不能擅自给project面发布global值。已提交409只投影原receipt并仍抛原error，原普通503保留当前config。no-diff GET也应准确接收，而不是保留先前键。global/project load独立成功与失败仍按原资源结果/ownership发布。权限tail仅替换其原接收调用，不改排队、唤醒或终态；未观察此tail异常，不引入新timer/queue。
5. 风险：递归reconcile使缺失键消失，正是API完整快照合同；保留稳定store/嵌套响应性，避免先null再object的中间状态。所有owner守卫留原位；不会让已退休响应回写新Project/connection。JSON文档身份、schema、数据迁移、SDK路由均无变化，无API/UI英文关键字匹配。
6. 聚焦非UI正向测试：现config-service合同补完整成功、根/嵌套删除、update/no-diff、原committed409完整错误receipt；load合同补project/global完整快照和同批channels/provider/issues，精确assert当前完整对象/返回/请求。全是服务数据合同，不渲染/DOM/源码文案/页面自动断言，mock只局部资格。现project ownership/receipt合同不因来源名字扩为UI tests；可聚焦运行验证既有归属。
7. Root真实开发/ui页面：before18686/87可复用B27 ui-after02冻结输出，after18688/89新Node bundle；中文和英文实际保存有效URL→清空→稳定原图→切页重开为空，再保存新地址精确回填，非法输入仍行内且原合法配置保持。正式checker读config部分选择；后台真实配置GET/PATCH，不用fake transport冒页面。适当用配置页原操作验证嵌套server以外network删除，保持两用途false、不接外部proxy。权限真实开关会扩大自有agent权限，无需为本修复额外操作；其局部服务合同与完整共享路径资格明确分开。
8. 每次真实服务自有假auth+完整公共models，启动前投影核对，无真实Provider/Sol、用户凭据/数据库、channel enable/send；HTTPS只是地址声明。自建tab关闭→normal marker→parent真实exit/双口0→假auth/models整对清理→完整日志隐私0。任何超时/工具失败留原件并修工具，不能掩未完成。
9. 本spec/三索引先落盘，后最小生产与正向合同；types/Nodebuild/current docs与架构、原图/工具/正式GET/上一正常交付回执归档。中英unreleased一份来源/现架构一处补当前快照合同；范围commit/fresh fetch+merge/完整pending review/normal push后继续。无branch/worktree/rebase/force/noverify/发布。

## 实施前状态

仅方案与真实旧证据已读，生产/测试尚未修改；新before和after真实资格待运行。


## 实施与真实结果

B27 7b31ac496 normal push0，原全部hook通过（overlay新types24.335s，18owners/23sites、docs345/26、架构20、exact1164/5943/4、secrets0）；fresh远端main/own祖先确认。并发b082 grant408仅文档/原件阶段完整路径及Recall/README/manifest/限制已审，未混入本批。B28 before PID90492、18686/87、occurrence46f1296c-359b-4e96-8c5e-30d86039330b：01真实保存/original，02清空后旧值仍在；正式GET原值后null，两选择200，独立确认B27根因不是短暂截图。

四个生产源接入唯一setConfigSnapshot/reconcile。两bulk原先已替换config对象，统一到同helper后由原Solid batch保持整批可见；未把这两处错误宣称为同一直接setter缺陷。七个直接分支删除对应旧合并接收，workspace原null清理不变。没有URL字段补值、双写/兼容/parallel cache。实际新九个非UI服务正向合同，初轮37/93与补全局权限接收后最终38/95各0；四文件逐个独立runner，mock transport仅局部数据/归属/错误合同，无DOM/组件/浏览器fixture/截图断言。既有真实HTTP/视觉资格另列。

after PID40144、18688/89、occurrence7a23183b-6851-4249-903a-7e65c3ddd580，新Node build59.36s0、overlay类型0。Root逐张查看11原PNG：03英文合法原值、04清空为placeholder、05切网络后重开仍空；06中文保存大写HTTP /review、07非法socks5保留草稿及行内错误且正式GET仍精确/review；08中文清空为空，09两用途关闭/无凭据的本机proxy声明Saved、10实际Delete后空placeholder/已删除，11重开Channel仍空。01/02保留修前缺口，03–11为最终新bundle，不将build/文字/GET冒视觉。

正式GET200共11个安全选择（publicUrl9、proxy2），原status/URL或两个用途/原body长度保留，完整配置和八次实际UI PATCH response正文未另留。代理从未启用/测试连通，不做外部请求；没有真实模型调用。global权限/committed409/no-diff/跨服务或Project的真实页面未独立重演，只有聚焦服务合同，不能扩大为这些UI端到端。Provider/Sol、真实通道/附件/认证/传输错误、schema/迁移、并发调度不在本批资格。

tab38/39均已关闭；两个自有服务normal settlement/父实际exit0/双端口0，随后假auth/models整对清理，完整backend92882/109544字节、stdout/stderr各0、privacy0，inferenceRequests/realSolCalls0。没有用户窗口/进程操作或跨聊天消息。所有本批生产/测试与文档原差异可审，当前未发布日志和三索引同步，剩余文档/exact tree检查及正常提交推送以实际原回执为准。
