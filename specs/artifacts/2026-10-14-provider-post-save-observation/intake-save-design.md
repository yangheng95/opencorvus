# 第12批只读设计审查：Save / Save Key 串行后续结算

## Recall 与审查边界

已重读 `specs/records/2026-10/2026-10-14-provider-post-save-observation.md` 的Recall、根因与六项实施方案。Root负责真实前后态/故障运行，功能分工负责唯一typed receipt decoder/formatter及其数据合同。本分工不实现、不运行测试或UI、不启动服务/使用凭据、不改正式spec、不委托；仅写本文件。以下是对最新原Panel数据流的具体建议，正式helper名称以功能分工交付为准，不能按本文另建一份decoder。

## 结论

现有Save Key的serial loop可抽为一个很小的“按序运行并累计issues”的函数，两个调用方仅负责自己的入口commit与依赖关系。需要修的不是让所有阶段都fulfilled，而是把已提交事实、后续操作结果和观察结果分别保留：

- Config200或精确typed committed409都确立配置已经提交；409仍是本次issues之一，不能因接受commit就丢弃。
- 只要原调用owns仍有效且确实填了Key，初始config409不能挡住用户已授权的Auth写入。
- 只有Auth真正返回成功receipt，才可cleanup配置Key override；Auth失败不能清理旧配置凭据。
- reload是后续列表的最后独立操作，不依赖Auth/cleanup成功。它返回的fulfilled issues也必须保留。
- 关闭/reset/显示最终反馈只在原form occurrence仍当前时执行。完成reset后旧finally不再拥有表单是正确的，不是busy泄漏。

## 一个最小共享serial loop

最小operation描述只需phase与run，不需要阶段状态机、operation class、持久队列、额外generation或另一个provider状态map。run统一返回此阶段已有的issue列表；没有issues则返回空数组。loop：

1. 每一项run开始前检查调用方给的owns；false立即结束后续调度。
2. 顺序await run；fulfilled时把返回的issues加入本次局部结果；rejected时加入`{phase, message: formatErrorDetails(error)}`。
3. catch只结算本项，不把一次失败throw出整个循环，故后面的独立reload仍有机会执行。
4. 返回单一本次issues列表；不要把它再写入第二个全局cache。操作结果在本次调用结束后仅经现有feedback发布。

此处不是Promise.all：Auth→cleanup有明确写入顺序，reload需要观察这些步骤完成后的事实。也不需要通用workflow框架。唯一decoder决定初始配置是否committed；loop不猜任何业务commit、不把所有409都视为成功。

run的返回约定必须真实接收两种既有返回值：Auth成功receipt.issues；loadProviderInfo的ProviderLoadIssue[]。当前refreshAuthState（Panel366–367）只await而不return，直接复用将丢掉fulfilled读取issues；需让这一个原helper返回loader结果（或在唯一调用点直接return loader），scope已退休时返回空结果。不要在Panel发第二份HTTP请求来“检查”loader是否成功。

ProviderLoadIssue的resource、phase、providerID、message需保真；不能只拿message后将所有问题都标成credential failure。可让局部issue描述保留可选resource，并使原describeProviderIssue从同一条issue生成详情；原providerLoadIssues仍是当前观察面。若给没有phase的结果补操作上下文，应区分UI阶段标识与backend原phase，不能覆盖既有phase。

## 普通Save的具体控制流

1. 保留Panel615–646全部前置校验与捕获值：directory、id、initial、values、apiKey、occurrence、options。`ownsForm = occurrence === formOccurrence && options.isCurrentDirectory(directory)`不变。setSaving(true)后本次捕获的值才进入异步阶段。
2. 单独尝试初始updateActiveProviderConfig。fulfilled记录configCommitted；catch调用功能分工唯一decoder。命中精确Config committed receipt时同样记录configCommitted，并保存一次安全的config阶段诊断；普通错误走原precommit反馈，保留可编辑表单，**不派发Auth/cleanup/reload作为补救或重试**。
3. 初始Config已提交以后构建后续列表。Key为空时只有reload。Key非空时按Auth、cleanup、reload排列。准备一个本次局部`authReceipt`值；Auth阶段仅在收到合法成功结果时赋它，并返回receipt.issues。它是本次原始操作结果，不是凭据存在的UI影子状态。
4. cleanup只在authReceipt存在时运行；如果Auth拒绝，cleanup跳过而reload照常执行。这可在cleanup operation的run闭包里检查已取得receipt，不需新增通用predicate协议。由于loop只收issues，跳过cleanup返回空列表并不对用户伪报“cleanup成功”。
5. 初始typed409的issue与loop结果合并到同一个本次结果；循环每次run前均检查ownsForm。即便原请求已在服务器commit，用户已取消/重开/换scope时也不继续派发后续Auth。已派发的原请求可自然完成，不做物理取消承诺、回滚或向新scope重放。
6. 全部后续settled后，再检查ownsForm。若false，保留业务owner已经接受的原事实，但不close/reset/写当前feedback。若true，在一个同步尾部完成setShowAdd(false)、resetForm()、setEditing(null)，**然后**写最终feedback。
7. `resetForm`会清空feedback，因此不能先setFormError后reset。也不能在reset之后再检查旧ownsForm决定是否写本次feedback，旧occurrence此时必然退休。唯一有效性检查应位于同步close/reset/feedback尾部之前；此尾部中不再放await。

反馈至少保证：初始配置已commit时永远不显示泛化save_failed；typed409本身的协调失败和所有后续问题都有详情；Auth拒绝时不能显示“API Key已保存”。普通Save可以始终以配置已保存后的问题作摘要，再按阶段列出问题；若要额外断言Key已保存，只从authReceipt得出。没有issues的正常成功继续原关闭行为，不强加新的toast或额外状态。

## 行内Save Key的具体控制流

保留当前非空输入和savingKey.has(id)准入、捕获directory/options及独立row scope owns。与普通Save不同，它没有初始Config声明commit；它的入口是Auth写入。

把Auth也作为共享serial loop中的首项，随后依赖Auth receipt的cleanup和独立reload。这样Auth失败时仍可读取当前canonical目录，不再因外层catch提前绕过reload。初始Auth失败仍显示api_key.save_failed；若Auth成功而cleanup/reload有问题，显示api_key.saved_with_issues。新的读取成功不能抹掉Auth写失败，读取失败也不能把已成功Auth说成保存失败。

Auth收到成功receipt后才清原输入，且保留owns检查；真实receipt.issues与后续issue同序保留。cleanup若出现typedConfig409，它说明cleanup写入已commit但协调失败，作为config.credential-cleanup issue保留并继续reload，不把它转换成Auth失败或再次执行cleanup。

Save Key的caller owns应继续只绑定原row scope，而不是共享普通表单的formOccurrence。打开/关闭另一个编辑表单并不等于取消已明确点击的行内Save Key；给它错误加入formOccurrence会改变原语义。反过来，普通Save的Auth来自该次表单，必须受更强ownsForm保护。

## busy / reset / finally：没有当前已证实的saving遗留

当前源码：resetForm495–508先递增formOccurrence，invalidateDiscovery，然后在498同步setSaving(false)；cancel909–912、startAdd511–515、startEdit518–532都调用resetForm。scope effect254–275清各行busy，并由440–444的effect调用cancel；卸载433–439退休所有原generation。

因此成功关闭后旧finally700发现ownsForm=false且不再setSaving(false)是**正确的**：reset已经清理本次busy，而且旧finally不能覆盖可能已重开的新表单。不要为了“修finally”把cleanup改成无条件setSaving(false)，也不要引入另一个busy signal/map来记录已退休表单。

应覆盖的正向生命周期：

| 场景 | 当前应发布的明确结果 |
| --- | --- |
| precommit普通失败、原表单还在 | 保留表单及输入，显示错误，finally清本次saving |
| Config200/typed409，原表单完成后续 | close/reset已清saving；同步发布准确saved-with-issues；旧finally自然退出 |
| pending期间点击Cancel | reset清saving并退休occurrence；未派发后续停止；旧完成不关新表单 |
| Cancel后重开同ID并开始新Save | 新occurrence的saving由新请求拥有；旧finally不能清它 |
| Project A→B→A或同URL authority更换 | 原options仍因selectEpoch/scopeGeneration/authority revision失效，不因directory字符串再次相同恢复资格 |
| 行内Save Key在A→B→A后同ID再次保存 | scope effect清旧savingKey；新row操作独立拥有当前Set条目；旧finally因原owns=false不能删除新条目 |
| 卸载ProvidersPanel | 原generation退休；无后续UI写入，不声称已派发网络操作被取消 |

serial loop在每个run前检查owns，最终caller在写feedback/close前再检查。run后结果可以在本次局部变量里保留作为原请求事实，但不得直接写新的UI scope。不要只用id或directory做归属比较。

## 返回issues与反馈保真矩阵

| Config | Auth | cleanup | reload | 结论 |
| --- | --- | --- | --- | --- |
| 200 | 未填写Key | 不需要 | fulfilled且无issues | 配置已保存，当前目录已观察 |
| typed committed409 | 成功 | 成功 | 成功 | 配置和Key实际接受；仍保留初始协调问题 |
| 200/typed409 | 拒绝 | 因未获Auth receipt跳过 | 成功/有issues/拒绝 | 配置已保存；Auth写失败与读取结果独立呈现 |
| 200/typed409 | 成功并返回issues | 拒绝或typed409 | fulfilled并返回issues | Auth issues、cleanup问题、每条读取issue都保留 |
| 普通未提交错误 | 不派发 | 不派发 | 不作为该Save后续派发 | 未提交表单保留，不能伪造saved事实 |
| 行内Key入口 | Auth拒绝 | 跳过 | 独立观察 | Key保存失败，不以读取成功覆盖失败 |

loadProviderInfo正常HTTP故障走allSettled并fulfilled返回issues，不能只收loop rejected；不能把普通加载issues重新throw或另加自动retry save。UI current load issues与本次post-save issue是同一结果的不同用途，不能重新抓一遍或从输入补true/false。

## 隐私边界

typed409诊断必须由功能分工的唯一decoder/formatter投影；Panel不能直接JSON.stringify(decoded.config)、error.body或原Error对象。初始Config catch与loop catch统一formatErrorDetails，触及的console也只能使用该安全格式。原业务snapshot仍由services/config在自己的ownership fence发布；本局部result无需保留另一个config副本。

选择按typed409继续后续不等于吞错，也不授权重放Config/Auth。不得为了“流程成功”清掉初始typed receipt诊断。普通409/503、错误名称相似的文本或别的API结果都不能作为configCommitted。

## 验收建议与未实跑边界

Root真实页面需分别验证：无Key正常保存后当前catalog；typedConfig409且有样例Key仍完成Auth（current owner）；Auth拒绝后独立reload；cleanup失败后reload；fulfilled loader issues；最后恢复后的current事实。每条需要真实producer与持久化/HTTP结果，不可用fake browser response或组件测试。

额外桌面重点是“Save挂起→Cancel→同ID重开→新Save”以及A→B→A，观察新表单busy、输入和反馈；不以console clean、静态owns源码或一个普通成功图代替。实际取消可能发生在不同await边界，记录已派发阶段及真正终态，不声称所有阶段物理中止。

若抽出的loop进入普通service模块，可用聚焦正向结果测试明确运行顺序和返回issues：Auth拒绝事件→reload完成事件，cleanup拒绝→reload返回issue，精确owned结果与阶段顺序。不要为了测试新增通用框架，也不从TSX组件构造UI测试；本分工没有运行或新增任何测试。

当前readonly结论仅证明原reset不会因finally旧owns false而遗留saving，及以上控制流合同需要满足；新的代码尚未由本分工审查，真实触发/恢复与最终视觉仍待Root资格。原行内输入在busy期间是否允许新文本以及旧成功清输入的交互属于既有独立行为，本建议不新增per-key状态或顺带改变它。
