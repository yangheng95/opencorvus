# 286 工具内容操作对象与格式显示

[实施前Recall](../tool-payload-plan-286.md)。持续单agent，开始9611f5701已推送且工作区干净。本轮修改共享ToolPayload及两语言操作名称，没有新Task、成员或Provider请求。

## 根因与实现

284的[真实前态](../tool-caption-284/live-01/03-raw-input.png)中，点击Raw只把按钮改成Readable，Input仍折叠；另按Expand才显示内容。raw模式和expanded显示状态没有在该动作中协同。Input/Output同时出现同名Expand/Copy，section也没有可访问组名。既有工具标题、来源和渲染修复不涉及这些操作语义。

ToolPayload现用可见标签命名group，Solid现有唯一ID关联标签和实际挂载正文；可访问操作名称与Copy提示包含Input/Output/Details。短可见文案和原布局保留。Raw/Readable使用普通变名动作，去除与变名相冲突的pressed语义；选择格式时通过原expanded状态打开默认折叠的payload。Output原有预览/全文独立控制，copy仍使用原props.value，没有第二状态、数据副本、解析器或协议变化。W3C依据和全部调用影响见Recall。

## 真实中英文页面

Root在正常dev/ui18233读取原153完整历史的已有研究成员，当前bundle为main-ChsCH8Wh.js。[01默认折叠](history-01/01-payload-collapsed.png)保留紧凑Input栏；当前AX记录明确是Input/Output组和Raw Input、Expand Input、Copy Input、Expand Output、Copy Output。

聚焦Raw Input按Enter，[02原始输入](history-01/02-raw-input.png)一次即显示真实网址、format、timeout，按钮变为Readable Input且Collapse Input为expanded。按Space，[03阅读视图](history-01/03-readable-input.png)保留可见正文、展示三个真实字段，焦点留在格式按钮。[控件关联原始观察](history-01/03-control-context.json)记录可见标签、名称、expanded和指向实际正文的controls，仅作手动检查旁证，不含UI断言。

[04输入收起](history-01/04-input-collapse.png)和[05输出展开](history-01/05-output-expand.png)通过各自明确名称的按钮独立操作，未改变另一payload。输出全文滚动的每个字符和Clipboard实际写入未在本轮重新验收；Copy行为未修改，仅名称和提示修改。不能把名称检查宣称成实际屏幕阅读器软件或剪贴板测试。

通过本页面Settings→Appearance切换简体中文。[06中文对象](history-01/06-chinese-context.png)及其AX显示“输入/输出”组、“原始内容：输入”“展开全文：输入/输出”“复制输入/输出”。[07中文Raw](history-01/07-chinese-raw.png)用Enter一次显示原输入，[08中文阅读](history-01/08-chinese-readable.png)用Space切换，窄Dock布局和焦点均经Root人工查看。最后通过同一设置UI恢复English，[09实际恢复状态](history-01/09-language-restored.ax.txt)保留。

已审查browser host的settings.save→saveBrowserOverlaySettings只写该origin的localStorage；18233是本轮新独立页面，未修改用户应用或全局偏好。整个过程没有DOM注入、组件/截图/像素/源码文案自动化测试。AX及DOM仅为实际交互的观测记录。

## 当前数据资格、检查与收尾

沿用285成熟工具，fresh原153精确出生/原parent30224 join0/端口/pair、schema及全部恢复前沿检查实际通过，再完整复制90张表逐行相等。原Task completed epoch1、15 assistant完成、permissions8/checkpoints2/3 ingress闭合，Provider/Tool/发布/交付为空，两ProjectMemory idle/pending0。唯一MAX_SAFE runtime lease按原实际出生已死判断，没有改写旧数据、重演任务或移交auth/models。

正常build19275 actual0（49.16秒）、typecheck67200 actual0、catalog结构检查2语言2089键通过。后者仅证明键和占位符一致，中文页面仍单独呈现复核。当前07-panel文档和索引同步；无后端镜像测试。

自己的23页（本轮browser2中新建localhost18233，与旧用户页不是同一对象）关闭，sole shutdown actual0、原前台19378实际join exit0。Native69780/出生639272926772643803、Host69872/出生639272926765247538；固定900000ms，物理输出/请求在2026-10-11T05:23:29.742Z完成，余566710ms，满足提前五分钟目标。独立核对精确出生、18233释放、复制对退休；全部checker结束后才保管5自产物。

最终13核心表完整存储行与原库相等，原5Session/22Message/59Part和Provider/Tool事实保持。原/副本runtime配置直接字节相等；原文件属性只有已审查.git目录mtime变化，未把属性检查冒充全文身份。无凭据环境的Model configuration unavailable提示保留；公开model目录查询按既有生命周期收尾，不当作真实模型调用。

本轮范围是当前共享payload的格式/展开操作与中英文名称。原ResearchStudio/新live/全帧Rendering、其他未采样payload不由本轮替代。公开证据扫描、当前文档检查及范围提交/上游合并/正常push后继续，goal active。
