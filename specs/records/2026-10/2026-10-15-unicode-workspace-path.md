# 非ASCII空白文件名阻止Task创建

## Recall

持续单agent自主迭代；425已提交推送72c2240ef，426取消围栏修复已有11项正向测试/36断言通过，尚未提交，真实Stop验收被本次新产品HTTP500阻止。只有本任务426源码/测试和对应spec索引修改及原有.bun、packages/opencorvus/bun未跟踪；保留。用户授权真实OpenAI/gpt-6.1-sol，完整auth/models配对、所有请求流式，禁止凭据进入日志或提交。本批不新建开发或产品成员、不清库、不发布、不创建分支或worktree。

## 原始证据和已读资料

正式CLI向18573 POST /task创建“取消原因回归426”，requestID=0f0e9c21-3f31-4140-b32a-c57fb8eb8de0，实际HTTP500；服务requestID=2984f72e-de48-47a4-b351-64fc24756503对应ZodError，files[6].path与files[8].path被拒为非canonical project-relative path。只读engine_task按原requestID查询实际为空，不把CLI退出1当作Task已被接受。该scope已公开shutdown200、原19738 join6b30e0 exit0并完成物理/配对退休，自有页3关闭、viewport reset；无Task或Stop成功资格。

已读Task create→prepareTaskProcessBinding→executionCapsuleSourceTreeDigest→SourceTreeSnapshot→workspaceTreeDigest及WorkspaceTreeSnapshotSchema；Plugin TaskArtifactRelativePathSchema唯一重用SDK ProjectRelativePathSchema；SDK project-path.ts与插件别名、artifact consumer、expert-squad authoring验证和package exports；当前跨平台路径/不可变workspace tree合同及426 Recall。全仓检索定义/调用/同语义入口及相关测试，尚未改SDK生产实现。426围栏修改不在此链中，不能把500归因取消修复。

直接根因：源树捕获已经保留Git枚举的实际文件名，公共相对路径验证却用value !== value.trim()排除所有首尾Unicode空白。412项目此前422/423已真实创建NBSP开头的独立文件，并通过文件Sources/正文打开证明身份；它们与无NBSP文件是不同文件。Task创建在持久行写入前捕获原生模式初始树，也必须经过该公共schema，于是可阅读项目无法创建Task。不是凭据或模型不可用，也不通过删除、改名、过滤或忽略这些文件规避。

权威资料：[Microsoft Windows文件名空白说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/file-folder-name-whitespace-characters)明确普通ASCII空格与其他Unicode空白处理不同，非ASCII首尾空白保留，Win32枚举可读取。现有ProjectRelativePath合同承诺精确原始路径，不应把文件身份当自然语言清理。仅修正泛化trim，保留当前ASCII首空格、所有段尾ASCII空格/点、控制字符、绝对/驱动路径、反斜线、空段、点段/父段、NFC及Windows设备名约束。NFC和其他现有便携限制不在本次改写。

## 影响、公开合同与风险

唯一SDK predicate被Plugin重导出，WorkspaceTree、Task Artifact、artifact catalog、包authoring及metric cwd共享；不另建Source-only validator、fallback、改名映射或平行协议。语法扩大只允许本来能安全标识原文件的非ASCII边缘空白，路径遍历/根边界规则仍独立成立。SDK source与分发dist必须通过正式build同步，不靠源码测试冒充分发运行行为；OpenAPI应继续当前唯一生成。当前持久树协议仍workspace-tree@1，字段/编码/排序与旧有效载荷没有变化，不要求新schema版本或清库；修复输入误拒绝，不重写已交付迁移。风险是新接受字符串在消费端再次trim或拼接，须横查实际消费者并以真实snapshot/Task创建/Source保真验证；不能只把schema.parse通过当端到端。

## 实施前方案

1. 保存原SDK predicate，先用正向测试通过公共Plugin/SDK path和WorkspaceTree codec验证NBSP/全角空格的精确值；真实Git项目SourceTreeSnapshot保留原文件名与原字节，对照普通同名文件。危险路径输入映射为明确ZodError/issue合同，禁止以false或not为核心断言。修改前实际失败日志保留。
2. 只把过宽trim约束改为明确ASCII首空格约束，其他安全与规范条件保持。全仓消费点中如存在对已接受身份再次trim，先分析并修唯一当前路径，禁止仅靠源头schema放行。SDK正式build/Plugin必要build，确认生成差异只在本合同；后端聚焦正向测试、类型与当前文档检查。
3. 新建独立18575 NativeServiceCancellation scope，600秒/180秒无活动/最多12实际流式请求，auth/models重新完整配对并预检。使用原创建请求和相同requestID重试，通过正式CLI实际接受与真实长文活动后点击Stop；Task/Message/原取消事件及物理收尾同时完成426与本批验收。不复用已退出服务、不伸长旧资源租约、不删除合法文件。
4. 所有实际失败和修正原件保留，原真实用户库不接入；对应architecture、索引和无凭据证据同步。426与本批均属Task真实创建/取消链，按实际验证完成范围清晰的提交、fresh fetch/merge、完整pending审查和正常push；最终说明必须区分确定性围栏合同与本次真实Stop所覆盖窗口。

## 确定性复现与实施决定

正式后端checker原37fea4 exit1：20项中16 pass/4 fail。三个首尾NBSP/全角空格公开path输入被误拒，嵌套同类空白本来已通过；真实Git source snapshot保留原始文件名/字节，进入WorkspaceTree canonical codec后失败。所有15项危险/非便携输入当前均返回ZodError。该前后不一致与真实Task创建500吻合。source snapshot schema的字段、排序和字节编码均正确，错误只在唯一SDK predicate过宽trim条件；按既定单一predicate方案实施，不另建workspace validator。首ASCII空格仍明确拒绝，其余原约束保持。

## 实施和端到端结果

唯一生产改动是SDK project-path.ts把泛化trim比较改为显式startsWith ASCII空格；其余路径约束保持。正式SDK build原34439 join8280a6 exit0，同步公开dist，OpenAPI生成及其他tracked生成文件没有额外差异。正式后端runner原63f682 exit0：20项/20断言通过，覆盖公开Plugin/SDK路径、15种输入到明确ZodError的合同和实际Git source snapshot到公开canonical codec的原文件名/原字节。根typecheck原2e850f覆盖8包通过；无UI自动化测试。

同一个原创建请求和requestID=0f0e9c21-3f31-4140-b32a-c57fb8eb8de0在独立18575服务经正式CLI重试，真实接受为tsk_g00VY2jUZd007UlLTDM5，最终只读查询只有一条对应Task；首次500的零行观察与原请求均保留在426证据。没有删除、改名或过滤原文件来通过。真实gpt-6.1-sol持续流式输出后人工Stop，Task与消息沿原请求终态收敛，实际命中426修复的取消围栏；Provider、物理回执及配对退休详见[426最终证据](../../artifacts/2026-10-15-cancellation-activation-provenance/README.md)。

真实项目生产Git源树捕获再经公开workspace-tree@1 codec成功，共9文件；source-material.ts按原423材料正向验证首NBSP文件与无NBSP文件各自完整原内容，另验证原422尾NBSP文件及原首行。source-material-result.json保留三个精确path、Unicode code points和原始公开QA内容；没有哈希门槛、文件清理或schema版本变化。人工实际点击原Source，01-original-source-identity.jpg显示IDENTITY_LEADING_NBSP_423编辑器正文，证明Source仍指向原文件而非无NBSP同名文件；截图已人工查看。

与426共同提交单一Task创建/停止链的两处根因修复；不修改既有已交付迁移、不增加双源验证器、不发布。15种受约束输入的明确错误输出、原文件身份和真实Task接受均保留，不能把语法放行单独包装为端到端通过。文档/架构检查在最终记录落盘后执行。

最终docs:check原6c6426 exit0，345操作/26分组；architecture-index原3fdc2a exit0，20文档及链接通过。必要原件已归档并执行解压文本的真实凭据披露复核；完整Task/Provider/物理资格集中426，不重复复制数据库或私有配置。
