# 下载文件名 Unicode 空白边界调查

## Recall

用户要求持续按批次并行调查 UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能和缺陷，先根因/影响分析落盘，再实施、真实桌面交互/截图人工复核、聚焦正向测试及获授权时的 Sol 端到端验收，清晰提交、上游合并与正常推送后继续。上轮7ec6207d2和893e80be3已正常推送；本轮main/upstream 0/0、暂存为空，原177条用户状态精确保留。先重读上轮Recall，终端页面/复制/下载仍待本批已提出的凭据授权，不重复询问、不使用凭据。

两名只读子代理分别调查下载身份和媒体恢复，没有改文件、运行UI自动化或再次委托。主代理已核对artifactFilename/集合命名、file-download、FileEditorPane、ArtifactResourceDownload、ArtifactActions、MCP下载、会话导出、Spreadsheet adapter、OriginalFileDownload、当前07-panel、10-15 unicode-workspace-path及11-01媒体引用/命名记录。全仓检索artifactFilename/downloadBlob定义与全部调用；共享命名只有这一实现。相关artifact-export和file-download-authority是纯数据/Blob服务测试，没有组件、DOM（Document Object Model，文档对象模型）或快照；不新增或运行UI自动化。

## 根因与影响（修改前）

已用真实38926开发 `/ui` 复现：本批新隔离项目创建普通report.txt、首/尾NBSP（No-Break Space，不换行空格，U+00A0）和首全角空格U+3000的四个独立文件，各有不同原正文。中文Explorer通过原title身份打开首NBSP文件，实际正文IDENTITY_LEADING_NBSP。点击产品下载按钮，浏览器真实下载事件返回普通report.txt，落盘回读仍为该首NBSP原正文。before-download.json保留实际文件名码点/正文，01截图已人工查看；不是仅根据纯函数或可访问名称猜测。可访问树会折叠空白，因此交互使用实际DOM中的完整title，未改变页面或伪造下载。

直接触发为FileEditorPane把原fileTitle交downloadBlob；后者调用artifactFilename，而共享函数对basename做泛化.trim()。这将合法Unicode空白当自然语言空白清除；集合命名还会把原本不同的NBSP/普通文件变成冲突并追加后缀。原FileEditorPane、路径准入和文件读取保留原身份。旧Unicode路径修复只处理路径验证，11-01导出工作处理文件名冲突/引用编码，未修这一下载投影，故原源文件和正文正确但保存名被改写。

已查阅[Microsoft文件名空白说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/file-folder-name-whitespace-characters)和[HTML下载标准](https://html.spec.whatwg.org/multipage/links.html#downloading-resources)。前者明确非ASCII首尾空白由Windows保留；后者说明download值是建议文件名，浏览器仍可能按平台或冲突调整。因此修复目标是保留产品合法原名，并用真实下载检查本机结果，不承诺覆盖浏览器自身的全部文件名策略。

影响覆盖所有共享Blob下载、Interactive Artifact直接/伴随导出及引用、会话/Task Artifact/MCP下载的命名。OriginalFileDownload直接使用原名，已有正确路径可供对照；不引入新下载旁路。原basename提取、非法标点/控制字符替换、空名默认、集合冲突分配、文件字节与读取所有权保持。不涉及接口签名、SDK（Software Development Kit，软件开发工具包）、权限、配置、模型工具、数据库/持久格式或迁移。没有调度/队列/唤醒/恢复/终态异常证据。POSIX（Portable Operating System Interface，可移植操作系统接口）反斜线和浏览器平台字符替换不在本批扩展。

## 实施方案与验收

在唯一artifactFilename把泛化.trim替换为仅清理原ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）空白集合：制表、换行、垂直制表、换页、回车与普通空格。合法非ASCII空白原样进入现有替换和集合分配。没有第二命名器、旁路或兼容旧投影。既有空名artifact和非法字符规则保持；不因不可见字符而主动改写真实文件身份。

先补纯数据正向用例，断言首/尾NBSP、全角空格、窄NBSP、BOM（Byte Order Mark，此处作为文件名字面字符）等原名，普通ASCII清理/空名/非法字符合同，独立名称集合及伴随媒体引用。旧实现先取得明确失败，再改唯一函数，运行artifact-export聚焦用例、类型/语言/普通构建。原下载Blob和其他服务没有变动，不用DOM桩测试按钮。

after使用同一自有项目、新38927开发实例和新构建，真实分别打开四文件并点击下载，回读实际basename码点和原字节，截图人工确认正文归属。浏览器可能因已有同名文件加后缀；本批只移动经本次下载事件和精确正文确认的自有下载到本批私有临时目录，保全字节，不删除或移动用户已有文件。页面不注入模拟消息、下载响应或命名标签；模型请求额度0，凭据不复制。

风险为误改ASCII规则、集合冲突或引用不匹配、浏览器落盘调整。用同一共享函数、原正向合同和实际下载事实验证，不能以源码或类型检查代替页面。最终正常关闭本人标签/实例并消费原启动句柄，文档与架构检查、范围提交、上游同步及正常推送，再继续下一批。

## 实施与结果

新增原名/ASCII清理/独立集合及Notebook/Presentation伴随引用的正向用例，在旧实现运行为33通过、10失败、49次断言；失败覆盖7种Unicode空白原名、独立集合和两类引用。随后唯一artifactFilename仅将泛化trim替换为原ASCII空白集合清理，保留其余提取、替换和分配规则；未改下载请求或Blob字节。

## 真实验收否证方案，撤回实现

第一版修改的43项/49次断言、类型/语言/普通构建通过，实际38927加载main-DBw6qmmE.js；但真实首NBSP文件点击下载后为 `_report.txt`，正文仍为IDENTITY_LEADING_NBSP。02截图和attempted-download.json保留未通过结果，不作为原名保留通过证据。该反例已经否证“产品层保留即可实现原名落盘”的方案，故不继续用另三例或单测分数宣称成功。

继续进入生产原件路由GET /file/download：响应Content-Disposition为 `attachment; filename*=UTF-8''%C2%A0report.txt`，原正文正确；同浏览器真实下载事件仍保存为 `_report (1).txt`（本次已有同名文件触发自动后缀）。因此真实浏览器命名层独立于产品helper，完整原件响应也不能保留首端NBSP。维护方[Chromium当前文件名规则](https://raw.githubusercontent.com/chromium/chromium/main/base/i18n/file_util_icu.h)说明首尾空白/点会按替换字符处理；与当前实测形状一致，但没有核对当前浏览器精确引擎提交，不把源码版本当成实际浏览器版本证据。HTML标准也保留用户代理调整建议名的权利。

如果只保留Unicode原名，Notebook/Presentation引用会指向原空白名，浏览器实际伴随文件却可能变成下划线名，破坏此前已经验证的集合/引用一致性。本批不能以扩大纯函数合同掩盖真实路径失败，也不增加临时ZIP、另一下载通道或改浏览器保护绕行。已审查精确差异后，用patch撤销本批helper、测试及架构候选；这三文件的最终Git差异为空，原32项/36次导出断言重新通过。普通构建正在按恢复后的当前源重新发布，不留下未提交的另一实现。

**未达成：合法首尾空白的精确浏览器落盘名、四文件原名全部保存及伴随媒体完整名称对齐。** 原产品trim和浏览器规范化是两层事实，完整方案必须先明确跨平台下载/导出命名合同并覆盖真实落盘与引用，再实施；本批只提交调查证据，不声称修复。当前目标继续推进其他独立缺陷，不因这一局部限制将整个持续目标标记完成或阻塞。

## 资源收敛与额外核对

本人标签10/11关闭，两次公开shutdown均200，原启动句柄16085/93660退出0、prompts为0；未复制凭据或调用模型。三个本次下载事件对应的文件都在精确正文核对后移入本批私有临时目录，原字节保留；没有移动或删除其他用户下载。

四个原report文件保持原名/字节。首次完整打开新增.opencorvus、.gitattributes、.gitignore，已横向核对为既有维护：Instance.bootstrapContext→ensureGitProjectMetadata和TerminalProfile默认配置，目录无.git，规则内容精确等于11项binary规则及.opencorvus/.r/忽略项。已读相应实现与11-01项目身份记录，未见git init；精确触发请求未知，不能凭创建时间把它归为GET /file或自动初始化Git的缺陷。没有为这一正常维护改产品。

撤回后的普通构建已退出0、renderer检查通过，重新发布当前893e80be3对应的main-CVvYLjv7.js；三份产品/测试/架构文件最终差异为空。docs:check为352操作/26组、架构索引20文档及差异空白检查通过。本批最终只包含调查规格、索引及实际截图/下载JSON；不包含被否证的实现。
