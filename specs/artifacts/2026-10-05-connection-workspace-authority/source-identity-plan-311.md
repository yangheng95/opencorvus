# 311 来源文件身份与共享路径语法

## Recall

用户要求持续自主改善 Sources、UI（User Interface，用户界面）与功能，最新明确单 agent。上一轮 310 已实际提交、推送 8bb0ce80d353ff8a7de0ec95887af283efc473a4，修复目录关系；原执行器全部结束且工作区干净，本轮开始复核为 progress。总体 goal 保持 active，不执行旧目标中的多 agent 措辞。

已读 310 Recall、SourceParts、file-workbench、FileEditorPane、FileExplorerPanel、workspace 的文件引用入口、project-directory、后端 file/source/read/list 与当前 07-panel；已全仓搜索 relativePathFrom、各 normalize/join/descendant 路径函数及 openFileEditor/openSourceFileEditor 调用。现有 file-workbench-revision/mutation 测试是纯状态和传输契约，不包含页面或组件渲染；没有引入或执行 UI 自动化测试。

## 根因和影响分析

可观察风险：带前导空格的实际文件名经 openFileEditor 的 trim 后可能打开另一个已有文件；POSIX（Portable Operating System Interface，可移植操作系统接口）合法反斜杠文件名被编辑器和文件树两个独立 normalize 实现改成目录分隔符。SourceParts 同时 trim 路径及标题，按所有斜杠拆文件名；会进一步掩盖显示差异。310 只修复目录比较，实际编辑器目标仍在后续步骤被改写，旧修复不能根治。

后端文件节点返回当前服务端原生 path.relative 结果；实际读取由 File.read/readSource 使用服务端 path 语义，故浏览器不能无条件套用 Windows 分隔符。官方 [Node.js path](https://nodejs.org/api/path.html#windows-vs-posix) 确认宿主路径语义差异，[Microsoft 文件命名](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) 列出 Windows 分隔符及文件名约束。实现不引入 Node 依赖到浏览器，复用已证实的绝对项目路径语法判断。

范围：来源文件标签/打开、文件编辑目标/标题与重命名后目标、文件树节点/选择/目录关系及输入路径。提取已重复的服务端路径语法与项目相对路径标准化为一个纯工具，Windows 按项目目录统一斜杠，POSIX 保留反斜杠，文件名字符保留。删除被替代的重复 normalize 实现。原有绝对路径只读、行号、权限/realpath、API（Application Programming Interface，应用程序接口）与调度不改；如出现并发/恢复异常立即共享机制横审。项目目录选择的全局 trim 契约与自然语言路径解析不在本次文件名修复内，不能宣称所有目录身份问题已解决。

## 实施与验收

先在当前构建的独立正常 /ui18277 复现：隔离项目同时有“ Source note.md”和“Source note.md”，内容分别明确标识文件；正常单会话真实 read 前者，再点击真实 Sources，截图查看实际打开正文。测试文件是普通隔离项目输入，禁止合成 Source 消息或 UI fixture。记录真实行为后才改生产代码。

实施公共纯函数、服务与消费端；路径/目标/实际重命名回执增加聚焦正向数据契约，删除触及测试中以未发生为核心的断言而保留明确状态/错误契约。正常构建后独立 /ui18278，真实读取带空格文件、直接 Sources 打开、文件树打开与普通文件重命名回读，截图人工复核。仅操作自己的文件、页与服务。Windows 页面不能冒充 Linux 原生验收；POSIX 资格仅限实际纯函数与状态/传输契约。

两轮均已授权 OpenAI auth 与完整 models 配对，启动前各自验证 usable/projected/实际 gpt-6.1-sol 流式；NativeService 固定 600000ms、20 请求。原执行器实际 join、独立 Native/Host/port/pair 清理后归档。根/月/目录索引同步、当前文档检查、范围提交、fetch/merge、完整待推送集合检查和普通 push。未满足项如实保留。

## 修复前事实

live-01 实际模型读到带空格文件正文“Space-prefixed source”，点击 Sources 后编辑器实际显示另一文件“Different ordinary file”；03-wrong-file-loaded.png 同时展示两者。before-targets.json 直接调用当前服务也记录前导/尾部空格和 POSIX 反斜杠被改写。5 次流式请求均 200/EOF，页77已关闭，执行器37324实际exit0，Native31048/Host71768/port18277/配对凭据已独立清理。之后才修改生产代码。

## 视觉复核后的同链路补充

live-02 已确认 Sources 打开正确带空格文件、文件树真实重命名保持空格且编辑器跟随、普通同名文件独立打开。但标题仍为被裁剪的 Source note.md，路径为原始“ Source note.md”，因此出现重复行。全仓 fileSource 调用仅 read 的图片/PDF和文本两入口及持久化测试；直接根因为 fileSource 对 read 传入的标题调用 trim。补充修复该唯一发布函数：非空标题保留原值，空值继续取实际 basename；URL 来源标题策略不改，path/sourceId/range 不改。新增纯 payload 正向契约，再用 fresh live-03 /ui18279 真实 read 验证标题/路径一致与正确打开。保持同一600000ms/20请求资格，不延长或重启已结束轮次。Linux原生、自然语言解析和外部编辑器启动的既有空白处理未获得本轮端到端资格。

live-03 证明上述发布函数修复仍不完整：实际打开正确，标题仍被裁剪。进一步跟进 processor/source-persistence 对 Message.SourcePayload.parse 的调用，发现唯一 SourceFilePayload schema 也 trim path/title，并被 SourceFilePart、SourcePart 和消息投影复用。现移除这两个字段的转换，保留 min(1) 非空验证；schema 形状和公开生成类型不变，不改 URL/Document 来源。补实际 schema 输出和持久化回读正向测试。最终新轮次 live-04 /ui18280 验证完整发布—持久化—呈现链。前三轮失败/中间截图保留，不声称它们证明最终标题已修复。

## 完成的本轮范围

live-04 实际标题/路径持久化保留空白，页面单条来源且打开正确正文；60项数据与持久化测试通过。四个原服务执行器实际exit0，独立进程/端口/配对清理完成。[完整证据与未覆盖项](source-identity-311/README.md)。持续目标active，按最新单agent指令继续。
