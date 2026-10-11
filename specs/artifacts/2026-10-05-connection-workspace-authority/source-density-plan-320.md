# 320 长文件来源的信息密度

## Recall

用户要求持续自主体验和改善Sources、UI/UX（User Interface/User Experience，用户界面/用户体验），只用单agent。319已推送85b3e078e11a2b201678bde81fef60cbbc880a9c；本轮开始git status干净。前轮为progress：代码、真实模型、页面截图、检查和远端交付已完成。goal保持active，旧目标中的Astra委托措辞不执行。

已读319 Recall/结果、SourceParts全部文件来源label/detail/tooltip/打开路径、messages.css来源样式、utils/tool与server-path目录关系、CardParts共享引用分组、TextPart加载状态、07-panel来源契约。检索全部msg-source-chip__detail/location、SourceParts调用。既有shortRelativePath保留完整项目相对路径，不会按字符截断。UI自动化测试未涉及；不新增或运行。

## 现象与待核实项

319仅验收三个短根目录文件引用。当前嵌套文件的主标签显示basename和行号，次级caption再次显示完整相对path和行号，故重复filename/range；长路径全量换行可能压低正文。网页caption已有两行裁剪，但文件尚未裁剪。仅凭代码不能定性视觉差，先在当前319构建的真实窄Side chat观察长目录、同名文件以及长文件名。

直接数据流是实际search_code→fileSource→SourcePayload持久化→SourceParts；公开path/title/range和sourceId已经正确。若实际截图确认冗余占空间，优先让主标签承载文件名/范围，次级说明承载所在目录；tooltip和可访问名称保留完整定位。不能盲目裁掉深层目录，使两个同名文件难以区分，也不能改动来源或跳转身份。自定义title不等于实际basename时仍需要显示真实文件名，根目录和Windows盘符/UNC（Universal Naming Convention，通用命名约定）根、POSIX（Portable Operating System Interface，可移植操作系统接口）反斜杠字符及空白名称需要沿既有服务端路径语法处理。

候选修改只在共享呈现层，沿现有SourceParts与样式primitive，不新增Source状态、API（Application Programming Interface，应用程序接口）或后端协议；来源打开、读位、展开状态和时间线不变。若发现真实调度、排队或终态异常立即按共享机制横向审计；目前无新证据。

## 真实验收和交付

先以正常开发/ui18289、当前main-C5ym2uLq.js基线启动fresh NativeService，12请求/600000ms物理边界。授权auth与完整models配对，分别预检usable/projected/实际gpt-6.1-sol流式。在隔离项目创建两个深层同名实际文件，真实普通会话搜索后进入同项目Side chat再真实搜索，不新增Task/成员或委托，串行只运行一个模型会话。截图人工检查长路径/重复命名和380px侧栏，必要时点击确认实际文件。仅记录页面事实，不注入消息/来源或DOM状态。

确认原因后补齐本方案，再改UI；正常构建并新建独立轮次验证实际来源密度、两个同名路径的辨识和正确点击。若无实证问题则保留观察，不做症状补丁。UI验收只能真实交互、截图人工复核；类型/构建/文档检查仅为各自契约。原执行器actual join及Native/Host/端口/配对清理后归档脱敏证据，更新根/月/目录索引、当前架构，范围提交、fetch/merge、完整待推送集合检查、正常push。持续goal active，原子侧栏完整流式验收仍单独记为未完成。

## 基线事实与最终修改方案

live-01已实际看到380px Side chat的相同长文件名/行号在label和caption重复，caption占三行；截图01已人工复核，只读排布记录的每条高度约69.49px。两处区别在目录尾部的实验方案甲/乙，因此不能简单裁剪到相同的路径前缀。采用目录caption：仅当主标签已经等于实际basename+range时，次级文字显示完整父目录（保留尾部分隔符）；否则保留现有完整位置，避免自定义title隐藏真实文件名。根目录普通文件无需额外caption，绝对盘符/UNC/POSIX根通过保留最后分隔符保持含义。路径语法仍由source.path和既有pathWithForwardSeparators承担，空白字符不trim。

sourceDetail保持唯一完整位置用于tooltip和可访问名称，打开动作继续用原path/range；不改变CSS、来源模型、语义身份、范围或持久化，也不做文件路径裁剪。此次删除的是caption中的已展示重复信息，不是删除定位信息。UI专用派生函数不添加组件/DOM/源码文案测试。

基线累计10次真实Provider请求全部200/EOF。实际模型在普通Chat及Side chat产生多次独立search_code调用，归档共有8个Source记录，不能按模型最终自述推断调用次数。完整请求归属从真实数据库复核，重复搜索不合成为一条；本轮不据此改变工具调度或限制模型。页89关闭，原97096实际exit0，Native72116/Host71168和18289端口及凭据配对已清理。接下来新/ui18290验证更改，仍单agent。

归档复核进一步区分：其中同callID/同start的主会话Tool记录随Side chat的规范原子fork复制为参考历史，07-panel与Session.fork均明确该契约。不能把这条参考副本计作再次物理调用；实际不同callID的search_code共3次（主1、侧2），8条来源包含两条继承来源。排布只读查询也包含保留的参考历史节点，不能把所有查询行都称为当前视口可见；视觉结论以已查看截图中实际可见的末组来源为准。这不构成新调度/重复执行异常。

## 完成本轮范围

修改后六张前后/打开/键盘截图已人工复核，目录说明两行且甲/乙完整，两文件各选中真实第2行，完整路径tooltip保留。类型14160和构建78170实际exit0；第二轮原21395实际exit0，9请求200/EOF。归档脚本第二轮写入错误目录导致收据冲突，已按真实launch owner修复并明确补录已完成移动的收据，不覆盖第一轮记录。[最终事实与边界](source-density-320/README.md)。继续完成文档检查、范围提交、上游合并和正常push，goal active。
