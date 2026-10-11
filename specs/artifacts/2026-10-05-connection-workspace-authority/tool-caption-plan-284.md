# 284 延迟加载工具的长标题

## Recall

用户要求持续自主改进Sources、Rendering与功能；最新只用单agent，旧goal的多agent措辞不生效。本轮仅root。283是实际进展：edfb119d6已推送、工作区干净，来源域名在长章节前可见。原截图和新283真实页面都保留第三行webfetch · markdown，而相邻两行显示原抓取地址；本轮追查此处身份丢失。原子侧栏Rendering、原ResearchStudio旧schema与未采样矩阵继续未验，不能用本轮工具摘要替代。

已读AGENTS、283 Recall、当前07-panel、conversation/transport.ts全部投影路径、transport-protocol的4KiB上限和延迟标记、overlay tool.ts的stableClone/展示路径、webfetch title生成和聚焦后端transport测试。沿用已应用benchmark-debug-template技能；禁止UI自动化的用户约束优先。全仓搜索投影定义、全部调用、同义截断、历史与测试；没有委托。

## 现象、根因与影响

283真实归档/只读原SQLite显示三个webfetch均有完整input.url和完成结果。原title序列的JSON（JavaScript Object Notation，JavaScript对象表示法）UTF-8（Unicode Transformation Format 8-bit，八位Unicode转换格式）字节数分别99、108、602；第三个不是模型遗漏目标。所有output为38308字节，均进入大于4KiB状态的延迟投影。transport把title超过256字节整段替换为空，input仍可用；overlay stableClone按key排序，再由通用detail遍历参数，format排在url前，故显示markdown。此前Source身份/Tooltip修复不涉及Tool状态投影，不能根治工具行。

影响是所有具有长title的大完成工具状态，包括Main/Side/子会话；不只是webfetch。Session tail/older-history/connection route、Task/root/child transcript/page和两类SSE（Server-Sent Events，服务器发送事件）的updated/moved均使用同一projectConversationTransportPart。运行态和小状态直接返回原Part；错误/取消契约、持久原state、完整Tool GET、原状态完整性摘要与字节数均保持。该摘要用于实际不可变状态读取校验，不是无效源码哈希门槛。无调度/队列/恢复/并发异常，本轮不改其机制。

已有Locale.truncate按UTF-16长度、compactAgentText还会改写空白，均不满足现有JSON字节上限；不复用不匹配的函数或另加UI工具名特判。唯一transport私有标题投影在原256字节政策内保留原标题前缀和省略号；逐Unicode码点预算包括JSON引号和转义，完整短标题原样返回。不会把截断标题当URL激活目标，也不会修改canonical字段、参数或结果。参考[MDN字符串迭代器](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Symbol.iterator)与[JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)，不拆代理对、真实转义成本计入预算；不承诺字素簇边界。上限继续归现有transport owner，无新协议字段、额外存储、fallback或提升载荷上限。

## 实施与验收

先写方案再改现有transport私有逻辑和07-panel公开契约。后端conversation-transport-projection.test.ts是纯序列化契约，非UI渲染测试；更新长标题清空旧期望，增加ASCII、中文、emoji、引号/换行转义和边界正向明确输出，证明状态仍在4KiB内，短标题/原始数据保持。聚焦运行当前script/run-tests.ts该文件和后端typecheck，不运行全量或UI测试。

保留283截图作为真实前态；读取其原SQLite事实，经当前生产投影保存修复前后标题/输入/字节旁证，不修改原库。再启动新R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/tool-caption-284-live-01，E=tool-caption-284/live-01，正常dev/ui18231。沿用当前前端main-BfOrDdlz.js（本轮无前端改动），NativeService固定600000ms/12累计请求，授权auth+完整models成对，预检usable/projected/实际gpt-6.1-sol streaming。通过真实界面提交相同三个网址，不创建Task、成员或委托。

Root查看三工具行，第三个长标题显示抓取网址前缀；展开第三工具，实际完整结果/标题通过当前canonical读取可见，收起仍有可辨目标，Sources和链接保持。截图人工复核，不写DOM/组件/源码文案/截图断言。完整实际后端事实确认原URL、3fetch结果与真实流完成。若展开异常则先调查真实HTTP契约，不通过猜测UI补丁遮蔽。

关闭自有页面、唯一shutdown并join原前台；独立核对出生/物理输出请求/端口/auth-models退休后，所有checker结束再保管5个自产物，目标提前四分钟收尾。不触碰用户进程，观察过时不重启或延长。更新根/月/相关索引，当前docs/architecture/凭据检查，范围commit、fetch/merge上游、完整待推送集合审查和正常push；goal保持active。

## 当前实际结果

唯一transport已改，原283三条实际数据重投影602→256字节标题，两个短标题原样。后端13 pass/36断言、typecheck41073 actual0；首次手写重复串字数误差已在原日志保留并按真实字符计数修正。当前真实UI三工具目标、原Part GET HTTP200、完整网址参数/结果展开及收起通过Root截图；Input本就默认折叠，不把未按Expand时的空白当故障。

唯一服务原95628 actual0，7EOF/3completed fetch/3URL，独立收尾余449520ms，自己21页关闭、凭据对退休与五自产物保管完成。完整结果见[tool-caption-284/README.md](tool-caption-284/README.md)。本轮无前端源码修改，使用已验证main-BfOrDdlz.js。原子侧栏Rendering及未采样矩阵继续保留，待范围提交与正常push后下一轮。
