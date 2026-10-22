# OpenCorvus 热认证的真实流式验收

## Recall

543继续用户授权的单agent自主体验、修复和提交推送。最新用户明确已经在OpenCorvus热认证OpenAI，历史授权允许复制配对凭据并使用gpt-6.1-sol实际验收；不委托。542的Goal归属修复0c273884c已随2bdb8893f、6ac659bd6推送，fresh fetch/merge后main与upstream为0/0。另一项用户任务已完成首页/Goal简化及目录刷新、派生OpenAPI（OpenAPI Specification，接口描述规范）同步；不改写或重复其交付。开始工作区仅.bun/和packages/opencorvus/bun/缓存。

验收指标：从OpenCorvus当前保存的OpenAI OAuth（Open Authorization，开放授权）完整条目及同目录完整models.json配对，分别证明凭据实际可用、目标模型已投影和真实请求模型为gpt-6.1-sol；所有请求流式、HTTP（Hypertext Transfer Protocol，超文本传输协议）200、实际源reader正常EOF（End of File，流结束），持久化助手回复可读；正常公开shutdown、原exec与原生进程/输出/request闭合，再删除自有配对成员。此次最多4次实际模型尝试，含自然memory与SDK（Software Development Kit，软件开发工具包）重试；20分钟自有原生边界，preflight结束并结清reader后立即关闭，不插入UI或文档整理。旧542两fetch失败和一次deadline退出保留，不重写为成功。

已读AGENTS、542 Recall/结果、continuous-goal和06-provider架构、Auth/纯runtime路径、ConfigPaths、evolution-diagnostic-provider、RealProviderAudit.preflight、504普通Source CLI（Command Line Interface，命令行接口）启动和413/446原生监督/既有关闭结算工具。搜索全部stageDiagnosticProvider/preflight调用、凭据过期约束及全目录验证。已只读确认当前App认证为OAuth并有目标投影；这不是实际请求成功证明。尚未使用这份新认证发起请求。无委托，无UI自动化。

## 修改前分析与范围

可观察缺口是用户新热认证尚无隔离实际请求资格；不是已证实产品认证故障。前542配对来源是此前授权的Codex认证转换，不能继续把旧来源的成功当作新热认证已可用。直接数据流为App保存的openai.info与相邻目录→现有stageDiagnosticProvider→Auth/Provider投影→正式Chat路由→流式请求及持久化回复。旧来源选择不覆盖新保存的认证，唯一修正是本次诊断直接读取App条目，不新增产品认证路径或转换兼容层。

影响面仅本次隔离验收工具、记录与证据，不改产品实现、公共接口、模型目录、真实用户数据库或schema（结构）。新建空隔离runtime，由正常启动初始化其数据库；不复制、打开或迁移用户数据库，也不修改用户配置/窗口/进程。没有调度异常证据；若真实路径发现队列、恢复或终态异常则立即按共享机制横审，不能只修本场景。风险为网络失败、认证过期或资源收尾不及时，分别保留原始audit与退出事实；不以扩大预算、刷新真实凭据、替代Provider或重启失败scope补造成功。

## 实施前方案

1. 新独立openai-hot-auth-543、19083端口；选取当前App openai完整条目，保留原generation与info，并逐字节复制完整相邻models.json。源只读，记录非秘密metadata。成熟stageDiagnosticProvider再复制到隔离runtime；源、private、runtime三层身份明确。
2. 使用已验证固定Bun1.4.0和原413/446前台ProcessFacade原生监督，隔离HOME/OPENCORVUS_HOME及环境；新唯一canonical全局配置指定OpenAI/Sol与Base。正常Source CLI serve，不起独立Vite、不操作用户页面。本批不声称UI或Goal实际执行资格。
3. 先核对Auth为OAuth及Provider.getModel的API型号，安装现有RealProviderAudit并执行其真实/global/chat/start preflight。只允许原checker的一次“Reply with OK.”实际输入；回复和自然memory使用同一4次总额度，所有流及型号由原audit判定。不创建业务Task/Mission/专家成员，不伪造Message。
4. preflight完成后观察原audit全部reader终态，立即公开shutdown、原exec join与精确出生链结算；保留任意fetch_failed为失败。关闭后再做文档/归档，删除runtime/private各auth/models共四成员，扫描实际凭据值并核对源metadata及条目/目录保持。只归档非秘密资格和终态，不归档完整请求、库或凭据。
5. 原检查通过后记录结果；若失败，保留实际未满足项和根因边界。同步三索引、docs/architecture/diff与范围commit，fresh fetch/merge/待推全集合审查、正常push，长期Goal保持active。

## 实际结果

19083普通Source CLI于2026-10-22T16:24:01Z在全新自有runtime打开其opencorvus.db并初始化结构，没有打开用户数据库。启动前Auth实际读取OAuth，Provider投影API型号为gpt-6.1-sol。现有preflight经正式/global/chat/start创建真实Chat ses_he2vPxgcUXqBHSwbC5Sh；原用户输入为Reply with OK.，闭合后只读SQLite（Structured Query Language Lite，嵌入式数据库）确认助手已完成、Provider/model正确、正文为OK且integrity_check为ok。这个持久化事实是接口/后端验收，不是UI测试。

实际2/4请求，分别为自然memory和主回复，全部stream=true、HTTP200、API型号gpt-6.1-sol、原reader为settled/eof；preflight于16:24:10Z发布，memory于16:24:12Z原EOF，16:24:14Z观测全部结清后立即公开shutdown200。原exec63762 join0；native于16:24:19Z exited/0，physical/output/request均闭合，launcher0，原host/target精确出生均dead_or_reused。原20分钟边界未用尽，没有重复542的超时收尾问题。没有新UI页面、Goal执行或业务Task/Mission资格。

runtime/private四份auth/models配对成员均已退休；源认证完整条目、size/mtime和完整目录bytes/mtime保持。诊断输出26文件约9.7MB扫描实际access/refresh值，匹配0。归档仅保留[非秘密资格、流终态和闭合事实](../../artifacts/2026-10-23-openai-hot-auth-verification/README.md)，没有凭据、完整请求体或数据库副本；归档再次实际值扫描0。

本次私有工具的可修复错误也原样保留：preparation对象重复source属性把路径覆盖为说明，初次retire因此ENOENT；修正准备器字段名，并按已读原代码的确切App路径核对原条目、size/mtime及相邻catalog后清理，原metadata不改写。扫描器首次直接比较Windows反斜杠与正斜杠路径，误把已声明的runtime/auth.json存储文件纳入诊断输出，实际唯一命中正是该文件；保留原路径观察，改为规范化绝对路径的精确排除后重跑0匹配。另一次纯PowerShell settle后用LASTEXITCODE判断导致跳过原链末retire，随后显式执行；未伪称此前已清理。retirement输出的sourceCatalog.bytes重复属性遗漏数字，归档的byteLength使用原preparation及两份退休models文件一致的真实字节数，并保留说明。上述均为私有验收metadata/控制工具错误，无产品补丁、模型重启或预算扩容，最终四成员真实退休。

本批证明新OpenCorvus认证实际可用，不能用它改写旧542两次fetch_failed或deadline退出。Sources/Rendering全部生命周期与SideChat Goal实际执行仍需后续独立验收；长期Goal保持active，只使用一个开发agent。
