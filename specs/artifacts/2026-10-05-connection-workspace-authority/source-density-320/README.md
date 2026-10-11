# 320 长文件来源的目录说明

[实施前 Recall 和根因分析](../source-density-plan-320.md)。单agent，基线85b3e078e11a2b201678bde81fef60cbbc880a9c。

## 改动和真实观察

嵌套文件来源原先在主标签显示文件名/行号，又在次级完整路径中重复同样信息。当前仅当主标签已等于实际basename（文件名）和范围时，次级caption（说明文字）显示完整父目录并保留尾部分隔符。自定义标题仍显示完整实际位置，避免隐藏真正文件名。完整路径继续用于tooltip（悬浮提示）和可访问名称，打开动作仍读取原path/range。没有裁剪目录字符、CSS改动、新来源状态或后端契约变化。

真实隔离项目含两份同名长中文文件，分别在完整深层目录的实验方案甲/乙中，正文为Alpha/Beta source且均在第2行命中。普通Work Chat完成后再串行进入同项目Side chat；没有创建Task/执行成员或委托。

- `01-before-side-expanded.png`：319构建、380px Side chat，完整路径重复文件名/行号，次级说明占三行。
- `02-after-side-expanded.png`：修改后来源主标签完整，次级目录占两行，目录尾部甲/乙均可辨认；没有用省略号抹掉区别。
- `03-alpha-file-open.png`、`04-beta-file-open.png`：两条来源分别打开正确文件，选中第2行。返回侧聊时来源保持展开。
- `05-keyboard-source-focus.png`：来源保持清晰键盘焦点；此时未展示tooltip，不能把它当完整提示证据。
- `06-complete-location-tooltip.png`：标准Tab/Shift+Tab后显示完整路径、文件名/范围及Local search提示。

上述六张截图均实际呈现并人工查看。两份layout-facts只记录只读排布数据：此例单条高度约69.49→53.29px。查询包含保留的参考历史节点，不能把全部查询行称为视口可见，也没有DOM（Document Object Model，文档对象模型）断言、截图比较或像素验收；结论以实际截图中的当前来源为准。

## 模型与持久化事实

两轮正常开发`/ui18289`、`/ui18290`，授权auth与完整models成对，并分别通过usable/projected/实际gpt-6.1-sol流式预检。修改后输入文件继承相同相对路径、内容及修改时间排序；侧聊请求明确只搜索一次，因此两轮的请求数量不同，不能称为相同模型执行轨迹。

基线10次、修改后9次Provider请求全部200/EOF（End of File，流结束），包含预检及内部请求。`actual-source-facts.json`核对闭合数据库与实际磁盘：基线3个实际search_code请求和1个继承参考请求副本、8条来源；修改后2个实际搜索及1个参考副本、6条来源。两轮的来源范围和文件内容一致对应真实第2行。

相同callID/时间的副本来自既有Side chat原子fork参考历史契约。Session metadata列出inheritedMessageIDs，Session.fork复制已完成Message/Part。它不是一次新的物理执行，不能单凭工具表行数或模型自述计算调用次数。本轮没有调度、恢复或终态机制更改。

## 验证与收尾

纯UI改动，没有新增或运行UI自动化测试。Overlay类型检查14160实际exit0；正常构建78170实际exit0，52.31秒，入口`main-Da29iHH7.js`。当前文档、架构索引与renderer公共面检查通过。原生POSIX文件、自定义外部标题及UNC根路径没有本轮新页面样本；对应分支沿现有路径语法和完整位置契约保留，不宣称这些分支获得视觉资格。

基线原启动97096实际exit0、Native72116/Host71168；修改后原21395实际exit0、Native70244/Host78672。页89/90关闭，两端口及复制的凭据配对分别清理。脱敏实际日志保留4964和6103行，未知时间行均0，压缩包可还原脱敏字节。

第二轮归档辅助脚本误沿用第一轮证据目录，五个本轮生成文件移动完成后写收据冲突。已修为从本轮launch-owner读取settlementEvidenceRoot，并以明确的“已完成移动补收据”模式重跑：核对原生进程终态、五个目标文件的出生时间和精确路径，生成live-02独立收据，没有重复移动或覆盖live-01事实。`receiptRecoveredAfterMove=true`明确记录此次恢复；应用、模型和清理的原执行收据没有改写。

本轮改善真实长文件来源密度，原Research Studio子侧栏完整流式生命周期仍未覆盖。继续单agent，持续goal保持active。
