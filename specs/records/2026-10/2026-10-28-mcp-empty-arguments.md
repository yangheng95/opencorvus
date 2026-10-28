# 本地MCP显式空参数保真

## Recall

用户要求持续单代理自主迭代当前产品，实际体验UI/UX与功能并修复，验证后范围提交/正常推送，只有真实冲突才等待；不用子代理，不再追已解决闪烁。上一轮progress为6af580ba1cd8984d2f2dfcf2210ecf42963ba33e已推送main，2026-10-28T02:02:40Z最新fetch/merge为0/0，34任务文件干净，176外部更改保留。MCP页补齐逐服务连接/断开，修复global/project状态混用、pending提交和布局跳动，15原图人工复核，真实官方filesystem2.0.1六个进程全部原terminal/output/settled fulfilled且exit0并physically retired；91318/86584/2113与native/launcher均0、公开shutdown200和三项结清后退休三份catalog，无认证复制、模型0、累计747。原98278行全部精确保留，最后副本98287/schema9/integrity ok。旧Goal文本中的三Astra被人类后续单代理指令覆盖；Goal保持active。私有GitHub告警清单授权仍是既有待答复问题，不使用GitHub登录，不因此停止产品工作。

本批追查本地MCP参数输入及错误恢复。静态可见parseMcpArguments用字符串truthiness决定token是否存在，显式双/单引号空参数可能丢失；先用真实服务和当前普通构建核实，不凭函数名/报错直接下结论。全仓搜索此函数只有services/mcp.ts定义、buildMcpAddRequest唯一生产调用与非UI mcp-service合同测试；已读当前SharedResourceManagementPanel新增表单/请求、Config command数组和MCP stdio spawn数据流、native Windows quote_arg实现、04-extensions与07-panel MCP连接合同。现有正向测试覆盖普通带空格参数，未覆盖显式空参数。未发现当前路径的UI自动化测试。

真实资格复用上一批独立安装的官方@modelcontextprotocol/server-filesystem@2.0.1包，Node25.7.0。已读该固定安装版本的dist/index.js：目录args经expandHome/path.resolve和真实目录检查，显式空字符串解析为启动cwd；完全无args会进入Roots等待/无Roots客户端拒绝。资料来源仍官方repo https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem，当前运行语义以此实际安装版本代码为准。新自有Project754用独立Git/README，不给服务用户目录权限；表单Args填写官方入口路径和显式空字符串，让它只开放这个新Project。OpenCorvus的Client没有声明Roots能力，最终结果仍需真实初始化验证，不预设失败。模型上限0，不复制auth，仅完整catalog用于现有页面读取。不得写假状态、伪工具结果或LLM消息，不执行文件写入工具。

从已关闭753-after2的98287行、durable resources和有效{}全局配置建立新隔离runtime，普通开发serve/ui承载当前main-BQOHnBym.js，不单开Vite、不碰用户18571/窗口/进程/数据库。单批30分钟原生监管绝对截止，重跑/修改后复验共享原截止，保留至少5分钟完整结清余量。观察过期不是进程终态，不因观察丢失重复启动；只通过原exec/native/ProcessSupervisor句柄和实际公开shutdown收敛，再退休copied catalog。Provider调用累计747不增加。

生产改动前补齐真实可观察症状、触发、根因、旧路径、定义/调用/合同、数据/测试/文档/交付风险。若确实为空token丢失，在现有唯一参数解析器区分“已开始的token”与“token内容非空”，保留显式空token，不更改引号、Windows反斜杠、原参数顺序/拼接或既有错误合同，不引入shell执行/变量展开/后备解析器。非UI修复有聚焦正向合同测试；UI/端到端只用真实页面交互/原图/人工复核，不新增或运行UI自动化测试。若出现异常调度/并发/恢复/终态，立即按共享机制横审所有生产入口与Task/Mission/Session轮次、正常/终态、重试/重启、串并行、多项目后才分类。

真实验收要求从原表单原input→原请求/持久command→原native监督args→官方服务真实连接结果闭合；必要时在新普通构建的新实例用相同真实UI输入更新同一自有服务，验证完整argv包含显式空字符串、实际connected及正常断开/重连、双语反馈，并检查所有旧行原身份、schema9/integrity、原项目输入与所有MCP/服务物理结清。失败原服务可能按其公开无目录合同exit1，保留该原失败，不改成0；服务launcher仍须正常0。新增规格同步三索引、docs:check、范围提交、fresh fetch/merge与正常hook推送，无branch/worktree/Release或版本变更。

## 实际复现及修改前分析

原页面147通过正常Settings/MCP表单提交empty-root-754：Node可执行文件，Args为带引号的官方入口路径后跟显式双引号空字符串。原图01/actual-arguments-input.txt保存真实输入；原图02显示Failed。实际mcp/project 200但该服务status=failed，原definition.command只有Node和入口两项，原mcp-stdio PID80720的args只有入口，cwd正是新754/project；官方服务按无目录/客户端不支持Roots的现有合同exit1，terminal/output/settled均结清。不是认证、缺少模型或后端native argv丢失；首次词法分隔边界已漏掉原参数。

根因：parseMcpArguments只有current内容与quote，没有token-start事实，空引号开闭后current仍空；空白分隔与EOF都用if(current)跳过该已明确写出的空参数。旧正向测试仅含非空带空格参数，覆盖不到此分支。全仓唯一生产调用buildMcpAddRequest将其数组直接作为Config local command持久化；后端const[configuredCommand,...configuredArgs]原样转给监督Command，Rust quote_arg已明确把空值序列化为\"\"。两个边界均不需替代实现或兼容层。影响全部由当前表单创建的local MCP配置：空字符串可影响位置参数和选项值；CLI/JSON直接配置已有string[]支持空项，不应改它们。公共API/SDK/schema/数据库格式均不变；现有旧配置已丢的作者信息不可反推，不添加默认参数或迁移猜测。受影响旧配置须由作者按原意重新提交，实页复验也使用原表单原输入重新配置同一自有name，不直接改库补token。

实现为现有解析器增加布尔token-start标志，打开任意既有引号或读到普通字符时设true，分隔/EOF按此标志发布原current（允许空）并在分隔后重置。已有引号连接、空格参数、Windows反斜杠、原顺序、未闭合引号错误均保持；不解释shell变量/转义或执行shell。新增聚焦非UI正向测试验证前/中/末空参数、两种引号、相邻片段、原Windows路径与完整Config请求的明确输出；不增加UI自动化、负向核心断言或可变源码摘要门槛。04-extensions追加local argv作者保真合同；三索引和docs检查同步。

风险为混淆空白分隔与明确空字符串、EOF漏项、改变相邻片段和Windows路径；正向数组合同与普通构建后的真实表单→原持久command→原native args→官方服务connected完整链分别验证。原service先公开shutdown并以原handle/物理/输出/请求结清，原失败MCP保留exit1，然后退休catalog；新实例沿同一30分钟截止，模型0，输入同一原Args及name，当前库与持久资源完整复制，不改用户或旧业务文件。需要实际截图人工复核当前区域，测试只能补充不能替代。无发布、版本或数据库迁移变化。

## 实施及最终证据

唯一parser增加started标志，分隔与EOF按“token已开始”发布current，单/双引号空值、前中末位置和相邻片段都保留。改动限于该解析器，未增加fallback、默认argv或shell执行；已有JSON string[]格式、配置writer、后端MCP和native quote_arg都保持原合同，schema仍9。聚焦非UI正向服务合同7项16断言通过，普通Node构建main-B3AIDWl3.js与renderer public surface通过，351/26文档及20项架构索引检查通过。

原始Args完全相同：before主页面147/普通main-BQOHnBym持久命令只有两项，原MCP80720 args只一项，SDK错误-32000/原stderr明确无允许目录且client无Roots，exit1完整保留。after新普通serve/ui38266/页面148通过表单重提同一empty-root-754及原input，持久command第三项和原native args第二项均为空字符串，官方filesystem2.0.1实际Connected。手动Disconnect→Disabled让93044退出0，保持焦点后Return重新Connected，73016也保留原空参数。设置切简体中文后同一服务、状态和按钮正确，六张原始JPEG全部人工查看；没有UI自动化测试、伪结果或模型消息，没有执行MCP文件读写工具。实际三个UI POST（add/disconnect/connect）均200，与规范状态及原ProcessSupervisor句柄一致。旧丢失配置没有自动猜测恢复，通过原作者输入重提完成实际修复。

68897/20633与native/launcher全部0，公开shutdown200、物理/输出/请求结清后退休两份catalog，未复制auth，源catalog字节/元数据及auth元数据保持。模型0，累计747，两个实例共享原30分钟截止，最终613033ms余量。原失败80720 exit1、修复93044/73016 exit0均原terminal/output/settled fulfilled，并另外按processInstance/occurrence复核物理退休。所有98287旧行精确保持，副本98292/98294，schema9/integrity ok，README及自有input保持。私有after模板的旧port映射在启动前审查发现并修正为38265→38266，未发起错误实例、重置预算或替换活服务资源。没有数据库升级、版本或发布变化；待范围提交、fresh merge和正常push检查，整体Goal继续active。
