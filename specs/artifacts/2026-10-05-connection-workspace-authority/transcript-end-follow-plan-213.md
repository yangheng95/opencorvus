# 213 End 明确跟随意图与虚拟重测量

## Recall

用户持续自主Sources/Rendering/UI/功能迭代、授权真实GPT-6.1 Sol，最新只用单agent。当前6e57d04d先修Ctrl Home/End modifier漏识别，212长真实两回合又产生新明确失败：CtrlEnd停在旧maximum5769/followfalse，最后card挂载使真实maximum8524；同scope到底按钮正确到8523/true。212原模型503重试后完成，但原严格Provider qualifier父工具1，全部错误/成功/Native0原样保留。不能将短211或第一回合通过代替这个虚拟布局失败。

## 根因深度与影响

已读dom-utils所有输入/跟随/程序归属/观察/帧调度、Conversation虚拟测量→onMeasuredContentChanged→同控制器、caller-owned tracking信号/到底按钮，全文搜索onAtBottom仅定义及三个消费者。CtrlEnd目前只登记短暂down意图，让浏览器针对当前估算几何导航，只有实际到当前bottom才通知caller；新card挂载后几何改变，原目标已不是尾部，跟随未开启则测量不得pin。这一控制流与212确切geometry吻合，短250ms记忆不表达跨布局的明确“跟随最新”指令。211保留这条旧语义，所以modifier修复未根治。

影响面为Main/Side Chat/child共享初始化及跟随回调，不涉及LLM工具/流程路由或后端调度。原onAtBottom回调名称只适合几何事实；新合同需要明确表达operator follow request（用户请求跟随），不能把在旧bottom到达前调用onAtBottom伪装为相同契约。更改全部同名消费者/定义，不保留旧兼容字段或平行信号。

Source excerpt和Tool payload、code/table可能有本地滚动，需要保护所属End动作。仓库没有通用native scroll ancestry primitive（原生滚动祖先基础组件）；已有ComposerMentionMenu只算clip边界，语义不同不可复用。已查阅[MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)和[scrollHeight](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight)：auto/scroll/hidden可构成滚动容器，clip/visible不构成；当前实现只对焦点与外层owner之间实际有垂直溢出的滚动祖先阻止外层End-follow。横向table-only、无溢出容器及其他平台仍须实际限定，不能把CSS判断推广成全浏览器键规则。

## 实施前方案

将公共callback完整替换成必填onFollowRequested，三个caller直接设置现有tracking=true，不新增消息/转录状态。onScroll真实owned downward到尾使用同回调。经过现有defaultPrevented/modifier/编辑控件/最近转录owner条件后，End/CtrlEnd若焦点不属于嵌套实际垂直滚动框，则立即发布跟随请求并走当前scheduleFollowScroll；依旧不preventDefault，浏览器原生动作与同控制器既有rAF/ResizeObserver共同收敛最新尾部。普通Arrow/PageDown仍原短暂运动归属，Home仍同步释放。嵌套有本地vertical overflow的End保持本地处理，不能请求外层follow。

保存精确修改前四文件，补07现行合同。UI禁增改运行自动化测试，overlay types/build后新独立213真实Sol Code/Chat，使用与212相同两个自然输入，原12额度/600000ms不延长；实际长第二card从Source旧视口CtrlEnd到真实current maximum/followtrue，即时/稳定人工截图，另外真实展开原webfetch payload中的本地End及编辑caret保护。若当前Node模型503再出现仍保留严格失败，不能放宽验收。若窗口不足就关闭自己scope并保留未知，不重启原212。

完成自己的页面/唯一public shutdown/原父工具/native/output/request、精确出生身份/端口/pair闭合；凭据完整pair与三重preflight遵循现有授权/成熟launcher。元数据/日志内存redactor，不归档凭据内容，非本轮页面保持不动。完整记录/三索引/docs、范围提交、fetch/merge上游/待推送集合检查/正常push，持续单agent目标不标完成。
