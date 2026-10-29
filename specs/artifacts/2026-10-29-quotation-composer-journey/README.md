# 引用移除后键盘连续性

12张未编辑截图均为独立开发serve /ui真实交互，已经实际呈现并人工查看。未新增或运行UI自动化、组件/DOM/源码文案断言、浏览器fixture或像素基线。

01：真实既有模型回复。02–03：三击整个末段使选区边界越至Message外的usage控件，不符合当前同Message引用合同；随后缩小真实拖选，原Quote/Ask正确出现。这里不是伪造DOM选区或已证选择器故障。

04–05：真实Quote和主草稿；Shift+Tab两次（splitter→Remove quotation），确认聚焦移除按钮后Enter，引用消失、草稿保留，但AX焦点落页面根，显示当前缺陷。

06–07：原选区Ask in side chat准备与第一次真实Side chat 1（三条继承历史），独立侧草稿经Shift+Tab→Remove→Enter，同样丢失焦点。06为准备中间态，07才是引用已准备且移除的实际结果；没有发送问题或模型执行。

08–10：新普通main-Cd7eVutE.js中的相同原回复和原键盘操作。主移除后AX直接指向原主textarea，并在未重新点击/聚焦的情况下用End和真实typing追加文字；侧聊同样直接续写。原主、侧草稿分别保留。显式Ask按当前合同新建Side chat 2，不将其冒充原Side chat 1的同一身份。

11–12：切换中文并从设置返回，两原文草稿保留；关闭侧聊标签后从主入口重开，选中原Side chat 2且侧草稿保持。没有重新发送。中文界面与英文移除焦点分开按实际覆盖叙述，没有声称中文再次执行了移除操作。

- [data.json](data.json)：两库92表全部旧行112184/112575及源库逐行精确，最终112966；schema9/integrity ok。两个真实Side复制及原Tool/Message事实和总线收据，十原文件和两个namespace各17附件精确保留。
- [runtime.json](runtime.json)：两个公开shutdown200，原exec13795/22628及native/launcher退出0，物理/输出/请求与出生身份退休；没有auth副本、模型请求0，目录副本退休，累计782。
- [checks.json](checks.json)：Overlay类型、普通build/renderer及当前文档和架构checker；不把这些辅助命令当作视觉验收。

修复仅两个父输入的原移除回调：清除quotation后同步向其现有可见/启用/连接textarea交焦点，保留原草稿、引用事实和preventScroll，不建立异步全局焦点状态。未改API/SDK/schema/Provider/包版本。Task/Mission实页、在途authority切换/隐藏输入矩阵、文件选区/附件及跨项目待发原件流程未新增验收，保留为后续目标。
