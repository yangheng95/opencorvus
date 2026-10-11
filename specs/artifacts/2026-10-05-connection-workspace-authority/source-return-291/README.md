# 291 Sources 返回阅读

[Recall与实施前分析](../source-return-plan-291.md)。起点6585ed019，开始工作区干净，全程root单agent，没有Provider输入、凭据移交、新Task或成员。两个正常开发/ui实例读取原238完整已关闭真实历史，不构造来源或页面夹具。

## 问题和实现

当前SourceExcerptBody已会在折叠重开时恢复自己的读位，但上层普通Session/Mission切换直接清空所有UI展示状态；Task也只恢复折叠、清空读位。主正文已有跨primary阅读状态，Sources却丢失，形成返回后重新找来源、再找原文段落的实际体验缺口。

唯一conversation-ui store现按API（Application Programming Interface，应用接口）revision和source kind/id保存presentation record，所有card/disclosure/excerpt/Side位置接口直接使用当前record。Task、普通Session和Mission在其同步Board切换batch选择同一入口；空workspace解除当前选中。保留50个最近访问对话，每个展示字段最多200条记录，不缓存来源正文或复制活动record。字段记录沿现有有界键集合裁剪，不把它冒称精确的最近使用排序。

卡片折叠仍由现localStorage单一路径持久化，key限定server URL/source kind/id；切换先同步flush，原400ms保存节奏保持。原仅Task ID折叠key不再读取，旧偏好首次默认为初始布局，旧索引条目按现上限自然淘汰；没有兼容回退、双写、Source数据迁移或新后端合同。API revision隔离瞬时读位，保存的折叠不包含消息正文或凭据。原Source组件的authority/epoch/身份校验和完整文本继续生效。

## 实际前后页面

原Main ses_-zUSRNG7gzzHK6lCxuV4、Side ses_-zUSRMeqOzzMIcHtNUpl、Project prj_hbX7wQvlJTJuJSGHqBov。五来源来自原真实搜索，包含5211/266/2625/6057/957字符摘录；Side引用是原历史副本，不把重复call ID或Source当成新的网络执行。

history-01：18242、自建tab32、main-CC7iplju.js。

- [五条Sources](history-01/01-sources-open.png)和[原摘录](history-01/02-excerpt-open.png)实际打开。
- [03稳定阅读](history-01/03-reading-before.png)：CSS代码段，top2016/height287/content2553。
- 切到已有另一Project的Reply with OK.再返回，04仅加载中间帧；[05已加载返回](history-01/05-return-settled.png)中来源组被折叠，实际details.open=false、excerpt卸载，丢失原阅读入口。
- 重新展开后06 DOM top0；[06图片](history-01/06-reopened-at-start.png)仍是展开的过渡帧，不能当完整顶部视觉证明。故障结论以03及05的实际可见状态为主，未包装截图资格。

history-02：18243、自建tab33、main-B_9-ur-u.js，root本人操作并逐图查看。

- [02稳定阅读](history-02/02-reading-settled.png)为相同CSS段落/top2016。01刚PageUp的画面仍在原生滚动过渡，02才是本轮比较锚点。
- [03另一项目](history-02/03-other-chat.png)显示原Reply with OK./OK。[04返回](history-02/04-return-preserved.png)自动保留Sources和摘录展开，同一可见CSS代码段/top2016/287/2553。未重复手动打开来源。
- [05组折叠重开](history-02/05-group-reopened.png)继续保留摘录2016；原组标题聚焦会改变外层位置，不把全页面像素相等当通过条件。
- 打开已有Side chat 1，展开原Reference history四消息和五Sources。最初getByLabel定位Reference标题失败，当前DOM表明它是文本标题，改用当前精确文本激活；未把定位错误当产品错误或忽略它。
- 侧聊同篇摘录最初top0，与Main已有2016独立；[06侧聊阅读](history-02/06-side-reading.png)经End/PageUp实际top3108/height287/content3645。切到另一项目再返回时07 Dock按现导航行为关闭，尚未显示Side，不能当丢失读位。
- 再打开原Side按钮，[08原侧聊恢复](history-02/08-side-reopened.png)保留Reference、Sources、摘录展开及同一CSS段落/top3108。Source text/标题/域名和Main独立读位均保持。

已验当前桌面暗色普通Main与原Side引用的跨项目返回、来源组重开与独立读位。未验本轮中文切换、Task/Mission独立页面、满容量驱逐、页面刷新后的折叠持久化、跨API和Tauri矩阵；代码接入不等于这些全部通过。原ResearchStudio/新实时子Dock/全帧Rendering仍单独待验。没有UI自动化、DOM/源码文案断言或截图基线。

## 检查和完整保管

build47926 actual0、51.79s；types23864 actual0。共享模块与全部生产调用已搜索，无旧loadConversationUiStateForTask调用或相同接口的UI测试遗留。Goals/Requirements展示使用原Task作用域，也经过同一record；未为测试保留旧单Task状态路径。此改动均属展示状态，不通过自动化UI状态断言替代真实页面。

两次均重新检查原238精确Host/Native出生已死、端口/pair、当前schema/config/全部恢复前沿，再完整90表逐行同值复制。两个ProjectMemory idle/pending0，8个assistant含Side复制历史已完成、2个权限执行成功、control consumed；唯一未过期runtime_process lease是原出生已死的历史记录。源原前台87454 actual0及旧Side错误事实保持。

|阶段|原前台实际结果|Native / Host出生|物理输出请求收敛UTC|固定预算余量|
|---|---|---|---|---|
|history-01|8628 exit0|76360/639273038694823152；74852/639273038686978154|08:27:37.037|711617ms|
|history-02|67619 exit0|71492/639273044817203364；71800/639273044809476160|08:38:52.503|648371ms|

自己的32/33页均关闭，sole shutdown、原前台join、独立closure、19受保护表（含interactive_artifact）和19生命周期完整值保管均actual0。原Project文件元数据保持，API请求/日志保留。所有checker实际结束后按原生出生/限定路径归档各自5产物；不改变900000ms预算。

一次PowerShell展示余量遗漏DateKind String，反序列化日期再转字符串导致时区和毫秒误差；以上从原JSON字符串保留UTC精度重新计算，错误展示不当产品预算或收尾事实。文档索引、公开凭据扫描、范围提交和正常上游同步推送后继续，goal active。
