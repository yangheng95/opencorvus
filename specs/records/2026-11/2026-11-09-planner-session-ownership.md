# Planner 计划写入使用调用会话归属

## Recall

用户持续迭代授权有效，明确要求本人独立、不得用子agent。每批先根因与影响分析落盘，再证据修复、真实开发/ui与本人截图、聚焦正向功能测试、范围提交、fetch/普通merge/完整待推集审核/正常push后继续。前批a7a2147bb已正常推送，全部hook通过，HEAD/upstream0/0，原177条状态精确保持。Sol/真实Provider凭据授权仍未收到，不重复问、不读/复制/使用认证或模型目录，不做模型请求。此批不能冒称真实LLM（Large Language Model，大语言模型）或Permission/Session执行轮次端到端。

已读planner Tool全定义/三个动作、Tool.init执行包装、TaskPlan全模块/SQL（Structured Query Language，结构化查询语言）表、Session.create/active-project-session、Bus.publishOwned定义线索、TodoStore归属例、当前02-data的持久表/Session归属原则、07-panel事件投影；读取已有memory测试中唯一TaskPlan.add正向调用但不运行其LLM模拟套件。全仓所有TaskPlan定义/调用/同义task_plan.updated检索：生产写入口只有planner.add/update；loop/sessionStateContext和compaction按同一Session读取Markdown，experimental GET按assertActiveProjectSession后读list；overlay将该事件列为树writer无操作类型，没有可视Plan编辑器。get/remove无外部生产调用，但同域公开方法必须沿同一归属合同收敛。未发现触及路径的UI自动化测试。

## 实施前实证与根因

本人Temp b36/profile-before真实DB（Database，数据库）10，两个由实际Session.create生成的root会话A/B，不创建Message或Tool Part，不伪装模型执行。生产PlannerTool.init().execute创建A计划，然后以B的真实ctx.sessionID调用update_task，实际成功把A行改成completed/notes=Updated from B；继而B以A计划作parentId创建子计划，实际持久化parentID跨会话。B list_tasks count=1/tasks有子项，但tree只有空task-plan标签。原始before-observed.json保留所有ID/输出/状态；非fixture/mock证据，但不是模型端到端。

直接触发为update_task只传用户可选taskId、丢弃不可由模型选择的ctx.sessionID；TaskPlan.update/get SQL仅按id，整个实例共享数据库使同项目/跨项目Session都可能越界。add保存input.sessionID却不校验parentID，toMarkdown先按当前Session列表分组，再只从null父节点递归，跨会话/缺失parent使已接受目标从上下文树消失。旧list(sessionID)/服务路由project断言只保护读取，无法阻止写入或恢复已被错误覆盖的状态。SQL只有session_id外键，parent_id普通text，数据库没有同会话父子约束。

实际TCP（Transmission Control Protocol，传输控制协议）38992读取B的experimental/task-plan，HTTP（Hypertext Transfer Protocol，超文本传输协议）200与原持久行一致；运行时/doc的当前schema允许额外属性，Ajv2020验证通过，故不能把5字段声明与实际11字段的差异误报为响应schema失败。本批不改API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）或生成文档。

### 共享机制与范围审计

全生产源文件检索TaskPlan/task_plan的全部入口，仅记忆表、Tool、两个上下文读取器和readonly路由；Engine、Mission、Scheduler没有引用该表或模块。Updated事件由原Session事实派发，overlay不以其调度工作。本次真实completed是计划条目状态，不是EngineTask/Mission/Session occurrence（执行轮次）终态；没有观察队列/唤醒/恢复或真正执行终态异常，不能将其升级或降级为已验证的调度机制故障。所有Session种类共用相同planner边界，非某个专家团专用。测试覆盖root/assistant、两个独立项目、串行和同时工具调用，以及Instance.dispose后读回同一持久事实；这些不冒称全部引擎调度/retry/重启验收。

## 修改前方案与影响分析

唯一TaskPlan数据owner的get/update/remove都要求显式sessionID，以id AND session_id查询；唯一Tool.update把ctx.sessionID交给服务，模型参数不新增可选Session字段。update对当前会话找不到目标继续返回null，由原Tool产生明确Task not found/error响应，既有当前会话成功输出保持。get内部调用同步传同一session。add在同一个数据库writer事务检查给出的parentID确属当前Session，再插入并读回；缺失/跨会话父输入发布现成NotFoundError明确消息。update读取/改写/读回在同一事务，阻止并发删除把已读owner与提交目标分开。remove无生产调用，改为同样按owner精确删除且无目标时现NotFoundError，清除原声称自动cascade却未实现的误导注释；不额外新增子树删除能力。

状态、priority、progressPct、notes、时间戳、总表结构和持久格式不变。既有same-Session计划原地继续读写，原get/update/remove未暴露HTTP写路由，公开API/SDK保持。无schema或持久格式演进，无迁移；不会清空或改写历史计划。已发生越界覆盖的原值没有可恢复历史事实，旧跨会话/缺失父行也不能凭猜测重挂或删除；本批明确只根治新写入边界，不宣称历史数据修复。remove仍是精确单行行为，无当前生产调用；历史孤儿以及将来子树删除语义另行调查，不以此扩大本批。

纯后台正向测试先在旧实现观察失败，再改服务：当前会话树/更新明确输出；跨会话update明确Tool错误及原owner现有状态；非法父映射具名错误；多项目与root/assistant并行各自输出；dispose重载持久行；scoped remove明确成功结果/错误合同。禁止以not-called/absent之类核心断言或UI自动化测试验收。触及既有add调用保持签名，不运行无关全量测试。

## 验收方案

before38992当前公开路由/真实DB事实保存；开发/ui独立隐藏页面本人点击会话/文件与Memory设置，截图人工复核，明确现UI没有Plan组件，界面只能作为页面集成smoke，不能代替工具/数据库功能证明。after新profile/project与38993加载新后端，真实Tool wrapper创建/更新/错误/各归属读回及真实TCP路由；不提交合成消息或假模型输出。正式聚焦测试运行仓库真实runner；backend typecheck/docs:check/architecture-index辅助。

模型/权限/真实Session loop调用未授权不体验，Sol为未验而非无凭据断言。原notes/Git/config保持，自有页关闭/服务正常shutdown/原exec session退出；范围提交只本域源文件/测试/当前02-data合同/spec/artifacts及3README本条，fetch+普通merge+审查全待推集后正常push。不发版本/tag/Release，不操作现用进程。

## 未完成

原待实施/验收状态由下方最终结果更新。旧历史数据复原、子树删除及完整模型端到端不属于本批已达成范围。


## 最终实现与聚焦正向检查

TaskPlan.get/update/remove统一要求显式sessionID，所有目标SQL均id AND session_id；add在同一事务按该归属校验父目标/插入/读回，update在同一事务读取/写入/读回，remove对无归属输入发布原NotFoundError。只有planner.update生产调用需适配，已传宿主ctx.sessionID；Tool定义/parentId/taskId说明同步明确current session，未新增模型可选Session字段或host流程gate。删除了remove原未实现cascade的注释，仍只精确删除单行，无当前生产调用。原事件、表/持久格式/版本10、公开HTTP/SDK/前端资源不改。

仓库正式runner：`bun run test test/memory/task-plan-ownership.test.ts`（cwd packages/opencorvus）。先旧实现1通过/6失败，其中真实Tool越界更新、跨项目更新和非法父接受明确失败；get/update/remove新必需参数检查的失败还含旧签名不支持，分别保留，不把全部6项都包装为同一种根因。rXz9ot失败runtime按runner保留，physical/output settlement=true。改后7通过/22明确输出或错误断言；最终Tool归属说明补全后再跑仍7/22。测试使用真实memoryProject/Session/SQLite/Tool包装，含root+child树、owner状态与notes、具名父错误、两个独立项目、root与assistant的Promise.all各自更新、Instance.dispose再读持久事实、精确leaf删除后剩余root树。并发只验证这些工具调用，不冒称跨进程写竞争或Engine调度压力。没有UI自动化/负向核心断言、mock provider或假消息。

核心typecheck exit0；最终新增Tool说明只改文本，无类型/执行逻辑变化，最终正式功能用例已重跑，push hook仍执行整套类型/架构检查。docs352操作/26组与architecture20文档通过；后端本批不重新构建无变化的前端，两个开发页真实绑定上一批已构建main-Knc9Q_NS.js，不冒称本批UI重建。

## 独立工具、持久事实与真实TCP

after/probe-after.ts在fresh profile-after/项目执行真实Tool wrapper：B更新A收到原明确error JSON；B父指向A收到NotFoundError及明确当前Session说明；A仍原pending/notes=null；B自己的root+child成功，child in_progress/60/Owned evidence，list count2且tree含完整层级。Instance.dispose后重新提供同项目，A/B全部原行严格一致。after-observed.json保留实际ID/输出/行，未经过LLM/permission/Session loop，也没有canonical Message或Tool Part。

随后新的开发服务38993从同一持久profile启动；真实TCP两次GET分别返回A一项/B两项，原ID/notes/progress/time等整行与独立工具数据严格一致，运行时/doc/Ajv2020 schema均通过，请求ID a941a924-441a-402d-9fd4-a8eb69cdfd54 / b8513677-61da-4c75-b1a3-c77941de3264。before也真实200/schema通过，未误报额外响应属性为违反schema。API/SDK契约不改。

## 真实页面人工复核与资源保留

78/38992实页：01是文件点击后的Loading中间帧，不用作已加载原文资格；02英文Memory & Context正确项目/共享记忆0；03返回实际原文件，完整before notes可读且Save禁用。79/38993：04英文记忆页正确项目/空内容；05中文截图遇到菜单关闭淡出中间帧，不作稳定中文资格；06真实输入planner搜索后，无匹配结果/项目身份中文可读，菜单已关闭；07返回并真实打开after notes，原文完整、保存禁用。全部7图均实际呈现本人查看，稳定资格以02/03/04/06/07为准。没有Plan可视编辑器，不把这些页面smoke冒充计划工具视觉或模型端到端。

两页78/79关闭，两服务24576/51316分别正常shutdown200/原exec session退出0，prompts结清0。原worktree notes38/37字节CRLF分别保持，Git seed37/36字节LF分别保持；两项目reflog仅原initial seed commit，HEAD精确等于各seed，profile配置清单空。第一次本人核验脚本错误地把worktree CRLF和Git自动规范化LF当作必须逐字相等，断言失败；已分别按原创建文本/原seed事实校正并重跑原核验通过，没有修改原文件/Git对象或把换行当功能门槛。私有Git配置用于运行时，初始夹具commit使用显式隔离身份/禁签，Git内容已按当前换行设置规范化，如实保留两种事实。

## 限制与交付

本批阻止新的越界计划写入/非法父边；旧越界状态原值无历史证据可恢复，旧孤儿行不猜测改写，remove仍为精确行行为且无生产调用，子树/旧孤儿展示是独立待查线索。Sol、真实模型/Permission/Session轮次与Task/Mission队列/重启调度未验，不宣称已解决或验证这些机制。零凭据/模型请求，无用户进程或外部安装/发布操作。

提交仅两域源文件、新聚焦测试、当前02-data合同、本spec/artifacts及三个README本条；原177条工作区状态完整保持。提交后fetch/普通merge、全待推集合审查及必要checks后正常push，实际sha/推送结果由下一批Recall记录，不预报成功。
