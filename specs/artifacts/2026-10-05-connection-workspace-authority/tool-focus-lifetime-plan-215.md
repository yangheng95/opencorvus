# 215 Tool Tab 焦点寿命调查

## Recall

用户要求持续自主体验和修复Sources、Rendering/UI（User Interface，用户界面）及功能，最新单agent优先于旧goal中的委托要求。当前649bdcee已正常推送，起始工作区干净。214保留焦点虚拟item，Source A原生End/Home同焦点已通过；统一后代focus阅读后Tab返回top448.666/followfalse，但Tool按钮短暂focus后BODY，仍未满足。不能把viewport改善或Source成功作为Tool焦点合格。

## 深度、资料与当前未知

已重读214 Recall/原生focus事件/最终失败/闭合，现行07合同、Conversation虚拟item与focus pin、CardParts的ExecutionEventRun/Index分组、Button原生实现、SourceParts、共享dom-utils。214诊断证明同item的Tool button先正确focusin/pin，3ms后focusout/null；排除了relatedTarget初次交接提前释放，不允许猜测微任务恢复。暂停时同button保留，跟随后Tab失焦；215需分辨虚拟wrapper隐藏、虚拟item卸载、内层ExecutionEventRun重建或其他真实原生原因。标签、最后BODY和模型自述不是根因。没有调度/队列/恢复异常，不预设后端改动。

已搜索虚拟keepMounted全部定义/消费者，仅Main使用virtua0.49.3，另两panel同共享scroll controller；CardParts为公共Tool/Sources投影。若动公共契约须先继续全仓定义/调用/历史决定/数据/测试搜索并补本方案。仓库UI自动化禁止，诊断不是测试或功能验收，所有动作仍实际CUA（Computer Use Automation，计算机界面操作）输入与人工截图。

## 实施前调查方案

重验原213完整已闭合runtime最新schema/config/Task/dispatch/未完成publication/delivery/provider/tool集合及两个原Project安全条件；fresh215复制全runtime、全90表逐实际行比较，原Session/Part/Project ID与project目录不变，保持原213/214。沿214已审查Session专用私有copy/Native launcher/唯一shutdown，不复制凭据/模型目录、不重新执行原Task或模型。用户page23不操作，新自己页面使用18135/ui，固定15分钟原生预算不延期。

先当前649/main-BOwxTyIC真实复现Source A→CtrlEnd→Tab失败并保存当前事实。然后仅临时记录：native focus target/related/active的canonical item、Tool aria身份、isConnected、有限祖先computed visibility/display/index/rect；同虚拟item cleanup及ExecutionEventRun cleanup的canonical key/Part IDs。事件后的微任务只读原目标/active，不能移动焦点、改行为、增加保留延迟或输出正文/凭据。prepare完再启动；诊断build在自己服务预算内，reload只限自己页面。原失败及不复现都保留，诊断扰动边界明确，全部临时代码最终删除。

以节点连接/真实cleanup/样式与原生时序证据决定根因，更新深度/公共影响/风险和具体方案后才修生产行为。若时间不足先闭合自己scope保留未知，不因观察超时重启或缩短验收求绿。修复后types/build与同一自然连续输入、Source/Tool真实交互和截图复核；Side Chat/child/实际流式未采矩阵明示，后续完整配对真实模型另scope。

原父工具、Native physical/output/request、独立OS（Operating System，操作系统）出生身份/端口/pair闭合，5份本轮FFI（Foreign Function Interface，外部函数接口）产物按精确出生时间单文件移到私有忽略目录；保留原始日志。新增spec同步三索引/docs检查，结束前范围提交、fetch/merge上游、完整待推送集合检查、正常push。持续目标保持active。

## 当前215 直接证据与下一诊断

原父56246/自己page30，固定deadline1791503613949；原90表copy/current safety全部准入。未修改649资产main-BOwxTyIC也复现Source A CtrlEnd→Tab：BODY/top448.666/followfalse。49.44s诊断构建main-D1t5T-Ck下同失败；23:41:17.218 Tool button focusin，.220只有尾部第三虚拟item清理，.222 Tool focusout/null时target isConnected=true，全部祖先display/visibility可见，首assistant item与其ExecutionEventRun没有cleanup。排除简单按钮替换、所属item卸载和CSS隐藏猜测；不以此直接认定具体DOM（Document Object Model，文档对象模型）移动原因。

下一步只追加该native focusout/null调用栈，区分原生外部失焦与库的DOM重排调用；仍不改行为/焦点或保留期限。临时诊断不宣称修复，不保留到最终交付。当前预算内完成精确root cause再更新修复方案；原基线/诊断失败继续保留。

## 精确根因与修改前方案

23:43:59.471真实focusout调用栈落到已载native-menu-surface-contract-b_vimv-0.js:1:19769的wn；本地构建实际片段确认该位置是Solid DOM reconcileArrays的parent.replaceChild分支。安装实际solid-js1.9.14四个web开发/生产ESM（ECMAScript Module，模块）/CommonJS出口均同实现。214只保留组件/虚拟item，没有保证协调器暂时移走同一DOM子树时的原生焦点，故不cleanup且visible/connected的元素仍会在replaceChild重排中失焦。原源树中的子树在新数组仍存在，改变的是协调性能启发式，不是消息身份或Tool状态。

当前虚拟range与keepMounted始终按同一canonical item顺序合并。插入前方user item时旧[Source,tail]→新[user,Source]，旧算法sequence未大于新前缀长度时选replaceChild，先移除Source再插回；Source内Tool焦点因此丢失。相关append、删除、共同前后缀及cross-swap分支已读：保持交集相对顺序的该生产窗口不会进入交叉交换分支；真实重新排序的一般其他组件仍不在本次视觉资格范围。公共patch必须针对真实focus子树条件，不能匹配Source/Tool名字或指定索引。

查阅[dom-expressions官方协调实现](https://github.com/ryansolid/dom-expressions/blob/main/packages/dom-expressions/src/reconcile.js)与[MDN moveBefore](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)：移动中原生状态与节点组件身份不同。后者尚有限平台支持，不引入新浏览器要求/feature fallback，也不劫持DOM prototype。采用仓库已有patchedDependencies单一机制修安装的solid-js1.9.14：在此映射前缀分支，若原现存子树contains其ownerDocument.activeElement，则选择现有insert-before分支移动/插入其他节点，保留focus子树，其他性能启发式保持。四个web出口同步；不升版本、不改服务端/声明、不加新渲染实现、计时、focus迁移或旧协议兼容。

影响为该Solid浏览器版本的数组协调，风险是聚焦分支可能比最少替换多做前方插入，优先原生交互完整性；移除真正不在新数组的控件仍按真实数据处理。全仓现有patch面与库源码/调用关系已读，新增根patch文档和07合同、根manifest/lock同步。使用成熟bun patch prepare/commit，实际frozen install及package topology正向配置检查，types/build后当前真实Source A→End→Tab/Tool Space/局部阅读和下一Tab复测。禁止UI自动化测试；跨平台、一般交叉重新排序、其他Solid版本、Side Chat/child/新模型流式仍未证明，不扩大成功声明。所有临时诊断全部删除，原失败/调用栈/preimage保留。原215 native deadline不变，不能为安装/构建延长；来不及则闭合并继续新合法scope而不宣称UI通过。

## 21501 真实修复结果及原终态

本机bun patch commit两次EPERM/copyfile失败；未忽略保护或弱化checks。采用真实git --no-index对比Bun已准备1.9.14与原不可变安装包生成标准四出口patch，保留实际差异，root patchedDependencies与lock单一绑定；正常bun install应用，frozen install/package topology/types59705全0。最终build14785=0/51.43s，main-BvdfiTpl真正加载后Source A End→Tab保持MDN Tool BUTTON/owner/448.666/false，6s稳定；原BODY失败保留。

实际Space进入Tool正文后原只读接口400 ProviderModelNotFoundError/gpt-6.1-sol，整个card错误区替代正文，Source消失；该scope未投影catalog，不误报用户auth缺失，不能称Tool展开合格。source/cache局部错误展示与完整配对Side Chat/流式后续另查，原错误和截图保留。

public shutdown开始过晚，原父56246=1，Native23:53:34.060Z deadline_exceeded/1，完整physical/output/request与OS/pair cleanup完成但整体原生资格失败。之前把清理完成称正常退出需纠正，绝不改原1为0。固定15m按原策略生效，没有新增调度/队列异常或延长期限；不足是本轮操作预算，不猜测共享终态修复。旧21501不重启。

另开当前补丁fresh21502完整原213副本，同current safety及90表逐行核对，独立18136/ui、15m原生预算，准备完成后只做Source End/Home/Tool Tab稳定阅读、真实编辑caret，再尽早public闭合。没有凭据/新模型请求；原Tool正文400与Side Chat/child/流式未采矩阵继续明示，不将新scope成功覆盖旧scope失败。
