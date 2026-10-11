# 318 本地搜索的文件名与结果边界

## Recall

用户持续要求改进Sources、UI/UX和功能，当前明确只使用单agent。317已推送6d61b1cbedb6147ce3914fe3f8eaa878eca226ac，起始干净；上一轮是有代码/真实路由/页面及推送的progress。继续goal，不执行旧目标中的Astra委托文字。

本轮调查搜索与来源定位的基础数据。验收要求是返回实际文件身份、行号和命中文本；合法文件名或尾随空白不能被格式分隔符改写。保持原忽略规则、路径权限、Task/Conversation执行归属、累计输出预算、总deadline、部分成功语义和原错误原因。不把单元或伪进程检查称为真实Provider端到端。

## 根因、调用点与依据

已读317 Recall，tool/grep的全部路径、现有bounded执行测试、file/ripgrep的文件枚举/JSON搜索、runtime/ripgrep、tool.define结果流程、engine包装与CLI/File路由调用。全仓检索SearchCodeTool、search_code、Ripgrep.Match/Result/searchHost与分隔符。UI测试未涉及。

当前search_code使用`-nH --field-match-separator=|`，按竖线拆文件名与行号。POSIX允许文件名包含竖线，故存在身份错分；枚举按换行切分，换行文件名也会被拆散。Windows能否在当前原生文件API中创建这些名称仍待实际确认，不伪称已验证POSIX完整调用。另一个可直接在Windows重现的问题是`output.trim()`删掉最后一个命中行的尾随空白。

公共Ripgrep.searchHost已经使用JSON，但解码是内部单独逻辑，当前schema仅接受text字段。官方JSON格式同时定义text/bytes及context；必须考虑真实字节编码，而不是让改造引入新的普通文本兼容故障。共享files生成器也按换行拆分且逐块toString，UTF-8字符可能跨chunk；本轮同时采用NUL文件边界和流式解码。没有调度/终态新异常，现有Process与ProcessSupervisor的归属、终止/settled机制保持。

权威依据：已查看安装的ripgrep14.1.0帮助，以及[官方grep_printer JSON协议](https://docs.rs/grep-printer/latest/grep_printer/struct.JSON.html)。它用JSON Lines明确编码路径、行、匹配偏移和text/bytes；文件列表使用ripgrep的`--null`选项。SDK/File搜索仍保留当前应用层text DTO（数据传输对象），不另建平行工具或旧分隔协议fallback。

## 实施方案与待证据项

先以真实SearchCodeTool和实际ripgrep验证尾随空白、合法特殊文件名/编码。搜索统一复用file/ripgrep内的JSON解码器；只消费match，保留路径/行号/内容，正文仅去单个行终止符。应用层路径必须可准确表示；不能用替换字符悄悄改变非UTF-8文件身份。字节形式的行内容保持当前UTF-8文本展示语义，并记录此边界。现有text DTO和外部路由不扩展成第二套结果格式。

search_code和共享文件枚举使用NUL分隔，删除旧换行/竖线解析。原批次参数限制、2MiB累计原始输出限制和30秒总deadline继续由既有执行器承担；JSON开销计入原预算，不暗中扩大。现有伪进程预算测试输入改为合法当前协议，仍只证明局部预算/结算契约。新增真实运行正向检查；没有有效POSIX文件系统时，明确分开机器协议检查与Windows真实文件检查，不把标签/夹具当作POSIX文件。

先修搜索身份与内容契约。给本地搜索结果增加可点击Sources属于后续独立产品改进，不能在错误解析上直接发布引用。本轮优先完成该前置根因，必要时使用已授权gpt-6.1-sol单会话真实调用与/ui人工观察；凭据必须与完整models目录成对、预检分别验证可用/投影/实际模型，不创建新成员或UI自动化测试。

文档与当前架构按最终范围更新，运行package声明检查。所有本轮修改范围提交；fetch/merge后核对完整待推送集合并正常push。goal保持active。

## 已执行调查与范围补充

使用benchmark-debug-template流程：输入为真实搜索文件/模式，输出为准确路径、行号、完整尾随空白以及原预算错误；运行环境为私有Bun1.4.0和实际ripgrep14.1.0。生产搜索原30秒绝对预算不改；长链观察采用活动事实与原进程收据，物理所有者截止边界独立保留。

Windows普通Node文件API对竖线/换行文件名返回ENOENT，因此不宣称真实POSIX文件用例。初次尝试的`--label`并非此ripgrep版本的参数，该测试失败不能证明解析缺陷；已去掉该错误调用，特殊名称只作为显式协议层检查。真实Windows检查覆盖Unicode/空白名称、字节内容和真正的命中行尾空白。

修复前真实search_code丢掉最后命中行的尾随空格/Tab。同时旧伪进程测试的terminate计数失败。立即横审公共ProcessFacade：所有supervised Host/Task、inactivity和plugin入口经同一terminate→disposeAndWaitForExit，后者等退出、输出与supervisor settled；Native/Task Capsule各自dispose保留原scope，Node root-only使用独立适配器。普通/超限路径、Task/Mission/Session归属、不同Project与每次occurrence、终态/重试重新创建句柄的代码边界未改。失败是旧测试观察了过时内部回调，不是调度异常。两个全新真实Conversation/Task超限搜索已各返回output_limit、恰好2MiB保留字节、真实pid/occurrence和完成后的原live数量；替换旧伪终止断言，不改生产进程实现。测试日志明确实际exitCode可能为0：不据此宣称杀死仍活跃进程。

共享JSON入口保持现有应用Match DTO，支持官方text/bytes与context帧；文件身份非UTF-8时明确失败，内容字节按原UTF-8显示语义解码。NUL文件列表也使用严格、保留BOM字符的流式UTF-8解码，未终止的路径帧明确报错。旧竖线/换行协议被本次替换移除，属于已授权根因修复，不保留兼容路径。

## 已完成与后续

17项检查、17断言通过，原检查器重新取得实际exit0；后端类型检查exit0。真实单会话模型调用、Sources点击、原生进程/读流/配对清理已完成，见[结果与边界](search-framing-318/README.md)。核心更改已复核公开Match不变、实际错误包装、部分结果code2与累计预算；没有前端改动，实际页面使用317构建。下一轮继续搜索Sources生产契约，不将本轮read来源当成已完成该新功能。还需完成文档检查、范围提交、上游同步和push，持续goal保持active。
