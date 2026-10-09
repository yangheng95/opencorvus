# 216 延迟工具正文错误归属

## Recall

用户要求持续自主改进体验、功能和 Sources，最新要求只使用单 agent。本轮从已推送91337dc0、干净工作区继续。215原失败与截图保持：工具正文实际 GET 返回400 ProviderModelNotFoundError/openai/gpt-6.1-sol，整张7605字符消息被262字符渲染错误卡替代，两组 Sources 消失。21501原生期限退出1、21502独立正常0分别保留，不重启旧scope或改变原终态。

验收是当前真实页面展开该工具，真实HTTP失败由该工具正文显示，原消息正文、Sources、相邻工具、展开/关闭与键盘阅读仍可用；截图由负责修改的单agent实际查看。类型、构建只是局部检查。不得新增/运行UI（User Interface，用户界面）自动化测试。真实模型与Side Chat另需完整auth/models目录配对、实际目标模型投影与流式请求，不能将本轮无目录的历史回放误称用户凭据未配置或成功读取正文。

## 修改前深度与影响

已读InlineToolPart完整资源、缓存、投影、渲染链，Card/CardParts两个消费者，Conversation整卡ErrorBoundary，FilePart资源错误展示，session.messagePart真实路由与project-route-context、transport协议、现行07-panel合同、215 Recall/原请求和截图。全仓搜索readDeferredToolPart/persistedPart/conversationDeferredToolState/InlineToolPart：唯一工具正文读取器，缓存键绑定authority、原目录、Session/Message/Part ID及不可变state digest；错误拒绝时删除相同缓存请求，下一次展开会真实重读。触及路径未发现UI自动化测试。相关非UI测试只是同名持久化变量，与本次UI错误归属无关，不运行。

直接触发为完成后的大工具状态延迟读取拒绝。part()只检查loading，失败时loading=false，于是调用persistedPart()；实际安装Solid1.9.14 read()在error非undefined且无pending promise时throw。display及结果createMemo先调用part()，异常到整卡边界，已有persistedPart.error局部展示没有机会保留消息。旧路径虽有bodyReady错误保护，却没有保护共同part accessor，故未根治。官方createResource资料 https://docs.solidjs.com/reference/basic-reactivity/create-resource 与安装真实源码共同支持错误状态分析。

本轮最小修复在共同part()读取前同时检查resource.error；错误仍用现有工具正文错误块完整显示，并加原生role=alert。props.part始终是当前同身份的会话投影，用于工具身份/执行状态；不得把它冒充已读取的完整正文、使用resource.latest旧值、吞掉原拒绝、放宽身份/字节/digest校验或引入第二读取器。bodyReady覆盖全部正文、结构化结果与执行错误内容，明确只允许已成功的完整资源进入正文。工具执行completed/error和读取失败分离，缓存/API/公开类型/路由及模型配置均不改变，Main/child/Card共用唯一组件。实际transport投影保留bounded input/title/metadata、status/time和deferred marker，output为空；若仅保护accessor，结果memo仍可能将有界投影当成完整结构化结果，因此必须同步扩大已有bodyReady范围。完整正文成功、Inline/block和其他平台尚未知。

原400来源是本轮无模型目录历史回放的runtime bootstrap，而会话读取identity入口已成功；后端路由能力选择另有公开契约与正向测试影响，不能为本次UI局部错误处理增加绕路。本轮不改后端，不将局部错误显示称完整功能达成。无调度/队列/恢复异常，原固定预算到期记录属于已知scope资格失败而非新的共享异常。

## 实施与真实验收

第一次当前真实展开已观察7944字符同canonical card、全部六章节与两组Sources保留，工具原生BUTTON焦点稳定，局部role=alert完整HTTP400可读。原始截图local-tool-error.jpg同时暴露长API路径直接占满错误区的阅读问题。已全仓查Feedback成熟组件、原生Disclosure、两语言tool字典与样式；继续使用该唯一Feedback primitive，明确“无法加载工具结果”及关闭重开可再次加载，完整原错误放原生Details。缓存实际失败删除、展开body卸载和重开createResource支持该动作，不添加请求兜底、自动重试、模型配置判断或状态影子。新增两语言文案随现有i18n检查，浅色真实局部提示/Details/关闭重开和Sources重新截图复核后交付。

先按当前生产schema/config/Task/dispatch/publication/delivery/provider/tool分类器只读重验完整已正常闭合213来源，两原项目配置/文件/恢复前沿安全才准入。fresh216完整复制runtime，90表逐实际完整行比较，保留原canonical身份与project目录，独立18137/ui、新自己页面，不动用户23。沿Session专用唯一copy/Native launcher和public shutdown，15分钟固定预算不延期，无新模型请求或凭据移交。准备/类型/构建在启动前完成；基线215真实失败已留存。修改后真实Source和Tool展开、局部错误阅读、关闭重开重读/相邻Source/正文截图，尽早关闭自己页面并公共停止；核对原父工具0、Native实际exited0及physical/output/request、独立OS（Operating System，操作系统）出生身份/端口/目录pair闭合。失败据实保留。

更新spec三索引与现行架构说明、docs检查；只提交本轮文件，fetch/merge upstream、核对待推送完整提交集合、正常push，不绕hook。持续单agent目标active，完整配对功能和其他未验矩阵继续。

## 本轮结果

最终清晰Feedback/main-Bmeb8tJo、浅深色/原生Details与相邻Sources/关闭重开真实GET均已截图人工复核。原7605字符消息保留全部六章节，单工具提示8064/Source展开8104、双工具提示8563；失败不是读取成功。中文切换PATCH/config400，保存原失败和scope catalog缺失限制，未绕过UI强行改locale。原父68572=0，Native00:30:55.436Z exited0及全physical/output/request，独立身份/端口/pair闭合，原源六表完整行相等；详细证据与剩余矩阵见本轮README。所有真实页面仅自己32，用户23保留。第一次FFI单文件UTC界限校验拒绝且零移动，显式UTC界限核对后处理。当前目标active。
