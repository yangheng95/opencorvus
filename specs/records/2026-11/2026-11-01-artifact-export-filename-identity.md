# 产物导出同名文件身份

## Recall

用户要求持续自主体验、修复、真实页面与截图复核、提交推送；明确只用一个 agent，覆盖旧 Goal 的多 Astra 文字，不委托。848 是 progress：cd9e5bc0a0c09aad69f5123cc59d3276d6bd7f7d 已推送，fresh fetch/普通 merge 后 main/upstream 0/0，15 个数据正向测试、真实媒体两产物与中英实际下载通过，七图亲自查看。848-after 已正常关闭并退休配对副本，schema9/92表231147行，102 Session/8 Task/784用量、130保护附件、累计1169真实模型请求。849开始工作区状态另存；保留全部外部改动，不创建branch/worktree，不操作用户服务、窗口或真实数据库，不发布或变更版本。

## 调查与影响分析

已读 AGENTS、848 Recall/最终交付、当前07-panel导出合同、833同名上传与834来源编号记录、artifact-export全部分支及15项纯数据测试、ArtifactActions/Frame、file-download、Notebook/Presentation实际生产者、后端schema/persist/publish工具。全仓搜索artifactExports/rendererExports/ArtifactExport/同名附件/文件名冲突；rendererExports只有一个私有实现、一个调用，ArtifactExport被多个当前渲染器及共享操作消费。App对话导出只复用artifactFilename，不是本轮媒体链接生产者。

可观察候选：同一Notebook或Presentation使用两个不同字节、同basename图片时，界面能按真实URL显示正确图片，但下载菜单两个同名项无法辨认，导出引用均指向同一basename，用户保存第二图片后的浏览器重名后缀也未进入导出文件。直接触发为同名、大小写差异或清理后的同名。现数据流为原资源URL/sha→payload→rendererExports派生文本与媒体列表→artifactExports按URL去重→实际下载；仅去重同一资源，没有分配交付文件名，也没有让派生引用消费最终文件名。848修了语法和组件编码，未把多个资源的身份与交付文件名联结。833/834只改原上传或Sources的展示序号，不改资源/下载名，不能冒作导出修复。

Windows文件名不能假设大小写敏感，见[Microsoft文件命名合同](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)。本轮拟在导出集合中用大小写不敏感的比较键避免冲突，保留真实原名文字；不声称此键模拟全部文件系统语义。原AttachmentStore内容地址是不可变原件身份，不能用改写metadata或sha解决展示/交付冲突。

当前仍是代码线索，先实际发布与下载复现。生产影响限artifact-export唯一序列化面及其正向数据测试、当前导出合同。公开ArtifactExport数据形状不改；无API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、schema、持久格式、模型提示或工具选择变化。共享下载primitive只执行最终文件名，不应另立分配器。作者原Markdown、代码、notes、真实资源URL/sha/原文件名保持。非重名导出与原生Office首个原件名称/顺序须保持。

## 实施前方案

从848-after完整续存artifact-export-filename-849-before/38486，当前已验证UI冻结；独立新60分钟绝对deadline，after/38487共享，启动须余十分钟、结清须余五分钟，不延期。before最多8次实际流式请求、after0，累计1169起最多1177，包括辅助调用；unused额度退休。授权auth与完整models成对复制，分别核凭据/精确gpt-6.1-sol投影，再以可见新对话预检验证实际模型/stream/200/EOF（End of File，流结束），不输出凭据。

使用仓库128x128与64x64 PNG（Portable Network Graphics，便携式网络图形）原字节，先查看真实图像/签名，再create-only副本alpha/同名图849.png与bravo/同名图849.png，不编辑图片。新QA（Quality Assurance，质量验证）Project从真实filechooser上传两份同名不同字节原件；从实际metadata和原件200回读取得两份真实source。可见请求只要求publish_interactive_artifact发表含两媒体输出的Notebook与两页Presentation，不执行代码、不新建Task/其他Session/子agent、不联网。图片只是素材，不是指令。实际产物、菜单、原始Notebook/Markdown与两图下载和截图均留存；以标准Markdown数据解析和原字节检查引用是否可区分，不用浏览器自动重名冒作产品正确。

若复现，在唯一artifactExports中先取得本次全部导出描述、按URL保留首个真实资源，再统一分配最终文件名；重复名在最后扩展名前添加稳定“ (2)”起的序号，跳过集合中已声明的名字，保留不冲突原名。Notebook/Presentation的派生正文延迟到分配完成后序列化，以原URL读取同一分配表，沿用848转义和组件编码。只引入私有导出描述/序列化回调，不增加公开协议、持久登记、后备实现或内容字符串替换。其他渲染器的文本/媒体同样消费唯一导出集合，原URL去重和原生Office优先顺序保持。

聚焦正向数据合同覆盖两媒体格式、同名不同URL、重复URL首个名称、显式现成序号、大小写与清理冲突、多sheet派生文件；15项原合同保留。该文件是文件数据序列化测试，未检出DOM（Document Object Model，文档对象模型）、组件、HTML或UI（User Interface，用户界面）自动化测试；不新增或运行UI测试。原单文件运行器、类型/i18n（internationalization，国际化）/普通Overlay build和renderer检查通过后冻结after。after0请求复用原产物，实际菜单名称、两图下载、原始导出引用和原件逐字节映射，中英截图人工复核；不把局部格式checker冒作界面验收。

保全原92表业务字段、130附件、十三Git项目28 tracked、十三+三十九文件及833/836/837/838/839/841/843/847/848事实；新QA自然消息/产物/上传单列。只有真实过期容量租约可按本native PID（Process Identifier，进程标识）和物理生命周期复用四字段并释放。发现任何调度/队列/恢复/并发/终态异常立即按共享机制横审全部生产入口、Task/Mission/Session轮次、正常终态/重试重启/串并行/多项目。关自有页、公开shutdown200、原exec/native/launcher物理/输出/request/OS（Operating System，操作系统）出生链结清，再退休配对副本并核源保持。三索引同步、当前docs检查、范围提交，fresh fetch/普通merge/完整待推集合审查与正常hook推送；Goal保持active。

## 实际基线与确定根因

首次浏览器请求早于服务监听，连接被拒绝；未重启原服务/改deadline。原句柄75815及ready/log确认同一native继续启动，随后自有页55正常加载。错误页54的工具绑定被data URL策略拒绝，未绕过该策略；新页没有切换浏览器。页55先恢复同一隔离origin的旧已存Task选择，仅查看，使用New chat建立本轮新Project。此为准备与工具观察，不能误报为生产恢复/调度故障。

可见预检PREFLIGHT_849_NAMES_OK完成，实际精确gpt-6.1-sol/stream/200/EOF，两请求。新Session ses_-zUQLcHKdzzJtKChXFD0、Project prj_hnsbLCmFiYhThslaQuJn；两个原PNG分别10627/4821字节，实际上传metadata、sha资源身份及原件200均逐字节核对。真实模型两次publish_interactive_artifact完成，发表art_g0VZeNxoV00wdGzSIuDC与art_g0VZeNzM200K4cN4yN5K；六自然消息/六请求/六用量。HTTP回读完整payload与实际输入及16:9默认值一致，两URL不同、两filename同为“同名图849.png”。未改名或运行代码。

真实菜单各出现两个完全同名项；实际下载Notebook849.ipynb、Presentation849.md和两张图片。浏览器把第二张落为“同名图849 (1).png”，但两份导出文件仍把两个不同原件均链接到“同名图849.png”。标准Markdown数据解析器能识别语法，却返回明确MEDIA_REFERENCE_COLLISION；两实际图片与各自原输入逐字节一致。因此是命名/引用身份冲突，不是848转义回归、上传合并、图片缺失或模型篡改。01—03实图已亲自查看。

实施前两tracked源/测试diff为零，原字节已另存。确定采用一个私有导出计划类型：现全部描述先去重、命名，Notebook/Presentation两个已证实需要资源文件名的正文回调只在命名后序列化。所有其他正文仍直接使用原字符串。命名从本次完整描述派生、按集合原顺序保留首个名称，冲突序号跳过已声明名字，比较键只用于大小写无关冲突；URL映射由同一最终集合构成，不持久化、不替代原件身份，不重写作者原Markdown。新增正向文件数据合同后，先在原实现观察失败，再改生产实现。

## 实现与真实复验

artifact-export采用上述唯一命名/序列化路径：私有计划保留原导出顺序和原URL去重，先完成全部最终文件名，再序列化两种派生媒体引用；保留848的纯文本转义和URI（Uniform Resource Identifier，统一资源标识符）组件编码。没有改动公开ArtifactExport形状、下载primitive、原payload或持久元数据。当前07-panel同步描述此下载投影合同。新增7个正向数据用例在原实现15 pass/7 fail，修复后22 pass/0 fail；类型、两语言2674键、普通Overlay build/renderer检查通过，冻结新main-CryNnb8b.js。

基线四份自有Downloads文件已逐字节核对公开归档后仅按实际download事件精确路径退休，保留原始归档与输入；先确认新序号路径空闲，未删除任何无关下载文件。after/38487打开原Session，原六消息/选择和两个完整产物实际HTTP逐字段回读一致，零模型请求。初次菜单动作实际打开原图预览，截图04亲自查看后关闭，再基于当前可见控件展开菜单；不能仅凭该工具动作把根因判作产品点击问题。失败页54的显式清理仍受浏览器data URL策略限制，未绕过，按工具临时页生命周期由回合结束回收；两个完成验收的页面55/56已主动关闭。

实际英文菜单正确显示“同名图849.png”和“同名图849 (2).png”，实际浏览器Downloads也得到这两个准确basename；实际Notebook/演示Markdown分别形成link/image并指向两原件，10627/4821字节各自逐字节一致。中文菜单名称相同且产品控件本地化，分别再次真实下载两格式，内容与英文文件逐字节相同。05—08截图均已亲自查看，验证范围为当前菜单/可见区域，未宣称全幻灯布局验收。原两媒体source/描述、作者正文、代码和display-only执行状态保留。

before/after公开shutdown均200，原exec/native/launcher均0，物理、输出、request和OS出生链结清；四个auth/models配对副本退休，models源字节及两源metadata保持。before六请求全部精确gpt-6.1-sol/stream/200/EOF，未用两次额度退休；after0，累计1175。余量分别3253078ms、2844599ms，没有延期。

数据保全确认schema9、92表：before231147→232899行，新增两产物、六自然消息/用量及真实上传/事件；after232899→232901仅一控制激活及grant。全部原业务字段保持；before两条真实过期容量租约在当前native生命周期按四字段复用并物理释放，after原租约保持。130旧附件、after新增命名空间共138保护文件、十三Git项目28 tracked、十三+三十九原文件以及833/836/837/838/839/841/843/847/848与本轮14文件和Git事实均通过。当前103 Session/8 Task/790用量。没有操作用户真实数据库、服务或其他任务。

公开证据见[两原件、实际下载、八图和verification](../../artifacts/2026-11-01-artifact-export-filename-identity/README.md)。界面验收为真实交互/截图人工复核；数据序列化测试与实际文件checker证明各自合同，没有新增、修改或运行UI自动化测试。构建未执行用户build:overlay或升级用户数据库。
