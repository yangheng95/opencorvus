# 306 多来源信息与操作层级

## Recall

用户持续要求自主体验和改进 Sources、Rendering 与产品功能；最新明确只使用单 agent，本轮不委托。305 已正常推送 25cc75c1ad3b0e3997b47831c10985e2ee0008cc，工作区开始干净。运行时沿唯一 packageManager Bun 1.4.0，使用305已验证的任务私有官方可执行文件，不替换用户全局运行时，不操作用户进程或窗口。

已读 SourceParts、CardParts 唯一调用、Disclosure、messages.css、websearch 与 Exa transport、当前07-panel/反应性契约、234真实多来源前后及305闭合记录。全仓检索确认 Main/Side/子侧栏均经过共享 SourceParts；Sources 相关 overlay/test 检索未发现 UI 自动化测试，不新增或运行。234已检查静态多来源但明确未验证单→多瞬间；不得重复把推测写成已复现。

## 调查与实施前边界

当前单条来源直接链接，多条来源把第一条标题用作整个分组的 summary，实际链接全藏在展开内容；相同标题有两种动作，组折叠时没有站点身份。代码另有 URL 原文标题同时在主标题与次行重复站点的情况。潜在触发是一次真实搜索多结果或来源数量增长；真实影响、视觉程度与动态切换仍未知，先正常页面观察。旧234解决长摘要字体和高度，未改变上述分组结构。数据顺序、URL、sourceId、snippet、Provider/工具结果和存储是现有唯一事实源，不合成消息、不注入 UI 数据、不改工具以制造结果。

先启动独立正常开发服务 /ui，使用已授权 auth 与完整 models 配对且分别预检，实际请求固定 gpt-6.1-sol/streaming。通过普通单会话真实 websearch 获取来源，不创建开发子agent或产品成员。NativeService 使用既有固定时限与20请求上限，退出需原执行器实际 join、精确 Native/Host/端口和凭据配对收敛。截图检查折叠/展开、第一条链接、摘要阅读及键盘操作；失败/额度不足按真实结果记录。无新外部凭据或发布。

观察后补充根因和具体唯一实现再修改；接口/调度/持久化暂不涉及，若发现执行收敛异常立即横向审计。UI 修改需构建后新独立正常服务和真实截图人工复核，禁止 UI 自动化测试或静态文案断言替代视觉。完成后更新当前契约、索引、文档检查，范围提交、fetch/merge、完整待推送集合检查、正常push，持续goal保持active。

## 实际 before 与准入实现

独立18269普通Work Chat实际单次websearch返回5条带摘要的来源，21秒正常完成，没有成员委托。live-01/01-before-collapsed.png 和02-before-expanded.png亲自查看：收起仅第一篇MDN标题和5，没有域名；点击实际只展开，第一篇完整标题在summary和首链接重复。标题动作歧义和重复可确认；数量增长瞬间未捕到，不给闪烁根因资格。工具/来源均自然产生，原始证据保留。

根因是SourceParts顶层以length===1切换两套树，多条把第一标题充当组动作，站点和真实目标只存在于隐藏entries。旧234改善摘要阅读字体/高度，208增加URL次行，二者均没有处理多条组summary。唯一修改：所有数量使用同一group容器，第一条Key/SourceEntry常驻，剩余条目进入原生Disclosure；summary明确本地化“其余N条来源”，不再重复第一标题。保留现cardExpanded组key、sourceIdentity/顺序/编号、每条excerptkey与读位、Tooltip和来源导航；余项展开后仍全部显示，不截断真实来源。没有额外数据副本、兼容renderer或手工焦点管理。去除只服务旧preview/count的样式，剩余列表沿来源行起点对齐，使用现有间距token。

影响Main/Side/子侧栏共用SourceParts；纯UI层级和翻译变更，后端Schema/Provider/消息/调度/版本均不改，故不运行无关后端测试。风险为列表展开引起几何变化、旧组展开偏好继续展开余项、keyboard顺序改变；after实际检查首链接直接打开、余项原生键盘展开、长标题换行、excerpt末段与收起重开。未知单→多流式窗口仍如实保留。先关闭before原服务并完整join，再构建/启动新独立服务进行真实after；不刷新或重启用户服务。

02实际5来源完成；新首链接、域名和4 more sources均正常呈现，Enter展开有效。但03-after-list.png显示展开后summary背景/焦点框铺满一行。根因为通用Disclosure为flex column，原Source根align-items:flex-start随结构调整不再约束新的remaining根；summary虽width:auto仍被父flex默认stretch。只在该summary加align-self:flex-start，保留全文list宽度、焦点框和公共Disclosure语义，不改共享primitive。该修正需新构建与03实际页面复核，02截图作为中间未完成结果保留。
