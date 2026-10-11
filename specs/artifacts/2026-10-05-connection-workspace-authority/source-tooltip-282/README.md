# 282 来源提示焦点与点击穿透

[实施前Recall和逐步准入](../source-tooltip-plan-282.md)。本轮始终单agent，开始32e6412e3干净。上一轮长提示未取得视觉资格，本轮先复现、记录真实关闭栈和鼠标命中对象，再修正两条共享路径。

## 根因与最终实现

第一处是Kobalte TooltipRoot无条件因祖先scroll关闭提示。真实外部资料页返回后，Tab让来源获得键盘焦点，但滚动调整随后关闭提示，焦点仍在原链接。[02诊断转移记录](live-02/tooltip-transitions.json)给出同一长来源open→close以及handleScroll→hideTooltip的真实栈。[01失败截图](live-01/05-after-external-focus.png)与[02诊断复现](live-02/02-first-return.png)保留。普通短/长focus、Escape、再次移入本来可以工作，不能将此描述成全部长地址无法显示。

当前唯一依赖patch在真实trigger匹配:focus-visible时保留现有提示；hover-only祖先滚动、Escape、blur、click和卸载仍沿原库路径。同步源码和JS/JSX分发入口，没有Source专属状态、定时重开或第二浮层。来源内容、身份与协议没有变化。依据[WCAG 2.2焦点内容持久性说明](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)及本地0.13.11实际源码；上游当前源码也保留原滚动关闭逻辑，未盲目升级库。

第二处是在提示持续后暴露的鼠标遮挡：Content已有pointer-events:none，但其data-popper-positioner父DIV仍为auto。[03真实命中](live-03/05-pointer-hit.json)证明来源中心命中父定位层，第一次鼠标点击未导航、焦点落BODY；键盘激活可以导航。全仓同语义审计发现work-ledger只为两种摘要提示局部处理父层。现将该规则提升到公共tooltip.css，匹配直接包含.oc-tooltip的定位层，删除完全重复的局部规则。菜单/对话框等其他定位层不匹配；非交互提示的内容和外层统一穿透。

## 最终真实视觉验收

04正常dev/ui18229呈现main-Cri4lTiA.js，真实gpt-6.1-sol读取两个MDN章节与原文长text fragment。Root人工查看[长提示覆盖来源](live-04/01-tooltip-over-source.png)；[真实命中记录](live-04/01-pointer-hit.json)此时命中第二来源的SPAN/真实href，定位层pointer-events:none。一次普通鼠标点击即打开自有页18的#technical_summary，关闭资料页后首次两次Tab进入长来源，[完整提示持续显示](live-04/02-first-return.png)。

[Escape关闭](live-04/03-escape.png)后，重新移入可以打开；再Tab至模型总结中的示例链接，[失焦关闭](live-04/04-blur.png)成立。另行验证非Source的[项目提示](live-04/05-shared-project-tooltip.png)键盘显示以及Escape关闭。所有结论来自实际交互和Root查看截图，DOM（Document Object Model，文档对象模型）记录仅是命中/身份/几何旁证，没有DOM、快照、像素或组件自动化断言。03已经验证滚动修复，但鼠标遮挡未通过；04补齐这项，不能改写03失败。

范围是当前桌面Main及一个共享项目提示。未将其冒充所有40处Tooltip、多端、hover-only全部组合、原Research Studio子侧栏全帧Rendering或旧schema任务验收；这些仍由持续goal跟进。

## 工具链与证据

SourceParts临时onOpenChange诊断只观察现有AppLog，未控制open，已从生产代码移除；[诊断patch](helpers/diagnostic.patch)保留。诊断构建12308 actual0，正常typecheck49309 actual0，第一正常build43429 actual0/51.11秒，加入公共CSS后的最终build86761 actual0/48.57秒。最终不是诊断构建；package/lock没有版本或配置diff。纯UI改动没有新增/运行UI自动化或无关后端测试。

bun patch --commit遇Windows EPERM并移去原patch，先用本轮已检查的精确备份恢复。参照215既有处理，从实际三文件Git差异生成标准hunk追加到同一patch。首次额外空行使Bun的hunk parser拒绝，修正边界后正常与frozen安装均actual0；原旧patch保留。原失败及成功日志均在本目录，没有跳过完整性检查或hook。

只读浏览器接口不支持document.hasFocus与getAttributeNames，前者改用实际activeElement/aria-describedby，后者读取命中节点的明确属性；失败未计为产品bug，也未绕过接口。03长Thinking由实际work Provider reader持续137511ms、86个chunk并EOF证明，非仅看状态文案；缓存skill state.read均完成，未发现调度收敛异常。

## 原始运行与收尾

四轮分别dev/ui18226/18227/18228/18229，每轮固定600000ms/12累计请求，完整授权auth/models配对，分别usable/projected/实际gpt-6.1-sol streaming预检。每轮实际工具全集均为3次webfetch，3条完整持久化来源，7个Provider EOF、0取消。后端[事实检查器](helpers/facts.ts)读取实际归档，不包含UI断言；01为[初次事实](actual-source-facts.json)，02/03/04分别为当前编号facts文件。

|轮次|原前台actual exit0|Native PID/出生ticks|Host PID/出生ticks|物理闭合时剩余ms|
|---|---|---|---|---|
|01|22270|78632 / 639272863527484113|63532 / 639272863519772042|264941|
|02|28312|41860 / 639272870223020541|68264 / 639272870185616506|371859|
|03|29068|77940 / 639272877288815545|45520 / 639272877281201719|130847|
|04|44922|60064 / 639272884471297682|30184 / 639272884463350845|413257|

03未达到自设提前四分钟目标，差109153ms；其他轮满足。四轮都在固定上限内正常关闭，没有延时、重启旧轮次或用后轮成功覆盖前轮。各自页面11/12、13/14、15/16、17/18正常关闭；最终浏览器清单为空，280错误临时页1也已随前turn清理。未操作用户页面/进程，未创建Task/成员或多agent委托。

每轮唯一shutdown、原前台actual join后，独立检查精确出生、物理退出/输出/请求结束、端口释放和复制配对退休；所有checker/observer实际结束后，才保管自己五个Bun产物，且在下一服务前完成。归档保留完整脱敏Canonical/Provider/日志；公开AX与构建文本仅规范行尾空白，私有原件保留。当前两项修复可审查提交并正常同步，goal继续active。
