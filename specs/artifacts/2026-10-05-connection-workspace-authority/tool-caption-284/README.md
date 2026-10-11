# 284 延迟工具标题保持真实目标

[实施前Recall](../tool-caption-plan-284.md)。本轮持续单agent，开始edfb119d6已推送且工作区干净，没有新Task、成员或委托。

## 根因与修改

[283真实前态](../source-provenance-283/live-01/01-sources.png)第三条工具只有webfetch · markdown。只读原SQLite的真实三个title分别99、108、602 JSON UTF-8字节，均有完整URL及完成的38308字节输出。共享transport对大结果延迟投影时直接清空超过256字节的title；前端stableClone排序后通用摘要选择format，导致呈现格式名。Source数据没有丢失，模型也没有遗漏网址。

[原数据投影前](transport-before.json)与[同一原数据投影后](transport-after.json)使用生产projectConversationTransportPart，保留输入/原标题/字节。它们从实际请求、结果行和已归档完整输出重建投影输入，仅为后端诊断，没有写库、伪造运行消息或运行UI断言。602字节标题从空串变成256字节原前缀加省略号，两个短标题原样保持。

修复位于唯一conversation/transport.ts，维持原256字节政策。Unicode码点逐个计入JSON引号、转义及省略号预算，完整短标题直接返回；不拆代理对，不承诺字素簇完整。原状态标题、结果、输入及完整性标记仍由原事实拥有。Session/Task历史、分页和live updated/moved通过同一函数获得修复，无工具名特判、第二缓存或额外协议字段。

## 聚焦后端验收

当前官方test运行器仅执行conversation-transport-projection.test.ts：13 pass、36 expect，actual exit0；这是纯序列化和传输状态契约，未加载DOM或组件，不是UI测试。覆盖原大小状态/事件/输入保留，以及ASCII精确边界、截断前缀、中文、emoji、引号、换行和混合宽度边界，确认原title完整且投影仍在4KiB。

第一次12 pass/1 fail是手写旧用例新期望把large-title误数成10个字符；实际为11，导致期望超预算。保留[首次失败](transport-tests-first.log)，将明确期望改为22次完整串再large-tit和省略号，原运行器重跑通过，没有改算法迎合错误期望。后端typecheck41073 actual0。当前07-panel契约、docs:check345ops/25groups与architecture-index18文档通过。

## 真实页面验收

新正常dev/ui18231，前端仍是main-BfOrDdlz.js，本轮没有前端修改或单独Vite开发服务器。[当前三工具行](live-01/01-tool-titles.png)由Root人工查看，第三条已显示实际抓取网址前缀，仍保留三条Sources。

点击第三工具，[真实输出展开](live-01/02-expanded.png)显示原网页结果。Input区域沿用既有默认折叠契约；切Raw只切格式，[03截图](live-01/03-raw-input.png)不会自行展开，不能误报输入丢失。显式点击Input的Expand后，[完整原网址和参数](live-01/04-full-input.png)可读。真实服务日志记录该原Part GET在04:43:56.115Z开始、.118Z返回HTTP200，未从摘要构造全文。最后[收起工具](live-01/05-collapsed.png)，抓取目标仍存在；鼠标位于另一来源时的原Tooltip也如实保留。

这些结论来自真实交互和截图人工复核。AX与DOM文字只作为原始旁证，无自动UI断言、快照、像素比较或固定截图测试。完整工具标题在canonical状态保留，当前工具行仍显示有界标题；没有宣称整串工具标题在行内全部可见。

## Provider与完整收尾

授权auth+完整models成对；预检credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true，固定NativeService600000ms/12累计请求。新真实请求产生3次completed webfetch和3个完整来源，7个Provider reader EOF、0取消，[后端事实](actual-source-facts-01.json)核对全部实际URL与原request.txt相等。模型此次timeout参数120属于实际输入，未改写成此前60。

自己的21页关闭后唯一shutdown actual0，原前台95628实际join exit0。Native71676/出生639272905718138833、Host65520/出生639272905710770784，独立closure核对精确出生、物理退出/输出/请求终态、18231释放与auth/models退休；物理完成时余449520ms，满足提前四分钟目标。归档4929行实际新日志，未知时间行0。全部原观察器和checker结束后，5个自产物才按精确出生和限定路径保管。

公开文本仅清理行尾空白，私有原文保留；图片/JSON原样。原ResearchStudio子侧栏全帧Rendering、旧schema、其他未采样工具与多端没有由本轮替代。范围提交与正常推送后继续单agent，goal active。
