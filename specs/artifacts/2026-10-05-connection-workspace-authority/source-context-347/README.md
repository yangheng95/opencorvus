# 347 连续来源的目录密度

[Recall与根因](../source-context-plan-347.md)。单agent，未创建产品Task成员；通过真实普通Side chat的生产search_code生成26个Source。

## 改动与实际结果

原来每个文件命中行都会显示完整目录，同一文件连续24条来源因此重复同一长路径。sourceFileCaption继续拥有标题与位置关系的唯一判断，现在返回kind/text；仅同一相邻Source组中、相同完整path且相同directory caption的后续条目省去重复次行。首条保留目录，换到另一文件重新显示。附件标记及自定义title所需的location说明继续逐条显示。来源身份、计数、顺序、文件名/行号、完整Tooltip、可访问名称、复制和打开均保留。

真实02实例生成“实验方案甲”24行、“实验方案乙”2行，同名文件、不同目录。页面136始终使用同一份真实搜索结果，没有重造来源或修改消息。

- 01-before-repeated-directories.png：26条来源，长目录在每条命中后重复，甲/乙区别在路径末尾。
- 02/03：同文件后续行紧凑排列；乙到甲的边界仍分别显示完整目录，25 more sources计数保留。
- 04：Space复制甲文件第20行，实际clipboard保留完整路径和:20；Tooltip仍显示完整位置。
- 05/06：真实打开两个同名文件，分别高亮甲文件第20行（甲记录19）和乙文件第2行（乙记录01），均只读。
- 07/08：返回仍为同一展开组，列表中部可以连续阅读更多来源行。

8张实际截图已人工查看；没有UI自动化测试、DOM断言、源码文案断言或截图基线。未独立实测附件、自定义title或更多路径语法，也没有用普通Side历史结果宣称子Dock全部实时Rendering已解决。

## 运行与工具链

01在Native Host spawn-admission失败：另一任务版本提升到0.1.25，使现有原生helper需要构建，而隔离HOME无rustup默认工具链。Host51816出生身份已死，端口空闲，auth/models未移交，原exec实际exit1；没有Provider预检或目标服务成功的声明。

读取生产helper解析器及仓库prepare-test-process-supervisor后，用现有准备器解析已安装cargo/rustc、在其独立CARGO_HOME/TEMP构建当前helper；22139实际exit0。新私有wrapper在隔离启动前先走准备器，再进入原NativeService流程，不改变用户全局Rust设置、不替换生产进程管理器。原失败及普通输入文件保留。

02沿18324/ui、固定600000ms、16请求预算重新验收；预检分别确认凭据usable、完整models projected和实际gpt-6.1-sol流式。6次实际请求均200/EOF。结束前关闭页面、正常shutdown，原启动15764实际join0，NativeService物理与Provider资格通过，精确Native/Host/output/request/配对清理有原始receipt，自有native文件按出生归档。

基线构建60521 exit0、main-Cm-evkKa.js；after构建54594 exit0、main-DbppdFkA.js；CSS保持main-Dg1zdEjr.css，overlay typecheck11125 exit0。另一任务的0.1.25版本/changelog/生成文件修改保持原状，不混入本轮交付。

02实际Native寿命577726ms，在原预算内结束；docs:check通过345 ops/25 groups。关闭后的真实数据库保留26条Source，两个文件分别为24与2个准确范围；文件完整文字与人工输入相等，实际复制值为甲文件完整路径加:20。89份监督链的原始文本整体压缩保存，私有原件保留；50份文本与压缩解码内容扫描无凭据。
