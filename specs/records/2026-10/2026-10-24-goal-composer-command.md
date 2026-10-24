# 持续目标的输入命令

## Recall

575继续单agent，不委托；用户禁止子agent覆盖旧Goal中的三Astra。574为progress：11f382bfe已正常push main/fresh0/0；真实15次gpt-6.1-sol流式200/原reader EOF，原B两来源自然完成、17旧正文owner/块数保持、未复现Rendering，7人工实图。完整源90表197241原行/schema5保持，目标原转录保持，7项有意控制/派生记忆更新明确列出；memory回idle23、旧24覆盖精确保留，新覆盖29；原exec/native/launcher/物理/输出/请求闭合，auth/models退休，18571未操作。开始171无关删除、.bun/和packages/opencorvus/bun/未跟踪、无暂存。

用户原要求“完全看不到goal怎么用的，而且默认页布局很怪”；已重读后续原话记录“这个goal要像codex一样命令启动或者塞进+中，放到UI上等于是脱裤子放屁”。因此574仅凭默认首页不可见而拟定恢复Goal区的下一步证据不足，本批调查历史后纠正，不恢复首页卡片/常驻创建条。当前已选择的加号菜单正确；本批补充命令式启动及其发现提示，保持首页真实composer/普通starter布局。

## 修改前根因、影响与搜索

已读574/573 Recall、goal-composer-menu与home-launcher-scope原决策、当前continuous-goal和07-panel相关架构。全仓搜索onGoal/onStartGoal/GoalFormRequest/launchOwner、所有ChatComposer/SideChat输入与目标挂载、/side/command定义调用、菜单、本地化、帮助、表单草稿/选择/API authority生命周期、现存纯服务测试。检索到Goal service/refresh测试均为非DOM合同，没有运行或新增UI自动化。当前07-panel仍描述已经删除的首页独立Goal区，与当前实现和原决定不符，必须更新唯一事实来源。

可观察触发：在主输入/SideChat输入`/goal`或`/goal 目标`并发送。当前主输入只在无引用/附件且有onSideChat时用精确`/side`语法处理本地动作；`/goal`落入普通LLM消息路径，SideChat也无此命令。既有加号→onGoal→唯一表单→显式确认→原Goal API链路完整。旧改动选择了用户接受的加号入口，没有实现输入命令，因此这是一项新增入口能力，不把加号本身藏在菜单判为bug。

方案使用一个纯输入命令解析器识别完整`/goal`与既有`/side`语法，普通文本和近似名称仍返回明确message结果。主输入删除内联/side正则并消费同一解析结果，SideChat使用同一解析器的goal动作。`/goal`将其后目标文本写入原composer draft后，仅调用现有打开请求；普通消息、/side的既有上下文限制、引用/附件保留和Goal确认权限不变。无新Goal store、API、执行调度、模型工具路由或持久格式；所有LLM交互仍流式。命令是明确的人类UI动作，不伪造会话Message，也不教LLM流程。所有owner/选择/权限检查继续属于原表单和提交链。

菜单显示技术命令/goal，帮助说明命令和加号两种打开方式；主/Side提交控件名称应说明打开目标而非发送消息，语言覆盖英文/中文。新增代码风险包括空目标、附加目标跨行、命令边界、缺模型时打开表单、引用附件保留、已有Goal应打开详情、选择或API变更、输入法/键盘发送、Side独立草稿。只用成熟Button/原菜单/原Dialog，修复过期架构描述。没有观察到调度/队列/唤醒/恢复/并发/终态异常；一旦出现立即横审全Task/Mission/Session轮次/入口/恢复/串并行/多项目。

## 实施与验收方案

实页修正（同一scope，未启动Goal前）：英文输入多行命令并Enter已正确预填/取消保留，canonical计数未变、模型仍2次预检。无参数`/goal`通过按钮打开后关闭，真实辅助树焦点落到AXWebArea0。直接触发为指令消费后Send按钮禁用，Dialog原焦点归还目标因此无效。修复仅在明确Goal命令消费后、请求打开前把焦点交给同一输入框；沿用原Dialog焦点归还，不新增焦点状态/恢复器。Main/Side共享风险同时覆盖。重新正式构建到独立ui-focus产物后发布同一自有静态目录并刷新自有页面，原native/预算/deadline不变，不能以旧publication代替最终验收。

该同scope发布计划已被真实HTTP否定：新静态文件复制后，运行中服务仍返回启动时旧index入口，publish-focus正向身份检查失败，未刷新或把旧页当最终代码。服务的静态UI解析按启动时资源缓存呈现，保留该一致性实现。改为原服务正常shutdown/join/物理结算后退休凭据目录，再复制完整闭合数据启动独立verified scope，采用已经实际完成的最终Node构建。旧scope实际2次预检均EOF、Goal尚未创建、退出0、shutdown预留753875毫秒；新scope模型上限14，本批仍最多16，独立固定20分钟和至少五分钟收尾，不因观察超时延长或重启同scope。

先补纯解析器正向状态测试（精确动作、参数、多行、普通文本输出），再接入两个真实输入与现有菜单/帮助。UI不新增/运行自动化测试；以正式Node构建、自有原生开发CLI `/ui`、手动中英文交互和逐张截图复核为准。覆盖全局首页命令/菜单、目标预填、帮助/关闭、草稿保留、已有会话及Side命令。首页布局按历史要求保持单composer和普通starter。

以完全闭合574全90表和原附件复制新隔离scope，schema5保持。完整OpenAI认证和models成对复制，启动实际Goal前验证usable/projected/actual gpt-6.1-sol。固定20分钟原生边界、180秒启动无活动、至少五分钟收尾，最多16次实际Provider请求，不重启同scope或扩预算。实际确认一个有限Goal：最多2自动轮次，只有当前会话输出标记并自然用原目标工具完成，不访问网络/文件、不委派、不创建Task；不把表单打开当执行验收。真实原reader未EOF须如实保留状态，不能以取消冒充。

完整源行/字段/时间/schema对象/canonical/源bytesmtime和原资产保持；真实继续执行的目标控制/记忆/会话元数据更新单列，原Message/Part事实精确保留。正常shutdown、join原exec/native/launcher/物理输出请求/出生链后清退复制auth/models。聚焦测试、类型、语言、构建、文档检查和手动实图完成后，更新三索引/目录README、范围commit、fetch/merge上游/全待推集合/正常push/fresh一致，整体Goal继续active。

## 最终结果

已实现Main/SideChat同一纯命令语法，删除Main原内联/side正则；显式`/goal`加可选多行目标只打开同一现有表单，后续目标进入原draft、引用附件保留原权限，普通及近似文本保持message路径。菜单显示/goal，英文/中文动作名称与帮助一致；07-panel旧首页Goal区描述已改为当前命令/加号契约，不恢复独立卡片。空指令通过按钮消费后先聚焦原输入，再请求Dialog，修复取消落到页面根部；最终Main139与Side204均真实回焦。

聚焦纯解析器4pass/10expect，Overlay类型通过，语言检查2语言2536键、CSS设计变量检查通过。Node初始构建53.73秒、最终51.05秒；副本SQLite文件大小mtime保持。最终实际交付main-CPAfMIiv.js。共15张人工实图，前5为中间构建，后10为最终构建；没有新增或运行UI自动化测试。详见[实图与证据](../../artifacts/2026-10-24-goal-composer-command/README.md)。

初始scope的多行命令打开前后实际Session264/Message757/Part1841/Task21/Goal created17和Provider2均相同。最终明确选择Sol，通过中文命令预填/帮助/加号重开保留表单，显式设置turnBudget2后才确认。真实新Chat Goal pev_g0VYwcdDv00y7AnAwAiW，原controller输入和原assistant完整GOAL575READY可见，经本次许可让原update_continuous_goal自然complete；公共API与SQLite创建/更新事实及assistant Part精确一致，实际turnsAccepted1。Side命令预填SIDE575草稿、归属侧聊1，取消保留并清理；Side未确认新Goal，created总数仍18。非UI checker仅承认真实assistant角色的独立标记，不匹配目标或controller提示中的字符串。

两个独立native scope原exec63280/74833均join0，native/launcher0，shutdown200预留753875/372880毫秒，物理/输出/请求及出生链完整。初始2、最终5次Provider请求，合计7/16，均实际gpt-6.1-sol流式200/原reader EOF；最终两预检属其原Session，三work请求均属原测试Goal会话，Side没有额外模型请求。两套auth/models副本退休，源auth元数据及模型原件保持。完整源90表201153/201588行、schema5、canonical/源bytesmtime保持；目标原转录/Source精确，两个scope均仅两条容量租约槽有意更新。原PNG200/643字节与不可变原件相同。没有新Task、模型委派或开发子agent，18571未操作。

未重新验收输入法、带附件/引用、执行中的Side发送和旧/side完整网页链路，不扩大为全场景通过。旧静态发布身份检查失败及私有PowerShell引号失败均保留，最终以独立服务真实新构建资格为准。Rendering根因仍未确定，整体Goal保持active；提交推送以实际Git结果为准。
