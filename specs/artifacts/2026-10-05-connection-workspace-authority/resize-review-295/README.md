# 295 ResizeObserver 通知调查

[Recall与实施前分析](../resize-review-plan-295.md)。原5e195eb18开始干净，全程root单agent。用户原ResearchStudio、18107进程/窗口/DB未操作；用原294完整已闭合会话，不调用新Provider、不创建Task或成员。没有UI自动化、组件/DOM断言或截图基线。

## 诊断证据

先在实际AutoGrowTextarea、ChatComposer、Conversation、Card、RightDock、dom-utils回调外记录同一observer目标尺寸。仅局部模块引用，未覆盖全局ResizeObserver、未放宽renderer公开变量checker，没有读取输入文本或认证内容。后来加target的两级祖先，排查虚拟行测量改变父容器的路径。

history-01正常/ui18250/tab41。首次INFO服务过滤原AppLog.debug，04-observer-errors.json为[]，第一次01空pipeline没有形成文件；两者不代表实际无通知。确认服务--log-level INFO、/log按等级发送到logger后，临时记录提到INFO。同一原服务预算内两次更新诊断构建/刷新自己的页面，不重启Native或延长期限。

[05完整事件](history-01/05-info-dock-observer-errors.json)有三个真实通知，所记本地回调没有同步改变目标尺寸。进一步包裹实际virtua0.49.3的Solid发行入口，保留原callback调用与调度；本轮实际解析为virtua.solid。两候选发行文件修改前保管，未使用替代库或全局hook。

[06完整事件与尺寸](history-01/06-virtua-observer-errors.json)及最终原runtime日志共6通知：前3为本地范围记录，后3有库内部记录。后3的原callback分别在error之前3.2ms、0.3ms、0.8ms改变conversation-virtual-window高度：

|实际测量|前高度|后高度|宽度|
|---|---|---|---|
|1|640|421.5|759.667|
|2|421.5|1477.594|759.667|
|3|1477.594|2424.719|759.667|

当前库createResizer从ResizeObserverEntry读实际行高度后通过ACTION_ITEM_RESIZE更新store，导致父容器高度变化。所测本地回调没有同步目标/祖先尺寸变化。本例的报告可归因到这组虚拟列表测量，不能扩展到所有历史通知或子侧栏。

[MDN的机制说明](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors)解释绘制前递归布局可能延期通知；具体是否需要修改取决于回调行为。安装Virtua README也说明其测量可能产生此报告。此处最终尺寸收敛、页面可读，不能只为日志归零去延迟库的同步测量、增加另一高度状态或屏蔽错误。决定不新增生产补丁，继续调查原子侧栏文本owner重挂载。

## 真实页面及撤销诊断

[02宽草稿](history-01/02-draft-wide.png)、[04实际窄Dock](history-01/04-dock-narrow.png)、[06库级诊断场景](history-01/06-virtua-dock.png)、[07清空草稿](history-01/07-draft-cleared.png)。草稿使用原294请求，仅输入/清空，从未发送；原正文和Sources未改。一次旧AX索引点击实际聚焦正文，03正确命名body-focus；一次AX checkbox与DOM button表示差异导致定位拒绝，读取当前DOM后正确点击，未当作产品故障。

临时代码分别见[Overlay差异](overlay-diagnostic.patch)、[尺寸记录模块](resize-diagnostics-295.ts)、[库JS差异](virtua-index.js.patch)和[库JSX差异](virtua-index.jsx.patch)。最终7处tracked源码用精确patch恢复，临时module删除；两个已保管库文件在审查仅有自己两处变更后恢复原直接字节。git diff packages为空，未新增patch依赖或改变生产日志等级。对原无用户改动的精确文件操作，没有粗暴回退。

诊断types18477 actual0；三次diagnostic build67572/91854/82579 actual0，52.10/48.74/49.56s。最终types94154、build72609 actual0/49.75s。正常history-02的/ui18251/tab42实际main-DjCcg_0v.js：

- [01宽草稿](history-02/01-normal-draft-wide.png)原文字换行可读。
- [02窄Dock](history-02/02-normal-dock-narrow.png)主区域及输入宽度正常调整；随后草稿清空。
- [03 Source键盘提示](history-02/03-normal-source-focus.png)真实MDN来源可聚焦，完整标题/URL/获取来源提示可读。

本人逐图复核；历史无模型投影提示是准确状态，不代表用户原OpenAI授权失效。没有通过正常构建的INFO空日志宣称ResizeObserver问题消失。原ResearchStudio大规模子侧栏、动态文本owner、全帧与其他平台仍未验。

## 完整历史与收尾

Source原294 Main ses_-zUSGSq0qzzrHOgiE42h、Project prj_hGFxt5nJEzSZOtzudQfw。每次fresh核对schema current/90表、4助手终态、2权限成功结果、control consumed、两ProjectMemory idle/pending0，全部恢复/待tool/provider/Bus前沿闭合，唯一未过期runtime lease的原Native出生已死。config两项目powershell/4 profiles、plugins/channels/commands空，仅既有browser/computer MCP；完整表逐行复制，没有裁剪原数据。

|阶段|原前台实际|Native/Host出生|收敛UTC|900000ms剩余|
|---|---|---|---|---|
|history-01|91303 exit0|76156/639273101941643794；71772/639273101934147445|10:20:32.594|260747ms|
|history-02|67340 exit0|26648/639273110338702024；76828/639273110331168627|10:25:41.853|791171ms|

第一阶段没有达到预设300000ms收尾余量，准确保留，原期限未延长。两Native terminal0，自己的41/42页已关闭；sole shutdown、原前台join、独立physical/output/request/port/pair资格actual0。两份[诊断保管](history-01/actual-history-custody.json)/[最终保管](history-02/actual-history-custody.json)均19表和12生命周期全值相等，runtime config直接字节相等，原两Project文件元数据相同（并非全文身份声明）。native/保管checker结束后各5自产物按实际出生/路径归档。

只提交本轮归因和证据；文档索引、docs/architecture、公开扫描、范围commit及普通push后继续，goal active。

docs:check actual0（345 ops/25 groups）、architecture-index actual0（18 current documents）。本轮脚本、清单与日志已归档；公开文本仅清理行尾空白，原件raw-public-text保管，JSON/图片/诊断patch未重写。92份JSON/日志/脚本/文档通过原授权凭据的内存精确扫描，0匹配，见[scan.log](scan.log)；诊断diff另行完整审查。原凭据未复制到本轮实例或公开证据。
