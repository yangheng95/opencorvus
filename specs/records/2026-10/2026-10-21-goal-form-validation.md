# 持续目标表单的输入反馈

## Recall

持续单开发 agent，不委托；用户后续明确单 agent 要求覆盖长期 Goal 中旧三个 Astra 文本。上一轮485是 progress：d9674eb1ad805fab735f467411abaaf2978248b5正常提交推送，fresh fetch确认HEAD=origin/main。网页工具摘要与来源旁的响应类型残片修复，11张实页、原87行七表保留及原39640/19152完整结算，自有53/54关闭；无凭据或模型请求。开始仅原.bun/和packages/opencorvus/bun/未跟踪。

原用户要求仍为持续深入体验、UI（User Interface，用户界面）与功能根因修复、真实验证、提交推送；Goal难以使用及首页布局是明确要求，Sources/Rendering仍保留优先范围，完整配置10秒保存/5秒恢复尚未达。本轮不能用表单反馈替代这些未完成验收。

已读AGENTS、485 Recall、当前continuous-goal架构、07-panel原语言/控件合同，472首页确认边界、479模型选择指南与480结算投影记录，ContinuousGoalControl完整创建/预算/save/guide代码、TextField原生控件与Description/ErrorMessage唯一primitive（基础组件）。全仓搜索onInvalid/setCustomValidity/reportValidity/noValidate及所有Goal调用，当前未发现应用原生校验本地化实现；GoalDialogHost是Delivery Goal表单，不是此次持续目标owner。没有委托。

## 修改前线索与影响面

当前目标字段为required textarea，预算是number/min1/step1；form的save只在onSubmit后使用当前locale（界面语言）的既有validation提示。浏览器的交互约束校验先于submit；原生required/min/step可能直接显示浏览器语言的提示，跳过应用save。若中文页面实际复现另一语言错误或缺少可读反馈，根因在原生字段错误表达与界面语言没有连接。现在还没有实页故障证据，不能先改生产。

此前472修确认后创建与草稿移交、476修详情滚动/额度并发、479修模型选择指引，均不证明原生输入校验语言。共同调用覆盖Home及Chat/Task/Mission/SideChat持续目标；只改此共同表单，不按宿主散落补丁。不得关闭浏览器约束校验后将badInput空字符串误当不限预算，不替换预算解析/服务校验，不改变原Controller消息/调度/owner、Schema（数据库结构）或API（Application Programming Interface，程序接口）。当前无调度/恢复异常证据，若出现必须立即横审全部生产入口与occurrence（执行轮次）。

## 实施前方案与验收

before原11212/18851、自有55页已实际复现：01英文required提示可见；切中文后02仍显示“Please fill out this field.”，03零预算显示英文下限说明而中文标签/正文保持中文。原生焦点分别落在目标/令牌预算。根因确认为未绑定应用locale的native invalid错误，不是保存请求失败、模型未配置或调度异常。参考[WHATWG HTML约束校验](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#dom-cva-setcustomvalidity)：原生约束校验触发invalid，setCustomValidity提供展示文本，空字符串清除自定义错误。无翻译浏览器原文或第二校验器。

实施限定ContinuousGoalControl的四个真实字段：objective/两个budget/完成evidence。其onInvalid按原既有objective/budget/reason键设置当前语言的custom validity；原onInput先清除该字段custom validity再更新原signal。保留required、maxlength、number/min/step、默认原生交互约束、焦点、现有save解析/服务校验和错误摘要。Common TextField API、其他表单和所有后端均不改，不调用preventDefault阻止native校验，也不添加noValidate。相同组件的关闭重开及语言切换须实页复核，完成证据若本轮没有真实已有Goal样本，则只标注共享代码/类型覆盖，不扩大成实页资格。

1. 创建486 before18851及after18853独立runtime/home/config/log/tmp，源为已关闭482真实历史全库readonly serialize，87行七表与schema3全部保留。before用冻结485正式UI，after仅在确定根因并正式构建后准备；源码开发CLI（Command Line Interface，命令行界面）/ui经413 owned-host与446原生监管器提供，20分钟资源边界。不能操作用户18571、用户库或旧自有服务，不能创建分支/工作树。
2. 不复制凭据或模型目录、不发预检/模型输入、不创建有效目标。本轮只打开原Home表单、提交空目标及零/小数预算等明确原生无效输入、修改为合法输入但关闭而不确认，核查草稿保留/取消与公开事实。若需要有效目标/模型资格，必须另行明确有限scope，不能将本轮只读历史或表单截图冒充端到端执行。
3. 用内置浏览器实际页面交互、原生截图人工复核中文/英文反馈、焦点位置、纠正错误后反馈恢复、创建关闭与Home草稿。禁止新增或运行UI自动化、DOM（Document Object Model，文档对象模型）/组件/文案/截图断言。源码类型/语言/build只做辅助，原七表/公开事实校验属于非界面数据证据。
4. 只有实际复现后才补齐根因、生产修改方案并实现。优先成熟原生constraint validation（约束校验）及当前locale/既有提示、原TextField；不得新建平行校验器、状态缓存、协议fallback（后备路径）或绕开native数值合法性。修复应保持同一字段的required/min/step、原submit与服务校验完整，并确认纠正后不会残留自定义错误或错误语言。
5. 任一原scope仅一次精确PID（Process Identifier，进程标识）/出生时间public shutdown，join原native物理/output/request/launcher，冻结日志、关闭自有页；全数据保留与源库metadata核对。归档真实图、原checker和边界，更新三索引/docs/architecture。范围提交、fresh fetch/merge、完整pending审核和正常hooks push/fresh fetch；不发布版本、tag、Release或拉取请求，长期Goal active。

## after纠正路径（执行前）

原46205最终正式构建53.29秒/类型22750均exit0；after原46698/18853、实页56已确认英文Enter an objective、中文请填写目标、零令牌预算及1.5自动轮次的中文正整数提示，原生焦点按字段移动。为实际确认自定义错误清除后能进入原save，又保持不创建有效目标，将两个预算纠正为1000/1，目标改成一个空格再提交：原生required接受非空格值，但原save的trim/目标语义校验明确返回既有中文Feedback，早于任何launch/mutate。该输入属于应用明确无效目标，不放宽“不创建有效目标/不发模型请求”的本批范围。禁止用脚本触发checkValidity或UI断言代替此实际操作；若错误仍卡在旧预算则记录失败并修复。

## 首轮返工根因与最终scope（实施前）

08实页确实进入原save并显示中文目标语义错误，证明两个纠正后原生预算与目标custom validity都已恢复。继续把目标填成真实非空文字、令牌改成0，09却仍保留“请填写目标”的旧表单Feedback。代码确认validation只在open/launch/mutate清除，字段onInput不退休已过期的本地提交摘要；这与native错误语言是同一表单输入反馈生命周期的另一缺口，不是后端Goal错误。不能用09宣称全部反馈已正常。

最终四个原onInput同步清除既有validation signal；不清failure/projection.error，不遮住服务端错误，不增字段错误状态/缓存/并行校验器。现有save仍是本地语义校验唯一来源，下次提交重新得到明确当前错误。先正常结算原46698/18853及自有56，再正式构建，使用独立final18855与fresh数据/bundle，仍无凭据/模型输入/有效Goal，每个原scope20分钟资源界限独立且不延长或重启原句柄。最终需重复原生语言/纠正→语义摘要→继续编辑→当前无效预算反馈，并检查关闭重开及原Home草稿；旧04—09保留为首轮资格/失败，不能当最终生产页面。

## 最终实际结果

最终正式UI构建65506 exit0/51.82秒，类型43952 exit0；独立final原17964/18855、实页57人工复核10—19。10/11英文目标与预算错误使用当前语言；切中文并重开后12—14的必填、零预算与1.5自动轮次均为中文提示，焦点落在目标/当前错误预算。15把预算纠正为1000/1、目标设一个空格，真实原onSubmit→save给出中文目标语义Feedback，证明原native自定义错误已经清除、应用语义检查仍有效；没有有效Goal提交。16填好目标后旧摘要退休，17再次提交只显示当前零预算提示，09旧残留路径已修。18重开从真实Home草稿预填目标、预算未指定，19取消回Home仍可编辑同一草稿。全部19张图实际查看，首轮09作为失败保留，不以源码/DOM/截图断言替代人工。

三scope均由同一源完整readonly serialize，原七表87行含rowid/完整字段/时间逐项保留，原源库全部行及大小/mtime保持；各副本最终5 Project/4 Session/14 Message/33 Part/28 protocol_event/2 request/2 outcome/schema3，canonical{}。每scope新增自己的1个Project；本轮所有输入均无效或取消，没有新有效Goal/消息/模型执行。原11212/46698/17964各自公开shutdown200、join0，native精确物理/output/request/launcher完整结算后才推进下一scope；55/56/57全部关闭。没有复制凭据、模型目录、Provider预检或恢复旧预算，用户18571/用户库未操作。

修改只在一个生产组件与现行continuous-goal架构；无新的locale键、CSS（Cascading Style Sheets，层叠样式表）、持久化、API/schema、调度、Provider或测试实现。两语言2523键通过；新记录与[19张图、原数据和三个scope](../../artifacts/2026-10-21-goal-form-validation/README.md)同步三索引，文档/架构辅助检查后范围提交与正常push。完成evidence/既有Chat/Task/Mission/SideChat只有共享代码与类型覆盖，未取得本轮独立实页资格；没有有效Goal/模型端到端执行、全输入法/浏览器/跨平台或全部Rendering资格。完整配置10秒/5秒仍未达，长期Goal active。
