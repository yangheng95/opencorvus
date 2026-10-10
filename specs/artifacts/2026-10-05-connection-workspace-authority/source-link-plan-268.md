# 268 Windows 绝对文件引用体验

## Recall

持续自主迭代 Sources 与产品体验，最新只用单 agent 优先；只 root、不委托/新成员/Task，不新 branch/worktree，不碰用户23/18107。上一轮有进展：266裸文件名误动作已修并push 8bd85908c9d45b17b415c05efb63f89e16440c56；267新真实Sol三种明确相对引用/第1行和整文件Source人工通过，5EOF/原前台Native0、pair完整退休、README全文与属性相等。e3ce566335d254020dc6733a424792397dbad137已push main、工作区干净。持续goal active，旧goal的多agent文本不覆盖最新单agent指令。

已读267 Recall、唯一markdown codespan/link实现、file-reference语法/属性、main真实click委托、workspace absolute/editor/workbench入口、SourceParts和Source workbench契约、07-panel与成熟Sol launch/归档/关闭。全仓搜索extractFileReference/codespan/data-file-path和同义路径入口；parser正确保留Windows drive与位置，作者Markdown已经识别绝对drive，但codespan合法字符集合拒绝冒号。test/file-reference.test.ts是纯数据正向解析，当前不新增/改/运行任何UI自动化；相关parser不改，不用其测试当视觉验收。

## 当前可观察候选与影响

候选：模型正文代码格式的D:/.../read.ts:27或D:\...\read.ts:27不会产生可打开引用，而真实Source与作者Markdown可打开同一路径。尚未取得本轮真实截图或点击，不能先宣称缺陷/通过。当前parseFileReference分离末尾合法位置、保留盘符；extractFileReference字符guard只允许字词/路径分隔符，pathPart盘符的冒号被拒。旧266修正basename动作条件而未改合法path语法，267只验相对路径，所以没覆盖该候选。

shared renderer用于inline/full/worker/现有artifact；main属性委托与workbench已经支持实际绝对路径，Web没有外部IDE能力时Source editor按原authority/资源范围打开。此次若确认，只修明确drive-rooted路径语法，不加Source按名猜路径、另一renderer/配置、fallback、LLM host gate或大范围冒号通行。basename语义继续266当前契约，显式Markdown/结构化Source保持自身真实目标。

[Microsoft Windows路径格式](https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats)明确盘符+冒号+根分隔符表达绝对路径，drive-relative形式有不同含义。决策以当前实际parser/workspace契约和本人页面为依据；只接受现已支持的明确drive-rooted语法，不把网络/设备路径、Unicode/空格、其他平台/外部IDE或盘符相对路径未验作扩大完成。

## 当前实际方案

R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/source-link-268-live-01，E=source-link-268/live-01，开发/ui18206、自己的后台IAB（In-App Browser，应用内浏览器）页。新普通builtin Base，不创建Task/委托；授权完整auth/models配对与真实gpt-6.1-sol，启动前分别验证credential usable/catalog projected/实际model/streaming true，不暴露秘密。

实际现有公开源码D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/read.ts；启动前核对全文/分页与mtime，模型自然read offset27/limit11，只简短解释citedReadRange并在正文给出forward-slash和backslash绝对代码引用:27，加作者Markdown指向同一forward-slash路径:27，普通read.ts代码名作对照。不注入会话/Source、不修改目标代码或读取auth/models。先本人查看旧正文/Source/显式链接，确认Web能力后打开已承诺的真实目标；若有错误，补全实际触发/控制数据流、旧路径原因、定义调用/契约/测试/文档/交付与风险后才实施，再真实构建刷新自己的页面、重截图复核两种路径与Source。

成熟NativeService固定600000毫秒/12累计真实Provider请求，含预检/title/memory，原前台/sole shutdown/独立物理输出请求/精确PID（Process Identifier，进程标识）出生端口pair退休/完整脱敏归档/自己5产物保管预先准备。目标启动后7分钟内关闭并立即唯一shutdown，至少3分钟缓冲；不延长、不因observer超时重启。出现调度/恢复/并发/终态问题即全入口/轮次/正常终态/重试重启/串并/多项目横审，不能因普通会话降级。

UI（User Interface，用户界面）只靠实际页面交互/本人截图；types/build不能替代视觉，禁止自动DOM（Document Object Model，文档对象模型）/组件/快照/截图基线/源码文案断言。原瞬态和失败保留，模型自然文本/工具成功输出/Source完整归档，目标全文与属性保管；原前台actual join和所有checker/观察器真正完成之后精确移动自己5产物。当前spec根/月/相关README同步、docs/architecture与必要编译、范围commit、fetch/merge upstream、完整待推送提交审查和普通push；宽矩阵未验明确保留，继续goal active。

## 当前实际问题与实施前方案

Native40376/出生win32:639272044994309912、Host70932/出生win32:639272044985950293，原前台20705，固定deadline04:58:18.580Z/600000毫秒/12请求不变。当前credential usable/catalog projected/实际gpt-6.1-sol/streaming true分别通过。模型9秒自然read目标27/11成功，实际11/262行；01当前两个绝对代码引用都是普通灰code。02只读metadata显示完整模型代码path文字无anchor、显式作者Markdown带data-project-file-path原绝对path/line27；真实Web native marker undefined，不触发用户外部IDE。

03/04本人点击既有作者Markdown，实际只读源码第27行正确band；05同一真实Source完整27–37 band，内容与目标9354bytes/262行对应。排除了文件内容API、Source数据、位置解析/主委托和reveal路径错误，症状是renderer未产生明确Windows代码路径的可执行引用。全仓同义搜索只有当前extractFileReference合法token guard遗漏drive冒号；旧basename修复与267相对路径验收没有覆盖该语法。没有发现共享调度/恢复/并发/终态异常，不变Host与模型自然输出。

修改同一codespan path guard，加入结构上可选的单字母盘符+冒号+根分隔符前缀，后面的现有合法字符规则保持。parseFileReference已分离合法尾部line/column，原path和显示文字完整传递现唯一属性/委托；不全局开放冒号、不把drive-relative或协议式字符串赋予路径含义，不新状态/另一路renderer/根据Source匹配。当前一般相对/Unix路径与located basename仍按同一正向条件，裸read.ts继续code。显式Markdown与真实Source不变，Native IDE/空格Unicode/网络设备形式未验不外推。

纯UI renderer改动，仅types/build编译及本人刷新自己的115/18206，真实点击forward-slash代码引用27→backslash代码引用27→原Source27–37，人工截图内容/范围/readonly/焦点和回正文。可能新增的是明确绝对code路径动作，实际文件存在性和权限仍由原file-workbench与API校验；不是承诺未知basename或自动打开任意文件。当前文档07-panel更新实际路径契约，原模型文本/所有事实保留，若实际复核失败原失败仍保留继续根因处理。

## 当前完成事实与保留偏差

当前实际主Session ses_-zUSNYXx8zzsvDMTn7o2/project prj_hT4kBWEXkEmAJj9sNkhN，Source prt_g0VXcRTG500EPEVp5zhJ原27–37，自然正文prt_g0VXcRTyw00Aff8ZIA6O与580字符真实成功read输出完整归档。当前main-gTLqzpEL.js/类型74768 actual0/构建5917 actual0/54.71s/renderer surface0。08 forward点击真实27；09/10 locator结果沿用旧位置不能当backslash动作通过，12手动Home到1、13 locator仍1失败保留，14直接点击截图上可见代码文字确实回到27。15原Source完整27–37与readonly true/tabindex0/Editorfocus true，16原自然正文三种引用/裸code完整。06实际Home帧保留，不误当最终正文；07手动选原会话后才是本次链接。一次label同时命中section/textbox的工具选择错误更正为role textbox；locator未触发的首因未知，不推断应用根因。

自己115关闭立即sole shutdown，原前台20705 actual0、5EOF/取消0/Native exited0。04:55:24.796Z完成早于固定04:58:18.580Z，原预算/occurrence不变，当前实际余量173784ms；至少3分钟收尾目标少6216ms未满足，不能改写为满足或重启修饰。独立物理输出请求/出生/18206/完整pair退休通过，原源码9354bytes/262行、全文与属性相等。所有观察器/checker actual join之后再精确自身5产物保管；宽矩阵与实时子Dock未验明确保留，继续goal active。
