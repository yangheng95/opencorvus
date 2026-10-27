# 附件在工作区离开时的生命周期

## Recall

用户要求单agent（代理）持续自主体验和修复完整产品，不局限已经解决的Rendering闪烁；完成真实页面/原图人工复核及聚焦正向合同后范围提交、同步上游并正常推送。Goal（目标）保持加号与/goal入口。上一批edb44e71d修复无可用模型时本地附件保存，并增加真实HTTP（超文本传输协议）阶段诊断；当前正常推送hook（钩子）仍在完成。724实际New chat（新对话）截图04证明文字草稿已空，但旧项目附件仍可见；不是猜测或旧事故复述。724原exec72920/native/launcher均0、模型请求0/累计373，源92表246152行/7286关键事实/166原文件保持、schema（数据库结构）9不变，目录副本退役。保留176他人工作，不操作用户18571/窗口/真实数据库，不委托、不建分支/工作树。

## 修改前根因、影响面和方案

已读当前07-panel/上批Recall与真实原图，搜索全部setChatAttachments/chatAttachments/preserveComposerAttachments、clearConversationRuntime、enterEmptyWorkspace、applyDirectory、clearSelectedWorkItem和全部定义/生产调用点。附件现有唯一事实来源是messageStore的一份易失列表，文字草稿另按key持久保存。Task（任务）/Session（会话）/Mission（使命）选择和Connection（连接）离开已显式清空附件；同一项目的模式切换/自动创建会话则有明确preserve合同。工作区服务的共同clearConversationRuntime只清请求、重放、会话投影，遗漏附件。新对话先openGlobalChatLauncher→enterDirectoryFreeWorkspace→enterEmptyWorkspace→clearWorkspaceRuntime→该遗漏清理，再applyComposerIntent通过preserve=true的selectTask，导致原列表继续显示。手动项目切换/关闭项目/不可用项目恢复和空工作区入口共用遗漏，属于相同控制流根因。上一批只修文字记录转移，未覆盖易失附件离开合同；不能把附件塞进新持久格式或另建按项目影子列表来掩盖。

在现有共同clearConversationRuntime调用唯一setChatAttachments([])，把附件纳入已有易失运行状态清理。保留Task/Session/Mission和连接现有清理、防护及原生文件存储。明确导航离开丢弃暂存附件与既有Task/Session行为一致，原文件仍在AttachmentStore（附件库），文字/引用草稿仍原记录。相同项目明确模式切换不走工作区清理，按现合同保持附件。自动全局项目分配发生在各上传operation（操作）收到项目receipt（回执）及写入附件列表之前；同轮并发输入共享一个分配，清理不会吃掉已接受的最终附件。晚到上传已有operation.isCurrent、选择epoch（轮次）和API（应用程序接口）authority（连接权威）检查；不新建epoch/取消器或更改调度、任务终态和恢复协议。当前没有调度/队列异常证据，不把有限场景当横向审计替代。提交回调与会话创建的显式附件交接维持，不扩展到无证据的持久附件草稿功能。

数据与公共契约：仅易失前端生命周期，无服务器路由/模型调用/数据库或持久格式变化；无需迁移/SDK（软件开发工具包）生成。当前UI（用户界面）文字和语言键无变化。初步将服务状态迁移识别为非UI数据合同，尝试运行后发现enterEmptyWorkspace实际经resetConversationProjection→resetWriter→markCardTreeVisibleChanged依赖requestAnimationFrame（动画帧），并非纯数据函数。该尝试因无动画帧失败，原句柄exit 1且物理/输出已结清，不能冒称缺陷重现。已立即删除新用例，不加DOM（文档对象模型）/动画帧fixture（夹具）或运行该类UI自动化；当前真实缺陷证据仍为724原图。此次纯UI生命周期变更用真实页面/原图验收。

725/38230从已关闭724整库只读备份，普通Node构建，不注入界面/响应；无auth（认证）复制、完整模型目录复制，模型上限0/累计373。先核对92表原行、旧Task全终态和定时定义paused（暂停），再实测文件选择→新对话空输入；另一项目选择/关闭与同项目模式切换保留；原图人工查看，继续观测已增加的HTTP日志。原生目录选择浏览器受限不冒称。每scope（范围）10分钟关闭目标/原生20分钟边界/至少5分钟结清，公开shutdown（关闭）200、原exec/native/launcher0/物理输出请求结清，退休目录副本并复核全部旧数据/原文件。三索引/当前架构/文档检查同步，全部本任务改动独立提交并正常push（推送），不绕hook。

## 实施与实际验收

唯一生产差异是在工作区共同运行状态清理内调用原setChatAttachments([])，原文件、文字草稿及显式模式/会话交接保持。前端类型检查0、普通Node构建main-B4zmaP-p.js通过。725真实页面共12张原图均已人工查看：01全局分配后的原件/草稿，02同项目Work→Code保留原件，03新对话为完整空输入，04返回A原文字草稿，05A重新选择原件成功，06/07跨项目清理（06有项目tooltip遮挡，07实际点击输入框关闭tooltip补足），08第二独立新项目B实际保存原件，09菜单File→Close真实关闭项目后空输入，10中文浅色空工作区，11重新打开B（tooltip遮挡，不能单独证明文字可见），12真实刷新后中文浅色B草稿完整可见、暂存附件已清理。File菜单的Close代码真实映射closeCurrentProject→closeProject，未关闭用户窗口。快速搜索close project无候选，因此用真实菜单验收；不宣称该搜索命令存在。

真实HTTP再次核对两新Project的原件metadata（元数据）原名、物理文件143字节及规范GET 200原字节完全相等；清理只作用暂存列表，durable（持久）原件保持。没有执行模型、创建Task/Mission/Goal。实际浏览器诊断总计4个主动取消、fetch阶段DOMException；没有复现非取消Failed to fetch，旧719/720根因仍未知，不作为本修复的完成声明。原生目录选择、真实认证模型执行不在本批声明中；此前已授权真实Sol验收事实保持，不伪称本批重新调用。

725公开shutdown 200，原exec93720/native/launcher全部0，物理/输出/请求全结清；剩811066ms。配对目录副本退役，源认证元数据和模型目录原字节/元数据保持。源与目标92表全部246158原行、7286关键事实及166原文件逐一保持，schema 9、integrity ok。前一批edb44e71d正常推送成功、再次fetch/merge后main/upstream（上游）0/0；本批继续范围提交，持续Goal保持active，单agent继续。

文档检查351操作/26组通过，架构索引20篇当前文档链接均有效。没有版本更新/发布、API schema变化或数据库迁移。
