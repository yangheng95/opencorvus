# 224 客户端语言偏好跨层写入修复

## Recall

用户要求持续自主改进当前 UI（User Interface，用户界面）/功能、Sources/Rendering，并明确只用单 agent。223已推送be40b95c，起始git status干净，前轮是实际进展。本轮修复223真实Appearance中文选择在无模型目录副本中失败的问题，完成中文/深色文件来源错误视觉验收。使用现行架构为事实来源，禁止UI自动化测试、伪来源/消息、额外分支/子agent、修改用户23页面/进程或重启旧scope。

已读223Recall/原语言失败截图与真实两config PATCH400窗口、05-config两层语言/保存事务合同、locale-preference、i18n load/setLocale、Settings唯一保存队列、theme-preference、Appearance/CommandPalette/Titlebar语言入口、config PATCH/身份路由、Project config writer/candidate/model validator、当前locale/project ownership/Settings保存测试。全仓源码/测试调用检索：applyLocalePreference由Appearance、命令面板、标题栏浏览器菜单和native-menu共享；syncAgentPromptLocale只有locale-preference真实调用，git-init测试mock有旧同名声明，没有其他生产消费者。架构明确Layer2偏好不跨层同步到Server Config；Layer1行为locale独立影响助手回复，旧locale条目关于Overlay localization的措辞需要澄清。

验收：客户端选择中文，真实新页/冷加载仍保持；选择深色并人工查看原Source/已加载重读失败完整诊断/文件恢复。聚焦非UI服务正向验证完整host保存文档的locale、确认快照、真实存储失败错误及恢复、两个并发语言选择的顺序/终态、连接/Project变更期间同一host偏好成功。不把mock或localeID状态当网页/视觉验收。语言切换不会进行隐式项目配置同步，此契约通过当前原项目内容事实确认，不写以“不调用/不存在”为核心断言的测试。

## 修改前完整根因与影响

可观察事实：223/main-BKapQkFd/IAB45中文选择后UI恢复English，两个项目config PATCH都400 ProviderModelNotFoundError，原错误保留。直接调用链：Appearance→applyLocalePreference→setLocale→syncProjectLocale→syncAgentPromptLocale→patchConfig({locale})，失败后又以旧locale回写项目。PATCH /config已使用Project identity，不是遗漏路由准入；Config.writeProjectPatch先创建canonical目录，再完整candidate模型引用校验，已配置gpt-6.1-sol无目录投影时明确错误，符合Layer1行为写入合同。两个失败发生在真实候选校验之前后，目录mtime可变化，不能由mtime推断配置已commit。frontend当前全局host偏好保存尚未执行，被跨层副作用阻断；rollback同样再次遭Layer1校验。根因是Layer2偏好错误耦合Layer1，而非认证失效/通用API路径旁路/模型bug。

旧修复以API authority/selection epoch给这一跨层同步加退休保护，仍保留错误能力归属。05-config当前明确每个关注点仅一个真值源、不跨层同步；不能通过给模型目录补凭据、绕过项目校验、另建locale缓存、吞掉真实Config错误或重试回写掩盖问题。

拟删除locale-preference项目同步函数与唯一调用、API/board/directory依赖，以及config.ts无人调用的syncAgentPromptLocale export；移除对应git-init mock字段。保留已有locale generation/tail、setLocale异步资源加载和saveSettings唯一完整文档writer；真实host保存失败恢复同一confirmed snapshot的语言，原错误可见，finally释放原队列。持久事实仍由host当前文档拥有，资源加载/失败不生成Server消息或LLM（Large Language Model，大语言模型）调用。Project/Global/Session config API、模型校验/回复语言/Prompt/权限合同完全不改。

客户端并发/恢复横向范围：4个UI入口共享同一个服务；正常/失败/更新选择/连接及多Project变化、cold load都通过原host文档及saveSettings串行队列。Task/Mission/Session执行轮次不进入该服务的持久化/终态，不涉及其调度、唤醒、Provider或engine；若真实执行异常出现再横审共享机制。现有错误是跨层配置副作用，没有Task/调度异常证据。重点审查当前confirmed snapshot与保存队列时序，禁止新影子状态。

测试影响：project-configuration-ownership旧7个locale测试要求跨层同步，按当前架构删除/替换，不保留旧实现取悦测试；其他真实Project config/permission/reload测试保持。新locale-preference服务测试只验证localeID/完整保存文档/错误/顺序，不渲染组件或断言UI文案。locale-runtime-selection纯映射测试不属于UI自动化。没有相关组件/DOM（Document Object Model，文档对象模型）测试需运行。docs/current architecture/root/月/本目录索引同步；不更新版本、不创建release。

## 实施与验收步骤

先按方案修唯一locale服务/死export/旧测试；聚焦正向服务测试、Overlay types/build/docs。原223是before证据，保持原截图/HTTP错误，不伪造当前before。重新对原222before完整配置/两个Project/Task-Mission-Session/发布/请求/lease/恢复/终端做现行只读准入，原README已还原，不使用quarantine旧事实；源已完全closed/pair已清除。

复用全90表实际逐行一致copy与正常serve，原Project directory/Session/Source不变；fresh source-language-224-after-01 /18151、固定900000ms，不启动模型、子agent或历史Task，不复制凭据。真UI切中文、深色、返回原Source与文件；只对已确认原自己生成46-byte README在同一原Run内可逆单文件移动（先owner/完整bytes/绝对边界receipt），加载后重读404/中文提示/Details原生完整scroll/实际草稿与恢复200人工截图。原完整内容/原路径恢复，主目录mtime明确记录。

自己页面cold reload确认持久中文/深色，菜单或命令入口切换语言后回到中文，保留真实Source/Message；不注入隐藏状态或启动独立Vite。用户23不动。完成sole shutdown、原foreground0、Native真正exited0/full physical-output-request、独立出生/port/pair；13表actual完整行相同、原目录文件完整内容/属性变化审查。最后全部观察/checker结束才按精确birth逐文件归档自己FFI（Foreign Function Interface，外部函数接口）debug文件。docs/index、范围commit、fetch/merge上游/完整待推送集合审查、正常push；未满足项原样记录，持续goal active。

## 当前实施、验收与缺口

原locale在进入host保存队列前读取durableLocale，若先入队writer期间确认了新locale，该早期值已过时；已沿现有saveSettings onFailure回执读取当前confirmed locale，新增正向故障/队列测试明确证明当前确认值恢复，不引入新保存owner。6个当前locale service测试替换7个过期同步测试；共26pass/76expect，关联Git service13pass/43expect，types/build/docs0。

18151/main-BpMz21_t/IAB46的实际中文保存、深色、cold reload、浏览器标题栏语言切换与原Source均人工截图；中文草稿重读404/完整diagnostic原生scroll/再次失败最新requestID/原46bytes归还后同一reload200及正文/dirty=false实际验证。原223中文400错误不改，当前完整global config bytes/13表实际行相等，Project只随自己文件移动有根mtime变化。

Native04:16:49.435Z exited0/fullcleanup，原10925 joined0、固定deadline未延长，自有46关闭/用户23未动，精确birth/port/pair闭合。5自有生成文件在全部checker/observer结束后按实际birth单文件归档。命令面板、Tauri native-menu实际交互及真实host故障仍未验；General vcs模型耦合/Source中文措辞保留后续调查，不扩为当前未分析修复。详细[结果](local-language-224/README.md)，整体持续goal active。
