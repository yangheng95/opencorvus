# 289 当前编辑器语言、查询与阅读状态

[Recall、完整根因与每次修正](../editor-locale-plan-289.md)。288为已验证进展，b34e232ac已推送且开始干净；本轮全程单agent，无新成员、Task、Provider请求或凭据移交。

## 问题和最终实现

288中文页面已经翻译主界面，但CodeMirror查找/选项仍英文，已挂载编辑器的AX名称仍Editor。两个创建入口未配置phrases，且CodeEditor仅mount时设置aria-label。共享createCodeEditorLocale现从同一应用catalog取得原生查找/替换、跳行、折叠、补全与诊断文案，用当前组件的Compartment更新现有view；两个入口CodeEditor和DiffArtifact共同使用。当前ariaLabel随原readOnly内容属性更新，旧独立mount标签删除。

CodeMirror官方[翻译机制](https://codemirror.net/examples/translate/)与[动态配置/scrollSnapshot契约](https://codemirror.net/docs/ref/)及安装源码共同用于判断实现。没有复制搜索面板、手动改库DOM、备用词典或新的语言设置面。

初版phrases变化会触发库setState重建内部视图，普通同transaction的滚动effect循环被提前跳过。第二版采用先取官方快照、更新配置、再单独应用快照，但真实语言切换仍出现阅读位移。继续查全部locale入口发现，同一语言的seq刷新会令新helper每次构造新facet，即使译文完全相同也连续重绘，在未测量完成的视图上再次取得锚点。最终以完整phrase键/值相等作为memo身份，只有实际文案变化才更新同一个extension；两侧view先全部捕获快照再各自配置与应用。普通语言事件仍处理，错误/新译文不被忽略；全局locale偏好、持久化、模型语言和服务端没有改变。

## 原失败保留

history-01为原固定15分钟实例。01–04证明中文控件/名称/query与大小写选项正确，但首次wheel位置差异尚不足定因。05两次稳定top5813.333、约203–221行；06切回英文后top6544.667、约248–259行，证明确有位移。第二版07约203–221/top5852.667，08约249–262/top6592仍失败。09→10只进设置返回、没有换语言，top638.667和约20–37行保持；11证明隐藏页面是visibility:hidden且尺寸保留，排除把普通往返或尺寸归零误判成原因。

这些失败记录没有改成通过；修复后的第二实例是新实现的独立验收，不是因观察超时重启旧服务。第一次替换按钮激活只选中匹配，保留实际截图；安装库replaceNext的契约是选中当前匹配后才替换，后续Enter激活取得真正修改结果，没有靠按钮点击本身宣称成功。

## 最终实际验收

正常dev/ui18238，自建tab28，实际脚本main-Ct2CPS3b.js；完整原265真实Main Session及两条Source保持。没有创建或注入Source、DOM、模型消息或浏览器fixture，全部图片由root实际操作并查看。

- [01英文](after-02/01-english.png)在约203–221行，查询citedReadRange、Match case已选。[02中文](after-02/02-chinese.png)仍是同一内容锚点，查找/上下个/全部/正则/全字/关闭及编辑器名称更新，查询/选项保留。top5852.667→5424反映内部高度估算，资格来自相同可见内容，不要求原生像素滚动值不变。
- [03中文跳行](after-02/03-go-to-line.png)真实显示“跳转到行/跳转”；输入27并执行，[04](after-02/04-line-27.png)实际定位第27行。[05恢复英文](after-02/05-english-return.png)仍保留该20–37行上下文与查询/选项，名称回Editor。03打开额外面板时采样的中间可见范围与02不同，该一步只验文案/实际跳行，不声称所有面板动作均保持阅读位置。
- 通过Add tool→Files打开原Project真实README.md。它是一行原46bytes文件，当前可编辑且Save按原dirty语义显示。Find=Isolated、Replace=Reviewed，06先选中匹配；[07实际替换](after-02/07-draft-replaced.png)使文档成为Reviewed标题并出现dirty/Save。
- [08中文草稿](after-02/08-chinese-draft.png)保留这次真实draft、query、replacement和dirty状态，替换/全部替换等中文可见。[09 Ctrl+Z](after-02/09-draft-undone.png)通过原撤销历史恢复Isolated原文，dirty清除；未点击Save、未写磁盘。[10英文恢复](after-02/10-restored-english.png)确认当前控件名称与两个查询字段继续保留，随后关闭自己的页面。

已覆盖真实只读来源、真实可编辑项目文件、语言双向切换、查询选项、草稿与Undo、中文跳行和实际阅读锚点。DiffArtifact、折叠/补全/诊断的每种文案、屏幕阅读器软件、所有主题与原生平台仍未逐项视觉验收，27个catalog键不等于全部场景通过。未新增或运行UI自动化、DOM/源码文案/组件/快照测试。

## 检查与保管

初始build99634 actual0/54.82秒、types99566 actual0；快照版build90672 actual0/51.62秒、types48645 actual0；最终build65689 actual0/53.35秒、types56120 actual0。两语言目录结构为2119键；构建/类型不能替代以上实际截图。

两实例分别fresh原265精确Native出生/端口/pair、schema/config/全部恢复前沿后完整复制90表逐行相等。原普通Main ses_-zUSNlWWuzzuGg1K9BbU、Project prj_hln9w2B7mnt2gsZHByHX；原4 assistant完成、2权限执行有结果、1control consumed、两ProjectMemory idle/pending0，唯一未过期runtime lease的原出生已死。配置完整值与当前已审查288一致，原Task/Mission/dispatch为空，没有模型/队列执行活动。全局语言偏好的并发/回退宽矩阵不据这些事实推断通过。

history-01 tab27关闭，sole shutdown实际0，原前台86553实际join0；Native73052/出生639272982309228731、Host64940/出生639272982301510914，07:00:50.799Z物理输出请求收敛，余279268ms，提前五分钟目标差20732ms，明确未达成；仍在原15分钟资源寿命内完整退出，预算未改。

after-02 tab28关闭，sole shutdown实际0，原前台2548实际join0；Native67544/出生639272991549143202、Host57508/出生639272991541287927，07:14:01.979Z收敛，余412062ms，本阶段达到提前五分钟目标。独立archive与18核心表/12生命周期保管均actual0，原2Session/6Message/14Part与Provider/Tool事实完整相等。原项目文件属性保持，引用read.ts全文9354bytes/262行及属性保持；README草稿撤销后原磁盘文件属性也保持，没有把元数据检查冒充所有项目全文身份。

两阶段所有checker实际结束后才分别归档5自产物。页面Model configuration unavailable保留为无凭据历史阅读状态，不冒充原用户OpenAI授权失败或新Provider验收。当前文档索引、公开凭据扫描、范围commit/上游merge/普通push后继续；原ResearchStudio/新实时子Dock/全帧Rendering及287失败/交付名称等未验范围仍保留，goal active。
