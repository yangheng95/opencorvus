# 记忆设置项目顺序跟随当前界面语言

## Recall

用户持续按批迭代直至明确停止；本人独立，不使用子agent。根因/影响方案先落盘，再有实证修复、真实开发/ui与本人截图、聚焦正向验证、范围提交/上游普通合并/完整待推集合审核/正常push后继续。前批141caaaf2已正常推送全部hook通过，HEAD/upstream0/0，原177条工作区状态保持。Sol/真实Provider凭据使用授权仍未收到；不重复询问、不读/复制/使用认证或模型目录、零LLM（Large Language Model，大语言模型）请求。

已读MemoryContextPanel全部projects/selectedProject/load owner/文档加载/Select消费者/number与locale调用、ConfigDialogHost唯一加载/挂载调用、SelectControl原生option顺序/value/optionValue契约、Project.update正式领域入口、当前07-panel设置页/语言/共享搜索scope原则与02-data项目归属。全仓setProjects/projects/同语义排序和历史记录检索，未发现本页面相关UI（User Interface，用户界面）自动化测试；不新增或运行DOM/组件/源码文案/快照/浏览器fixture等测试。额外action工具调查中schedule/continuous-goal当前显式映射领域输入，未复现SkillMarket同类action泄漏，不因名称推断调度异常。

已查[Solid createMemo](https://docs.solidjs.com/reference/basic-reactivity/create-memo)纯依赖派生合同及[localeCompare参考](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)明确locale排序参数。当前运行时原生比较示例：en-US为Alpha/张三/李四，zh-CN为李四/张三/Alpha；这些仅用于选择实际测试名字，不能代替浏览器视觉证据。

## 修改前现象、根因与影响分析

待真实前态确认的现象：在Memory & Context已加载项目下拉后切换界面语言，文案/日期/数字响应新语言，但项目菜单顺序可能仍是初次加载时语言顺序。当前异步加载IIFE的await之后调用localeTag并把排序结果写入projects signal；该异步延续不建立locale响应依赖，后续Select只消费同一已排序数组。ConfigDialogHost按activeConfigTab挂载页面，没有已知locale remount合同，因此不能依靠重新打开页面刷新顺序作为修复。旧路径只在load时使用locale参数，没有把顺序作为语言+项目数据的派生值；改翻译键或重新取网络数据不能修正该归属。

现projects是loaded option对象唯一事实来源，selectedProject保留其中对象身份，独立文档loader通过selectedProject()===project判断owner。拟去掉异步排序，仅写入原Map选项，并新增纯createMemo从projects和显式localeTag派生toSorted视图，再交给现Select。保留原显示名比较和directory tie-break，不改变真实名字/目录/key、不合并同名项、不新建selection或第二data signal；排序只重排行对象引用，所选对象不改变，不触发文档重选或对话导航。当前raw options.find(currentKey)仍选同一实际对象；loading/error/reset/authority/当前项目补充事实保持。若前态实际自动重载已经正确，则不修改产品，记录排除后另找有证据的问题。

全定义/消费者影响：MemoryContextPanel私有load排序、唯一Select options和当前架构07说明。共享SelectControl/项目API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/项目名称持久化/文档整理/模型/权限/DB（Database，数据库）格式与迁移不变。仅本人隔离项目通过现Project.update录入测试真实名称，不注入组件/应用状态或合成消息。没有队列/调度/唤醒/恢复/Task/Mission/Session occurrence（执行轮次）异常，不把UI排序误作执行机制问题。

风险是选项对象被重建导致selected value丢失、选中项被排序首项替代、文档加载被重复触发、加载失败时菜单空/禁用失效以及语言排序影响原目录tie-break。纯派生toSorted保留对象身份和原规则，用实页当前选中Project/文档路径和中英往返菜单确认。元数据名称按原文显示不翻译，原项目notes/Git保持。

## 验收方案（修改前）

Temp b38包含before/after各三实际Git项目，名字Alpha/李四/张三，私有Git配置/identity/禁签/autocrlf=false从创建即绑定；seed记录原notes与HEAD。独立生产Instance/Project.update注册真实项目，零Session/消息/模型。before38996/after38997全新profile开发/ui，实际Settings→Memory打开菜单，初次英文、切中文同页再打开、返回英文以及保持当前所选；必要时切另一个项目并重复语言，确保目录/文档范围正确。本人截图逐张查看，不把下拉DOM顺序脚本断言代替视觉检查。

先确认根因/影响和前态后才改唯一组件；正常Node build新前端再启动after，不单独Vite。纯UI派生排序不新增镜像后台测试；overlay typecheck/i18n/build/renderer与docs/architecture辅助。真实公开project列表/Memory所选文档按运行时/doc验证原身份/名字/项目范围；不发整理请求或模型调用。不假造非空记忆文档来做视觉效果。

原六项目notes/原HEAD/配置清单保留，自有页面关闭、服务正常shutdown/原exec session退出；范围提交与3README本条、fetch/普通merge/待推集审核/正常push。不创建新branch/worktree/tag/Release，不操作现用进程或凭据。

## 未达成

原待实施/验收状态由下方最终结果更新；Sol/模型/权限/Session完整链路、旧空目录及计划历史/子树删除线索继续未验。

## 前态实证

通过真实Instance/Project.update注册本人三项目，零Session/消息/模型。38996/IAB82真实Settings→Memory & Context：01英文菜单Alpha/张三/李四；同页切中文，02菜单仍Alpha/张三/李四，标签/页正文已中文。通过原生Tabs离开至通用再回记忆，03当前中文菜单变为李四/张三/Alpha，证明原比较器可正确按中文排序，缺口为加载后语言响应性，不是Intl数据或名字编码。三图均本人呈现查看；所选仍Alpha/本人alpha目录。页82关闭、before16923正常shutdown200/exit0后才实施。方案保持唯一原项目数据与所选对象，排序进入纯memo。


## 最终实现与辅助检查

唯一MemoryContextPanel.projects保留异步加载的原Map对象数据，删除load内排序；projectOptions是读取localeTag与projects的纯createMemo/toSorted视图，唯一Select消费该视图。原显示名比较与directory tie-break相同，原raw options.find仍找到同一个当前项目对象。语言变更仅重排行对象引用，未新增数据signal或重建所选对象；项目/文档loader、权限、公开API/SDK、持久数据格式和共享SelectControl均不改。当前07-panel同步该归属合同。

Overlay typecheck exit0、两语言2931键通过；正常Node build53.16秒/renderer检查通过，main-E3BpjO6U.js。docs352操作/26组、architecture20文档和精确diff检查通过。没有新增或运行UI自动化，没有组件/DOM/文案/快照测试；纯UI派生改动不添加镜像后台单测。辅助检查不能替代下方真实视觉资格。

## 真实后态人工验收

38997/IAB83，04初始英文菜单Alpha/张三/李四，Alpha选中。无需离开页面，切中文再开菜单，05立即李四/张三/Alpha，Alpha仍选中末项/目录保持。原生Home/Enter选择李四，06显示该实际目录及正常revision0空文档。继续同页切英文，07顺序Alpha/张三/李四，当前李四仍选中；再中文，08顺序李四/张三/Alpha，李四仍选中首项。三次语言变化均由本人实际菜单操作，未重新加载页面或注入状态。

随后在中文菜单用↓/Enter选择张三，09实际project-after-zhang路径及其空文档正确。Back返回主页面，10仍在Alpha项目起始页，表明此独立记忆选择和排序未改主项目。没有预先存在的非空对话，本轮只实测原主项目保持，不宣称已有对话内容连续性已验。10张前后截图全部本人实际呈现并查看，稳定菜单、选中标记、真实目录和语言文字清楚。

## 真实接口与持久数据核验

Node检查器进入实际HTTP（Hypertext Transfer Protocol，超文本传输协议）/TCP（Transmission Control Protocol，传输控制协议）路由：project.list及三项目各自experimental.projectMemory.get均200，运行时/doc/Ajv2020 schema通过；原Project ID（Identifier，标识符）、名称和worktree与领域注册回执精确一致，三个初始文档均revision0/content空。原名字未翻译或伪造，文档没有人工编造内容；这是原生公开API/SQLite（嵌入式数据库）路径，不是mock/fixture-only网页证明。

正常退役后实际SQLite只读核验：两个profile各3项目、Session/Message均0；before1文档/1chunk，after3文档/3chunk。三个真实请求所指Project与memory_file.project_id归属一致，storedFileID及不可变timeCreated、revision、原内容与各响应对应。六个原notes字节分别49/46/49和48/45/48，worktree/seed内容、初始HEAD均精确保持；runtime原生.gitattributes/.gitignore/.opencorvus新增元数据在报告列明，未宣称本人临时项目工作区为空，profile配置文件清单空。

### 补充核验脚本的可变时间假设修正

可选补充脚本初次错误地要求所有文档最终timeUpdated恒等于较早HTTP读取。Alpha/李四一致，张三最终1794171342128而较早响应1794171283440，断言失败；同一timeCreated仍1794171283440、内容空/revision0/status idle保持，持久availabilityGeneration为1。源代码唯一invalidateOrganizerAvailabilityInTransaction递增该generation并更新timeUpdated，两个调用均属于ProjectMemoryOrganizer配置事件监听；读取API本身不是每次伪造Date.now。具体哪次通知及精确事件时序未采集，不能仅凭时间差推断调度异常或错误改写。

该恒定可变时间约束不证明文档归属/正确性，已删除；当前audit-persisted-documents.py按实际Project关系、不可变创建事实、明确revision与原内容核验，同时原样记录前后timeUpdated/generation。原核验修正后重跑3文档通过，不重写数据、重算假期望或遮蔽失败。document-metadata-observation与完整资格记录保留此差异；未把正常配置元数据演进列为产品修复，也未声称做了通用Organizer调度验收。

## 资源、限制与交付

本人页82/83关闭，16923/67211分别正常shutdown200/原exec session退出0/prompts0。直接Project注册没有创建Session/Message，持久计数已验证；零模型请求和用户凭据操作，Sol/真实Permission/Session端到端仍未验。三项目空记忆页面、名称排序/选择/文档范围及原主项目保持已验；大量同名目录tie-break、无项目/错误状态、已有非空对话和屏幕阅读器未本轮实测，不能扩大资格。schedule/continuous-goal仅部分源码显式映射调查，未做完整运行验收。

范围限唯一UI组件、当前07-panel、本记录/10图/真实领域注册及HTTP/持久核验/本人项目报告、三个README仅本条。原177条工作区状态保持；范围提交后fetch/普通merge/完整待推集合审核/必要检查/正常push，实际提交和推送由下一批Recall记录。不创建branch/worktree/tag/Release或发布版本，旧空目录/计划历史与子树删除线索继续独立待查。
