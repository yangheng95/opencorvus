# 文件完整字节的文本准入

## Recall

用户要求持续分批并行调查界面体验、功能与缺陷，先完成根因/影响分析并落盘，再实现、真实桌面交互和截图人工复核、聚焦正向功能测试，必要时已授权 GPT-6.1 Sol 端到端验收，提交、合并上游与正常推送后继续下一批，直到明确停止。禁止 UI（User Interface，用户界面）自动化测试；非 UI 修复必须明确正向合同。不得操作用户现有进程，不得混入其它任务变更。

上一批 Composer 模型名称搜索已提交 b3f5c6ad3，真实桌面截图、Overlay typecheck/私有构建通过；Bun1.3.14不满足仓库1.4.0要求，已定位既有隔离 `.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe`，仅为命令设置 PATH 后重跑正常 push。当前其它任务在 config/network-proxy/NetworkPanel、text-file/text-file-page、CHANGELOG与索引有更改，完全排除本批文件所有权。

先前 functional_audit 子 agent 已提供只读调查；未再次委托，未修改文件。已读 File.read/readSource/readResolvedContent/writeText、FileEditorPane writable合同、file-attachment-editability、server/file-read-identity、server/file-save-conflict、file-source-content、374/375历史记录、当前07-panel文件与附件契约。全仓搜索 isUtf8、fatal UTF-8解码、NUL字节判别：expert-squad/registry已用node:buffer isUtf8；package-inspection与task-artifact包含完整UTF-8及NUL合同；tool/text-file的isBinaryBytes只采样4KiB，属于工具展示启发式，不等同无损编辑资格。

## 问题、触发与根因

File.readResolvedContent使用扩展名集合与 MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）顶层来判断内容；ODT/ODS/ODP/EPUB及未知扩展等application类型可能进入bytes.toString('utf8')，即使字节非法仍获得原字节revision。FileEditorPane只认type=text且存在revision，从而允许编辑。writeText在锁内再读同一错误分类；revision与原字节匹配后，以UTF-8写回替换字符，造成有损保存。

已有375只覆盖.bin，374只修附件身份/只读边界，未验证实际字节。只增加扩展名仍遗漏无扩展、未知扩展和伪装.txt。子agent实际纯函数探针显示5000个ASCII后接ff，旧4KiB采样判为文本，UTF-8往返从5001变5003字节；这是局部证据，尚须真实File及HTTP（Hypertext Transfer Protocol，超文本传输协议）改前失败确认。

影响普通项目文件读取/保存及绝对来源读取；附件已无编辑revision，仅影响乱码呈现。PDF（Portable Document Format，便携式文档格式）/图片走原base64专用预览，保持原合同。没有调度/队列/唤醒/恢复或执行轮次异常证据，不改Task/Mission/Session。没有协议字段变化或数据迁移。有效UTF-8文本、BOM（Byte Order Mark，字节顺序标记）、CR/LF换行和空文件须继续原样读取保存。

## 实施前方案

唯一readResolvedContent的原字节读取后、UTF-8解码前，使用既有成熟node:buffer isUtf8对完整bytes验证，并检查NUL。非法UTF-8或NUL返回已有明确binary响应；现有writeText通过同一reader自然返回FileInvalidPathError。保留早期PDF/image/已知二进制分支，不猜测或转码其它编码。该完整检查在现有已全量读取的bytes上运行，新增一次线性扫描，无第二次磁盘读取。

实施前独立file_text_review还发现同合同的写入输入边界：旧writeText允许NUL正文，修后会出现保存receipt是text、重读却binary；孤立UTF-16 surrogate写成U+FFFD，receipt却保留原字符串，已有数据/回执不一致。该证据来自writeText原代码与真实Buffer转换探针。方案因此共用一个私有完整字节文本准入函数供reader与writer；写入前构造UTF-8 bytes，须满足该准入且回解与输入字符串逐字相同，否则已有FileInvalidPathError明确返回内容不是无损UTF-8文本。成功写入和revision都使用同一bytes，回执字符串保持用户原文。维持原路径/revision/附件错误顺序及单一锁内提交，不新增编码猜测或UI门槛。合法U+FFFD字符本身有效，必须正向保留。

依据：[Node Buffer isUtf8 官方文档](https://nodejs.org/download/release/v22.17.0/docs/api/buffer.html#bufferisutf8input)确认空输入有效、完整UTF-8验证；同文档说明普通UTF-8解码会产生U+FFFD替换字符。沿仓库已有runtime兼容层，不引入新依赖或推广到其它子系统。

## 验收与交付

先新增正向合同并经现有隔离测试runner获得改前失败；覆盖ODT/未知/无扩展/NUL伪装.txt及4KiB后非法字节/NUL，项目/来源读取明确binary响应；实际PATCH返回FileInvalidPathError并保留准确原文件内容。incoming NUL/孤立surrogate返回明确错误，合法U+FFFD、Unicode、BOM、CRLF、无扩展、空文本正常读写。使用真实文件与现有HTTP peer/Server route，不mock生产判别，不用无效摘要验收。

聚焦回归原附件/PDF/image/来源与保存precondition合同。真实开发模式新隔离端口18432前态、18433后态，通过/ui打开本任务生成的二进制与文本文件，截图人工复核不可编辑说明和文本正常保存；不伪造会话/Source或UI内部状态。本批不触及LLM（Large Language Model，大语言模型）执行，无须Provider请求。

新spec同步根/月索引及相关架构，运行docs:check、architecture-index及必要类型检查。root负责审查、真实页面与范围提交/正常推送；实现子agent限file/index.ts和新正向测试，不得再委托或提交。所有不足按实际记录。

## 状态

根因与范围分析已完成，file_text_review复核特殊预览、附件标签/只读、Git diff早返回、BOM/空串合同均保持；限定为现有可文本候选，不放开既有.bin/.wat/.ll分类。

18432真实开发服务通过现有/session与/coding/chat/session创建空会话，没有模型请求或合成消息；UI打开该项目Chat→右dock→Files→binary-disguised.txt。原11字节504B03040000FFFE414243被读成type=text并获得revision；真实编辑器显示替换字符和可编辑正文。实际追加“ review”再Save，磁盘成为504B03040000EFBFBDEFBFBD41424320726576696577（22字节），原FFFE被有损改写。两张截图与before-save-bytes.json记录实际交互和字节事实，位于../../artifacts/2026-10-13-file-text-admission/。仅操作本任务生成的文件。后态先恢复该受控输入，再启动当前代码比较。

上一批b3f5c6ad3已经Bun1.4正常全部push hooks并远端确认；首个1.3.14失败保留记录，未绕过检查。

## 实施与验证结果

唯一File reader/writer共用完整UTF-8/NUL检查；writer在原路径/只读/revision检查后验证输入，无损UTF-8 bytes用于实际atomic写入和revision回执。独立file_text_review复核未发现阻塞：所有旧错误优先级、特殊预览、附件和source/diff合同保持。没有UI代码或接口schema改动。

新增26项正向功能合同经原隔离runner改前7pass/19fail（含实际HTTP原PATCH200），改后26pass/0fail、150断言。file-source-content、file-attachment-editability、server/file-read-identity、server/file-save-conflict四份聚焦回归连同新增合计39pass/0fail、228断言；覆盖真实文件、HTTP、peer进程与重启后的保存冲突合同。完整原始输出压缩归档到证据目录，没有UI自动化。opencorvus typecheck session21165 exit0；docs:check345operations/25groups、architecture-index18documents、diff --check通过。

18433同项目的实际桌面打开原二进制：显示Read only与不可编辑说明；打开notes.txt后实际追加“保存复核 ✅”、Save及Reload。人工截图确认正文正确；磁盘准确保留UTF-8 BOM、中文/emoji、两段CRLF及追加文本，原二进制11字节保持。四图与字节JSON（JavaScript Object Notation，数据交换格式）均在[证据目录](../../artifacts/2026-10-13-file-text-admission/README.md)。18432/18433均通过正常/shutdown自然exit0，自己的页面关闭。没有Provider请求。仅Windows英文深色1280×720浏览器已验收，原生窗口/其它平台未验证。

当前只余范围提交、fresh fetch/merge、正常push。其它任务的Unicode、代理和日志改动继续保留，不混入此提交。
