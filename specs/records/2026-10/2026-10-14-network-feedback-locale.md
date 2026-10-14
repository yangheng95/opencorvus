# 第26批：网络设置反馈的当前语言

## Recall

- 持续迭代直到明确停止，Root自己调查/实现/验收，无子agent，不给其他聊天发消息。B25 c6c2bcafb范围正常commit/push0，原所有hooks通过；fresh fetch和远端main/own祖先确认。其15原图、15CONNECT、六当前error合同+一个原400、两个服务/四端口/配对/隐私0保持，不拿它替代本批。其他compaction/Task/Git与文档工作全部保留。
- 本批从保存/删除流程横审发现语言线索：NetworkPanel在校验、保存/删除错误和删除成功时立即调用t并存成string；testResult则存原数据并在render翻译，二者不同。现在先在真实当前页面语言切换中确认，不能提前宣布缺陷。
- 已读NetworkPanel当前完整实现/B25 Recall，config patchConfig/currentProjectConfigRequestOptions/已提交错误回执与config-load唯一appStore写入；ConfigRoutes和configResponse/项目JSON Merge Patch公开合同；ConfigDialogHost整页section与CommandPalette语言命令/热键、locale-preference；ProviderFeedback现有key/vars/details及共享Feedback/formatErrorDetails诊断合同；07-panel/07-panel-reactivity、10-05已有scope/反馈决策。全仓network.proxy相关键/定义/调用检索：delete_failed仅本组件两调用和两语言声明，reason无其他消费者；其余现有key已齐全。NetworkOperationOwner/草稿代际仅私有组件，保持B25原owner与finally。

## 根因与影响分析（实施前）

1. 可观察候选：英文无效代理URL触发错误后，Ctrl+K选中文但不卸载Network，产品导航已中文，原错误可能仍英文。Config是整页section而非Dialog，原热键允许打开命令面板；若实际热键阻止或页面卸载，必须以运行事实调整方案，不伪造错误注入。
2. 数据根因：setError(t(...))、setStatusMessage(t(...))提前固化当前locale，只保存已翻译string；render仅打印它，没有订阅原key及参数。testResult的proxyTestMessage在render调用t，已具备正确关系。改lang触发其他t不代表已保存string重译；旧scope/草稿代际是身份校验，不能让它承担语言或靠清掉原错误掩盖。
3. 影响面：同组件四个本地校验错误、保存/删除错误、删除成功反馈；saved按钮本来render时翻译，原testResult已同样正确。公共network.proxy.delete_failed原reason占位两调用之一来自另一份已翻译错误，另一是原诊断；需只在现有key上改为简短当前语言摘要，原抛错信息进入已有Feedback Details。没有第二错误类型或字符串关键字匹配。Provider已有同类key/details模式，不另建公共反馈框架。
4. 实现（真实复现后）：error由string改为私有key/details值，四校验和原保存/删除falsy分支写现有key；两个catch保存formatErrorDetails原错误，render调用t(key)并交给原Details。delete_failed两语言同一key去reason占位、保留动作准确摘要。删除成功用原事实boolean并在render t(network.proxy.deleted)，保持原timer和clearFeedback/scope回收。describeFailure仍服务原Test catch，不扩大改未触及诊断。没有新翻译源/状态机/配置或兼容层。
5. 公共契约/风险：只UI私有反馈投影及现有两语言值，无backend/SDK/参数/错误/路由、schema/持久数据格式或迁移变更；不改变原已提交配置事实、HTTP取消、代际、busy、保存/删除写入和B25旧draft退休。原用户/错误原文不翻译，HTTP/path/requestID/body由当前成熟formatErrorDetails保留。若无抛错分支的真实运行，不冒诊断Details已端到端通过。
6. 隔离真实验收：before18678/79使用B25冻结UI，after18680/81新Node bundle，经开发backend /ui；完整公开models+生成假auth同对，不复制用户凭据、不推理。先英文非法URL错误→实际Ctrl+K切中文→再切英文，补原图；after相同状态正向呈现当前语言且原草稿保留，再新空URL/用途校验。只能真实交互/截图人工复核，不新增/运行UI或源码文案/DOM/组件/快照/像素测试。
7. 保存/删除补验：在自有default Project提交公开的本机URL声明（仅声明，不冒连通），无用户名/密码；正式GET只保留network.proxy与HTTP状态/原响应字节数的安全选择，明确不是完整config正文。实际Save→读回准确url/用途→重新进页回填→Delete→读回有效当前代理空值；复验Saved/Deleted正常反馈/1.8秒timer及编辑后清空，截图中英。若不存在新产品缺陷，只记录实际资格，不为了代码改动制造问题。绝不操作用户配置或真实凭据。
8. 非调度修改；全部Network入口/原scope和Test/Saved/Deleted/timer/finally横审沿B25保持，没有发现新的调度/并发异常。若真实出现则按全仓入口/轮次/正常终态/恢复重启/串并行/多Project横审，不能降级为偶发。
9. 文档/交付：本spec/三索引先落盘，真实根因确认后修改。overlay类型、Node build、当前i18n目录/docs/架构与正常hooks，纯UI不加假业务单测。两own页面关闭→normal marker/runtime settlement→父exit/双端口0→假auth/models同对精确清理→完整日志隐私；原失败保留、工具先修后重跑。当前架构、中英未发布日志和原始证据同步，范围commit/fresh fetch+merge/完整pending审阅/正常push后继续，不新branch/worktree/发布。

## 实施前状态

仅分析和方案，产品未修改，当前语言错误与保存/删除资格尚待真实运行。

## 实施前真实确认

before PID89712、18678/79，occurrence172fcd84-a2b6-4fb7-b543-98e9f052e513，正式GET当前自有default Project配置200/proxy:null。Root亲看01英文非法socks5 URL校验；真实Ctrl+K语言命令在原Network不卸载时切中文，02导航/表单已中文却保留旧英文错误；再实际Test重算中文错误03，反向语言命令回英文后04仍保留中文错误。原URL四次均保持。不是浏览器locale或重挂载丢错的假象，根因确认是存入了已翻译string，按原key/details方案实施。tab33关闭并请求正常settlement；没有保存/删除/发送或代理HTTP测试。

## 最终实现与实际资格

- 产品仅NetworkPanel：error保存私有key/details，校验与save/delete写入原key、两个catch用已有formatErrorDetails；render当前t，delete success存事实boolean并沿原timer清理。两语言network.proxy.delete_failed同一key改短摘要，去掉仅本组件使用的reason占位；原技术诊断进入现有Details。没有新公共helper、协议、fallback、config/schema或状态owner；B25draft/原scope、busy与真实HTTP保持。
- overlay类型实际0，Node build实际0（2m2s，原第三方warnings保留），i18n当前2语言/2301keys实际0，docs345/26与架构20当前0。类型/构建/目录检查不代视觉；纯UI修改没有UI或源码文案/DOM/组件/快照/像素自动化。
- after PID79112，18680/81，occurrenceb593c449-d6ef-4497-abdb-670c91aa075e。Root亲看05英文校验→06同一原错误直接中文→07同一原错误直接英文，期间未重触Test、未卸载页面，原socks5 URL保留；08新空URL错误、09启用LLM scope的空URL保存错误；10英文Saved，11按原timer回到Save，12重开准确回填，13英文Deleted，14删除反馈结算后可用；15中文Saved、16中文Deleted。01–04均为原缺口，不冒通过。16张PNG逐张人工查看且未编辑。
- 两个语言各一次自有proxy配置Save/Delete成功，原URL均http://127.0.0.1:18681，两个用途false且无用户名/密码；只声明本机URL，不冒代理连通。正式GET共7次（before baseline；after baseline/saved/reopened/deleted/saved-zh/deleted-zh）均200，精确确认url/用途及删除后当前proxy:null。每份仅保存该三字段/HTTP状态/原body字节数的安全选择，非完整config原文；不声称保存了UI四次PATCH的原响应body。页面Saved/Deleted、原回填与实际GET形成正向当前契约。
- 没有故意破坏配置/权限/文件来制造后台throw，真实save/delete后端错误的Details展开、已提交但reconcile失败的409展示、用户名/密码编辑、切服务/Task/Project等本批未独立验收。formatErrorDetails复用既有原HTTP/path/requestID/body合同，其接入源码/类型已检查，但不把它当真实失败端到端。patchConfig原committed-receipt处理与Network原通用save失败分类保持，后者作为后续证据调查线索，不能宣称已解决。
- 自有tab33/34均关闭；两轮normal settlement、原父exit0和双端口0后精确删除生成auth/models同对，完整日志隐私checker0。后台98604/111547字节，stdout/stderr各0。两轮Provider inference requests与realSolCalls均0；用户凭据/进程/页面和其他任务staging保留。
- 当前架构、未发布中英日志、三索引和B25正常交付原件同步。locale只以单一key精确patch进入私有index，不把他人的新键混入；随后范围normal commit、fresh fetch/merge、完整pending审阅及normal push按原回执结算，不预写成功。
