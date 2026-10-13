# 388 参考历史重连时的正文身份

## Recall

继续单agent，不委托。387是progress：b41605400已在上游，真实回调把13条尺寸通知定位到Virtua同步测量，7次Sol/Native正常闭合；不能把它当原Rendering闪烁。开始时仅保留三个共享索引的其他改动和既有packages/opencorvus/bun目录。当前HEAD f48d1c69c，383/385结果恢复与最新copySources身份合同均保持。

已重读387 Recall、352长37正文owner实证及其后同目标保留视图决定、363关闭历史阅读锚点、187打开意图、当前TextPart/text-part-model/markdown-render、SideChatPanel、SubagentConversationPanel、side-chat live连接与subagent投影、CardParts、ConversationCard和07-panel。Markdown占位只在pending且无已显示块时出现；相同文本跳过重算，现存组件的追加/结束保留HTML，故不能直接扩容32项缓存或删除占位。

## 具体候选与影响分析

SideChatPanel的当前消息以messageID列表绑定组件，继承参考历史却用For each=history对象数组。projectSubagentConversationLive对未改历史保留对象，所以普通追加不能直接证明重建；但session.connected完整快照经parse产生新包装对象，合法网络重连可能仅因对象地址变化退休并重建同一Message的历史正文。cache命中可掩盖Rendering占位，但DOM身份、原生文字选择和内部交互状态仍可能丢失。该路径是普通Side Chat参考历史，不等于SubagentConversationPanel；原截图中的成员侧栏仍须独立追踪。

服务端每条新Session SSE连接实际读取规范snapshot；前端同一connection重试保留source/session/API authority，新的快照应刷新数据而保留同一消息的展示身份。已有open/fork语义与Disclosure阅读锚点修复不覆盖For的对象身份。拟验证相同session/message IDs的重连，仅历史owner重建而当前消息owner保留。若实际证据支持，使用现有Key primitive按messageID渲染历史并读取其accessor；不缓存第二份transcript、不改Provider/复制/权限/消息/Source/Markdown协议。移除消息、切换真正目标仍按原生命周期卸载；重连中的最新数据仍进入同一组件。

## 真实诊断与验收

before独立NativeService端口18409，after若修复则18411；沿387成熟生命周期，auth/models成对、分别有效凭据/目录/实际gpt-6.1-sol流式验证，每scope同进程20请求、无活动180000ms、Native固定资源上限600000ms。先完成构建再计时，失败不覆盖/续额，所有自有进程/输出/request/端口物理完成后移除pair。

只用真实项目/ui、真实Main与Side Chat输入、复制历史和消息。私有构建在SideMessage/Markdown组件加入只读create/dispose/state日志，保留原渲染与真实值；不改产品配置、不种消息、不自动驱动UI、不新增/运行DOM/组件/快照/浏览器fixture测试。手工展开参考历史、选择实际正文，再产生同目标重连并查看截图/原生选择；日志只辅助归因，不作为UI自动断言。

为了准确限定重连，使用独立本地Node HTTP透明转发器（before18410→18409、after18412→18411），/ui与所有API内容均来自真实项目服务，不替换任何响应/事件/模型。它只记录真实连接身份；主agent一次显式本地控制操作关闭指定Side Session的一条已建立SSE连接，随后让产品原重试重新连接。该辅助层不是Vite或替代前端，不自动点击、不注入事件，不接触用户实例。控制与关闭回执、转发器退出和原Native退出分别保留，不能把代理故障当产品问题。若重连未发生或父组件整体身份也变了，先修验收设计，不能先按候选改产品。

本轮预期纯UI变动，无接口/schema/调度变更；若发现队列/恢复/终态异常则横审全部Task/Mission/Session occurrence、正常终态、重试重启及多项目，不能归为单侧栏偶发。检查全仓同类history调用、对应公开合同，视觉前后复核、正式构建与类型、文档索引、完整脱敏归档、范围提交和fresh fetch/merge/待推送复核/正常push。未验证的原subagent Rendering与386连接错误仍明确保留。

## 修前事实与实施准入

before真实Main读取一份文件、回答正文，侧聊正式复制3条历史并完成自身一轮问答。透明转发连接97只针对side ses_-zUS4DJI3zzQ5n7VSjnx关闭，产品自行建立连接123/HTTP200，主会话连接65保持。生命周期日志记录继承消息三个同ID的SideMessage owner1/2/3全部dispose，再create6/7/8；当前消息owner4/5保持。页面参考历史仍展开，Source仍在，实际传输错误以原Feedback展示。原生文字选择两次未建立（selection text为空），不把它称为选择丢失；暖缓存场景未拍到Rendering占位，因此不宣称原成员侧栏闪烁已复现。

此处已有明确控制流根因：同一个规范快照的消息ID持续，只有新包装对象触发历史For的重建。现有当前消息ID绑定与已完成Markdown缓存不能保护这个不同的列表owner。决定只把历史For替换为已有Key by=messageID，并从其accessor取最新message；不改变参考折叠状态、当前消息、传输重试/错误、数据投影或缓存。以同一ID的数据更新、移除、真正会话切换仍遵循Key的现有语义。共享readonly诊断按现行SourceParts/消息failure的成熟Key用法，未找到另一份历史正文renderer。

before原Native28741实际exit0/8次gpt-6.1-sol200/EOF，转发器19605正常exit0，页面6已关；Target23560/Host83936与端口/复制pair按原成熟流程完成物理收尾。最初诊断插件顺序错误使原TS锚点在Solid处理后不再存在，修正为加载唯一项目配置并将观察插件放在Solid前；原构建失败日志保留。一次观察工具括号错误发生在动作前，修正后才取得重连截图/日志；不计产品故障。

## 修后结果与恢复点

历史For已由已有Key by=messageID替换，accessor传当前消息。after真实流102断开后114/200接续，owner1—5持续到观察结束；Source键盘焦点前后相同，手工回车打开真实文件并高亮第2—3行。before三条同ID历史重建与after保持形成归因证据；不把原生文字选择或原成员Rendering未复现部分编为通过。

after27366及关闭helper87772 exit0，8次Sol200/EOF，Target84944/Host86968在533089ms内正常关闭；proxy42690 exit0/sockets0，页面7关闭，Native完整Job/output/request/端口先收敛再成对清理凭据。before代理终态日志sockets1为close回调观察先后：实际进程19605 exit0，原脚本和日志保留，after改为等待全部自有socket关闭后再记录。没有延长/重开任一原运行。

后台checker核对初始/最终继承消息内容、Sources绑定和真实模型/Native/重连资格；生命周期脚本仅输出描述性时间线，不做UI自动断言。overlay typecheck和正式未观测构建通过（main-QSwgWIyk.js）；正式产物未再开页面，真实截图来自同代码的被动观测构建。完整证据整理、docs:check/check:architecture-index、范围提交及fresh fetch/merge/待推送检查为最后收尾。工作区其他文件和07-panel文件链接合同段落属于其他任务，必须部分暂存本轮段落。
