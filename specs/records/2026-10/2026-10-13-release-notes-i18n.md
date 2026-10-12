# 更新日志与页面国际化

## Recall

用户在侧聊明确提出“更新日志的中英文没有分开，所有页面都需要i18n”，在转发接口两次失败后要求“你自己修复”。本任务只处理该要求，不接续父任务359的剪贴板调查，不使用子agent，不修改其文件或运行进程。开始HEAD为05aa218aa；现有未提交CI月记录保持不动。

已读根AGENTS、CHANGELOG、共享util解析器与所有调用点、app ReleaseNotesPanel、官网lib/changelog/OcChangelog及路由、locale入口、RELEASE和当前07-panel/public-website/05-config契约、util正向changelog测试与发布身份调用。全仓检索parseChangelog/requireReleaseNotes/renderReleaseNotes/ChangelogEntry；没有另外的更新日志事实源。应用174份TSX（TypeScript JSX，类型化JavaScript界面语法）组件及官网页面纳入产品文案审计。只读源码扫描是调查，不作为UI（User Interface，用户界面）验收或文案断言。不得新增或运行UI自动化测试。

## 根因与影响

可观察问题：英文界面仍展示中文版本正文，中文正文混用Added/Changed/Fixed标题。直接触发点是两端渲染entry.markdown。根因是ChangelogEntry只有一个markdown字段，源文件也只有中文；app摘要、搜索和详情以及官网两个语言路由共享该字段，lang和官网链接硬编码zh-CN/zh-cn。按钮目录虽然两种语言键齐全，也不能修复正文数据没有语言分区的问题。另发现TitlebarBrand的首页说明与无障碍名写死英文，需使用现有t入口。

当前方案：根CHANGELOG.md继续唯一编写来源，每个dated版本保存显式### zh-CN及### en-US，版本/日期仍只有一份；两区内容标题下移一级。共享parser严格生成notes语言记录，缺少/重复/未知语言及空正文映射为明确错误，不接受旧单正文协议或跨语言后备。完整历史人工翻译，保留所有原中文事实、版本顺序、日期、状态、来源和比较链接。GitHub生成器从同一记录分别输出两语言区及各自链接，不发布或改已有Release。app按响应式getLocale选择详情、摘要、搜索、lang和链接；官网按route locale选择同一记录对应已渲染正文和摘要。删除旧markdown读取，不保留平行数据。

影响：util数据契约、正向parser测试、两端消费者、RELEASE/当前架构、根更新日志内容及明确找到的产品文案。没有Provider（模型服务提供方）、Task/Mission/Session调度、数据库或配置协议修改，没有模型请求或凭据使用。风险包括中文事实意外改变、历史翻译遗漏、切语言后旧选中正文/搜索残留、标题级别和长文布局；靠逐版本原文比对、真实parser、发布生成输出和实际中英页面检查处理，不以hash或build代替行为。

全页面审计关注可见文案、提示、错误、空状态、无障碍名和本地格式；品牌、快捷键、网址示例、源码标识、用户/模型原文、文件身份保留字面数据。源扫描与catalog结构检查只能定位线索，实际覆盖情况记录在证据中，未覆盖的页面必须明确列出，不宣称全页面视觉验收完成。

## 验证与交付

聚焦util正向parser/错误/发布输出测试；当前真实CHANGELOG全版本双语解析和正式版本校验；两端类型/构建、locale catalog结构、docs:check。UI仅真实页面交互与截图人工复核。使用自建隔离服务与独立端口，遵守当前开发模式/ui入口；不刷新或重启用户/父任务页面与进程。官网独立Astro页面允许专用服务器；不启动独立Vite绕开app入口。使用computer-use浏览器能力完成人工复核。

本任务修改逐文件范围提交，父任务改动留存。提交后fresh fetch/merge，检查全部待推送集合并正常push，不发布/tag/PR。更新根/月/证据索引。若验证失败或全页面覆盖不足，列出精确未满足项；本侧聊任务不操纵父任务goal状态。

## 初轮人工复核与工具链修正

61版本/434条记录双语解析通过，聚焦util测试12项/13断言通过。app私有正式构建经真实production listener/recovery与/ui呈现，英文正文/搜索和中文正文/搜索、日期、链接实际查看。发现英文介绍残留“Notes are authored in Chinese”和1 versions，已删除过期介绍并把数量改为现有tc复数合同。语言元数据导致正文标题在原文中下移一级，新增单一standalone投影恢复原H3/H4层级，围栏内字面标题保留；GitHub双语导出仍使用原嵌套正文。这些修改须最终重建后重新截图。

官网首轮使用astro脚本时实际运行在Node，语言跳转触发bun:模块加载错误，两张失败截图保留，不能按旧AX状态当作页面通过。按现有package开发命令改为显式Bun运行后重验；仅停止本任务18462/pid45284服务，未触及用户或父任务服务。

本任务首轮app helper收尾出现Runtime execution settlement is already in progress，原66192 exit1保留。横向读取生产Server.stop、CLI serve/restart/bootstrap、server-runtime和ACP的全部settle/stop/release调用，确认生产Server.stop自身拥有一次执行结算与release；CLI使用listener transfer后单独结算，未叠加stop。私有helper错误地先settleRecoveringServerRuntime、再server.stop，重复获取同一进程内gate；没有生产修改，改用唯一server.stop完整收尾。Fresh隔离DB与物理退出仍需实际检查，final使用新runtime scope，不重启失败scope或抹掉原异常。若最终仍失败继续按共享机制调查。

官网第二次bun --bun astro仍实际启动Node。读取安装的Astro 7.2.8 bin与background实现，确认后台子进程使用process.execPath；本仓库同名astro脚本优先被Bun识别，脚本内astro可执行文件按Node shebang执行。直接以Bun执行真实bin/astro.mjs后，pid64636实际ExecutablePath为Bun，英文与中文同版本真实截图成功。方案统一package的astro脚本到显式Bun bin入口，dev/start/check/build/preview复用这一入口；不修改框架内部、Registry或共享服务。完整脚本调用须实际重跑。

进一步复核：Provider表单只有button处理保存，没有原生form提交或reportValidity；原setCustomValidity字符串实际上不能提供可见错误说明，且在语言切换后会缓存旧语言。使用现有TextField.invalid/ErrorMessage，从当前API输入与同一http/https要求直接计算并呈现响应式本地化提示，移除旧customValidity写入，不增加服务/配置合同。Token单位虽然两种语言都使用术语Token，也应复用现有usage.table_tokens目录而不是散落字面量；会话整数格式显式使用当前locale。运行次数使用tc单复数入口。上述UI修改重建私有bundle后重新实际查看。

完整官网构建首次与重试均失败于Solid SSR（Server-Side Rendering，服务端渲染）导入seroval。隔离依赖存储的Solid有正确seroval符号链接，但root node_modules/solid-js是既有物理目录（2026-10-08创建）且没有其依赖。官网过滤安装成功；完整frozen/ignore-scripts安装也报告no changes。初步怀疑安装路径失配，先关闭自有服务，将这一目录移入任务scratch保留后由原锁文件install验证；安装没有建立root链接，不能把它当生产故障结论。

后续失败明确指出importer在本任务root scratch的web-build/server/.prerender，而不在packages/web。根因是私有outDir越出了package祖先范围，预渲染external导入不能读取官网自己的node_modules；原物理目录只是错误搜索碰到的线索。已精确恢复暂存的原目录，没有改变manifest、锁文件、安装策略和用户进程。最终隔离outDir放packages/web/.tmp-release-notes-i18n-build，与正常dist共享package依赖祖先；不覆盖现有dist，也不复制第三份依赖或改变SSR配置。此段更新前一怀疑，原exit1日志保留。

构建产物人工跨页复核新增明确问题：中文公共页进入中文quickstart，在文档现有页脚LanguageSelect切成English，英文Quickstart正文正确；点击文档OpenCorvus返回根首页却跳回zh-cn。根因是OcLayout的OcHeadBoot持久化opencorvus.public-locale，但文档Head不加载该locale脚本，Starlight选择器只负责当前URL。首页读取旧zh-cn偏好并跳转；两种正文已存在不能修复跨页选择。全仓相关引用仅OcHeadBoot与OcLayout，文档入口统一Head，公共页/文档/语言选择器均纳入影响面。方案把原locale脚本移动到一个LocaleBoot组件，两种head显式传入实际route locale/surface。沿用一个存储键、URL权威及仅首页首访偏好逻辑；文档现有框架选择器继续产生对应URL，不新增语言选择器、主题策略或路由fallback。重新构建，并实际复核中英文文档切换与返回首页、继续博客/更新日志的语言一致性。

同一真实中文文档的代码块仍显示Terminal window/Copy to clipboard。初步调查识别Starlight0.41.7的Expressive Code getBlockLocale中一个可验证的输入判别错误：astro-expressive-code的Satteri适配明确同时提供file.url（file:源文件URL）与file.path（实际文件路径），但Starlight把任何file.url.pathname都当route slug，源目录首段因此被误判为英文root。已有absolutePathToLang能正确处理源路径和Windows路径；当时当前MDX实际入口与三个标签的中文目录完整性仍未知，不能据此归因当前页面。该数据合同影响Markdown/MDX及Code组件共用的locale callback、Windows/POSIX源文件与HTTP路由语义。方案采用仓库既有Bun patchedDependencies，修正该条件让file:输入使用已有源路径分支，HTTP路由分支保留自身实际语义，移除错误判别而不复制新resolver。增加聚焦的非UI路径→语言数据合同测试（没有正文/DOM/渲染断言），再重建并实看中英代码框标题与操作。所有patch与安装仅在关闭自有官网服务后进行；没有库版本升级。

源文件URL数据合同在原代码正向复现2fail/1pass，补丁后3pass/5断言。但真实中文quickstart代码框仍英文，不能把局部合同通过当作UI验收。进一步临时记录生产callback收到的file.path/file.url/docsPath（只记录这些公开源码定位元数据，不记录正文或环境），以真实force build核对MDX与Markdown的数据入口；诊断语句须最终删除并重建。原失败截图保留。

真实build probe确认当前quickstart MDX入口提供规范化file.path，没有file.url，所以它本身使用的源路径分支已能得到zh-CN。继续检查Starlight内置zh-CN目录：三个expressiveCode文案键均未提供，本项目目录也没有；addTranslations只取得默认英文，因此这是当前MDX页面标签混用的直接数据根因。补齐既有官网en/zh-CN两个目录的copyButtonCopied/copyButtonTooltip/terminalWindowFallbackTitle，由已有Starlight primitive加载。之前file:判别修复仍对应库公开Satteri入口的真实数据合同，独立正向测试覆盖该输入、Windows路径与HTTP文档路由，不声称当前MDX走了该路径。临时probe已删除，最后只保留一行协议判别补丁，并须最终重建与实际查看标签。

## 最终复核结果

最终中文真实代码框出现“终端窗口/复制到剪贴板”，英文同页为“Terminal window/Copy to clipboard”；文档切English后返回首页保留英文，再进入英文更新日志，切中文列表也正确。应用最终新bundle的中英文Provider可见说明、用量周期/日期，以及正文/搜索均人工查看。源数据对比确认61个历史版本中文正文与链接原义和日期完整保留。按RELEASE规则另记录本轮工作到双语未发布区，不增加新版本或混入已发布0.1.25正文。

23项聚焦数据与配置测试、应用与官网构建/类型/目录/文档检查均通过。原始失败与通过输出、自有scope、过程和截图归档在[证据](../../artifacts/2026-10-13-release-notes-i18n/README.md)。自有应用wrapper实际exit0，全部自有服务物理Terminated；后台官网daemon退出码未知，未伪称exit0。没有凭据或模型请求，没有操作用户/主任务服务。

未满足的验收：全部页面的全部动态状态，尤其带真实任务数据的待办、会话用量、提交差异和演进统计，尚未逐项视觉验证；局部源码/数据合同不替代这些场景。线上官网与已有GitHub Release正文未部署/写入/验证，发布授权不在本任务内。详细已验证范围和限制见证据README。仍需完成范围提交、fresh fetch/merge、待推送集合复核与正常push；保留并行任务的所有其他改动。
