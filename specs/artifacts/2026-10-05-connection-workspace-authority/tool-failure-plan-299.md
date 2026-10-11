# 299 工具失败摘要

## Recall

用户要求持续单agent体验、修复Sources及界面问题。上一轮298是有效进展：363e5c727已推送且本轮开始工作区干净，实际Task三来源与2921字符正文完成；原Rendering闪烁仍未知，不能标成根治。本轮只有root，不启动协作agent，也不发起新的产品研究或Provider请求。

298截图03/05显示失败网页行为“webfetch markdown 1 failed”，用户必须展开才能知道404。真实持久化request Part prt_g0VXk6C2P00wpmEKc1Ri的输入包含url、format、timeout，outcome为failed，failure.message为“Request failed with status code: 404”。这是现有真实任务数据，不使用界面夹具或伪消息。

## 根因与影响分析

已读当前07-panel工具错误和来源契约、utils/tool.ts、InlineToolPart、CardParts、services/dialog、card-tree与card-tree-stats、transport-protocol的ToolFailureCause和renderToolFailureCause。全仓检索toolFailurePresentation只在InlineToolPart局部定义；工具摘要共享displayToolDetail则只读state.error，未消费当前结构化state.failure。结构化failure正文已有正确投影，而摘要落到通用Object.values(input)，归一化后的format成为首字符串，因而显示markdown。旧路径仅修展开正文，未把同一失败契约传播到公共摘要。

影响面是Main、Side、子侧栏的折叠执行行、展开工具头、活动摘要及会话工具chip。成功/运行/待接收参数继续使用当前工具身份和参数描述。没有接口、持久化数据、Provider调用、调度/恢复/队列、终态或版本变更；不启动共享调度修复。风险是失败摘要压缩后遮掉参数身份，因此完整输入及Details原有入口必须保留，实际截图复核其可读性。

## 实施

将现有toolPayloadText与toolFailurePresentation原样集中到现有utils/tool.ts，InlineToolPart引用同一个实现；displayToolDetail在参数和结果摘要之前使用同一真实失败message。完整结构化诊断仍由共享transport renderer生成，错误正文保留Markdown链接，未知结构仍保留完整序列化信息。不按webfetch名称打补丁，不增加状态源或兼容协议，不改写错误事实。同步当前07-panel契约。

## 验收与交付

纯UI（User Interface，用户界面）呈现改动，不新增或运行UI自动化测试。用298已完成真实Task做完整历史隔离：先精确复核原进程出生身份/原exec 98045实际join/端口/成对清理、当前schema、全Project恢复候选与权限/记忆/配置，再完整复制原历史，保持原Task/Session/来源/错误身份。启动现有开发serve的/ui，不使用独立Vite，不改用户服务。先完成正常build再启动；原生固定900000ms期限不续期。人工展开成员，检查失败摘要、错误正文、Details和输入URL，并截图复核旁边成功Sources。

完成后关闭自己的页面并经sole shutdown、原exec实际join及独立物理闭合，复核原始/复制历史的完整只读保管。类型、构建、文档检查通过后提交、fetch/merge、审核全部待推送提交并正常push。证据不足则保留具体边界；持续goal保持active。

## 实际交付

共享toolFailurePresentation与toolPayloadText已从InlineToolPart移至utils/tool，摘要优先读取同一失败message；undefined直接返回空message，避免对正常工具重复解析缺失字段。旧局部函数与旧摘要错误分支同步删除。没有更改失败原因、工具调用或来源事实。

真实18259/ui从完整90表复制打开原298 Task。main-Ck1XRYJ6.js正常构建产物中，成员预览和子侧栏折叠行均显示“Request failed with status code: 404”；成功Sources标题/域名保留。鼠标展开读取真实URL/format/timeout，Details完整展示原call ID和classification/origin；键盘Enter折叠再展开保持输入展示。默认窄侧栏正常截断长行，正文完整可读；键盘调整宽度后行内404可见。实际W3C来源打开同篇.html官方页。11张人工截图保留过程，其中04是滚动落在独立输入区、07是拖拽起点落在一像素分隔条外，均未改变外层；不是产品失败修复证据。09/10是明确的完整摘要与展开验收。

原权限检查器错误地要求execution_failed存在permission_execution_result。已按authority.ts的执行契约修正本轮检查器：成功结果由completeExecution存储，异常由appendEffectOutcome记录execution_failed后重新抛出，原失败无需成功payload；真实9次执行中8成功结果和1失败终态均已闭合，8条assistant完成，两个检查点完整，所有恢复候选/发布交付均闭合，两Project记忆idle。此处是检查器契约错误，没有发现生产队列或终态异常。

结束保管检查发现原项目.git目录和.git/index仅文件时间刷新。保留最初失败和精确差异；当前Vcs.status执行git status可刷新索引。经真实只读git命令确认四个stage-0路径、模式、blob身份与原Task result检查点的不可变Git tree逐项相同，HEAD仍为f45c87ed，工作文件clean；因此仅对这一已核实Git元数据刷新进行专门审阅，不放宽其他文件检查，不回改时间。最终19张消息/工具/Provider/Task/产物/记忆等事实表及30条完整执行生命周期逐行相同，原/复制配置字节相同。原生48512、Host59472及exec5991真实exit0，端口和授权副本检查完成；自己的54/55标签已关，用户服务未操作。

最终overlay类型检查与正常build（51.79s）实际exit0；未新增或运行UI自动化。原Rendering问题及298初载owner替换继续待查，本轮不对此宣称修复。
