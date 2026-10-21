# 启动链接与失效目录发现

## Recall

510继续单一开发agent，不委托。用户要求持续自主体验、修复Sources与侧栏Rendering、改善Goal及默认页，并授权“内置浏览器调试”，验证后提交推送。509已推送921fcea57a8d1bcda350b704580c80fd4779cb3c，Rail身份/名称/关联描述及原输入、两来源真实复核完成；原Task链接首次停首页的原因尚未关闭。本轮开始git status只原.bun/及packages/opencorvus/bun/未跟踪，保留。长期Goal中的旧三Astra文字由后续人工单agent要求覆盖。

已重读509 Recall、506首页Goal记录、AGENTS、Project.Discovery/launchDirectory/目录错误分类、global.projects.discover路由、initApp/loadInitialData/restoreInitialWorkspaceLocation/restoreTaskSelection、main的Chat/Work/Mission/launcher恢复、selectTask/applyDirectory、测试隔离preload及成熟509零模型运行器。沿已应用computer-use与benchmark-debug-template技能，不使用UI自动化。全仓搜索发现唯一后端discover实现、唯一global路由、SDK（Software Development Kit，软件开发工具包）既有shape、Overlay工作区服务与ScheduledAutomationsPanel消费者；后端现无launch discovery聚焦测试，服务测试不是视觉验收。

## 修改前根因及影响分析

509-before原私有runtime-dev日志确认：16:23:51.053Z GET /global/projects/discover返回500，requestID 9ecaee9a-9668-4be5-9d63-2255ed58fe88；ENOENT来自project.ts immediateDirectories的readdir，调用discoverFromLaunchDirectory，再到global路由。16:23:51.661Z同一请求导致overlay:runtime initApp失败。原启动helper传入一个不存在的项目目录，不能把测试启动参数错误归因用户数据库，也不能把后续缺模型警告归因凭据问题。

两个共享控制流缺口：后端在读取持久注册项目之前无条件扫描启动目录，因此可选发现根消失/变成文件时，连仍有效的注册清单也返回不了；前端已经解析显式Task/Session/Mission/launcher链接，却先await默认目录发现，导致完全独立且能由global/tasks定位的真实Task不能打开，连后续monitor安装也被跳过。手动点击同Task成功、后续有效默认目录自动打开，符合该调用链；日志与代码共同构成证据，不以横幅、名称或最后错误当根因。

横向审计范围是共享客户端启动/刷新/重连恢复：Task通过global索引获得真实directory并交给selectTask；Chat/Work使用显式directory交给原UI生命周期；Mission先核对真实Session/Mission关系再交原生命周期；launcher用唯一全局composer。各入口保留API（Application Programming Interface，应用程序接口）authority、selection/workspace epoch的现有所有权。正常/终态历史均走同一读取路径；后续重连恢复实际当前选择，不能新建影子启动intent或回到过期链接。多项目由持久Task目录/显式Session目录决定。未观察到服务端执行队列、occurrence、唤醒或终态收敛异常；本轮不改Task/Mission/Session执行/重试/重启/串并行调度，继续以关闭副本的持久事实核对界面读取，若出现执行异常立即扩大横审。

公共Discovery字段root/defaultDirectory/projects不变。root保留原启动事实；无法扫描的ENOENT/ENOTDIR表示当前没有可用默认目录，defaultDirectory为空，持久注册清单仍返回；不自动选别的目录、不创建目录或注册Project、不吞权限等其他I/O错误。现有isMissingPathError已经统一两错误码。Sources/Message/模型内容、配置单一来源、schema3和迁移均不改。风险：错误分类过宽、显式恢复被默认初始化覆盖、晚到响应抢新选择、失败链接误恢复不相干Task、重复加载以及文档合同遗漏。

## 实施与真实验收计划

1. 先从完整关闭509-final读取并serialize全部90表152721原行和完整五键canonical到新startup-location-discovery-510-before；记录源bytes/mtime、schema3、实际对象/integrity及逐行字段/身份/时间。零模型before0/after0，不复制auth/models、不发送业务消息或创建Goal/Task，不操作用户18571。仅启动自有Source CLI（Command Line Interface，命令行接口）开发/ui端口18941/18943，原生20分钟/启动180秒无活动边界。明确传入本轮自有、未创建的launch-project路径，不删除任何旧目录。
2. before使用当前正式509-final前端：实际有效Task链接停首页，记录真实500/初始化错误及人工截图，然后手动同Task能打开、Sources存在。公开shutdown与原exec/native/output/request/launcher/出生身份完全结算，关闭自有页后再实施。
3. 后端唯一discover中对启动扫描精确处理缺失/非目录，保持其他错误合同；增加使用真实临时文件系统/隔离数据库的正向Discovery测试，覆盖有效根/子项目、消失根、文件根的完整输出与注册身份。测试只后端，不新增、修改或运行任何UI测试。前端通过既有restoreInitialWorkspaceLocation先执行有效显式链接，再初始化实际选择的数据；无显式链接仍默认发现并恢复既有偏好，失败仍走唯一可见错误/详情，不加缓存或后备目标。
4. 阅读并更新当前07-panel的启动恢复合同。运行聚焦后端测试、Overlay/backend类型、正式Node构建及docs/architecture检查。构建只校验隔离迁移；不接触真实用户数据库。新after从关闭before完整数据及新正式前端启动，复现同一个失效默认目录场景。
5. 内置浏览器隔离页人工查看Task链接直接打开、两来源/成员切换与隐藏重开、首页Goal入口/说明/取消保留草稿、默认布局；另查看已有Chat/Work及失败链接/全局launcher的实际恢复反馈。Mission正常读取若受零模型投影限制明确未达，不以配置缺失当Mission故障或通过；本轮不为无关执行矩阵扩大Provider预算。每次截图实际呈现人工复核，不用DOM断言/源码文案/截图差异测试替代。缺少的实时流/同文档传输重连继续保留。
6. after公开关闭、全物理结算、两scope0/0模型、全部原数据/源bytesmtime/schema3/canonical核对；只归档必要非秘密证据，完整日志/数据库/全行dump留私有。更新三索引、范围提交；fresh fetch/merge upstream、完整待推集合审查、正常push/hooks/fresh相等。无新branch/worktree/tag/Release/PR，不改版本。长期Goal保持active，未覆盖矩阵如实记录。

## 进度

before18941/原96638/IAB94已真实复现：有效原Task参数页停在首页（01图），同一侧栏原Task点击后正文/两个原成员卡正常（02图）；未发送消息。原日志的缺目录扫描与初始化500保留；模型配置不可用是零模型隔离范围，不是此次链接根因。已公开shutdown200、原96638 exit0、native/output/request/launcher/精确出生链完整结算，94页关闭。90表152721原行全部字段/身份/时间、源bytes/mtime、schema3/实际对象/integrity、完整canonical保持，Provider activity382→382，实际/上限0/0。

进一步读selectTask/applyDirectory确认原导航先核对健康并立即同步真实项目目录，再由唯一reloadProjectScope加载当前项目、hydrate原Task与启动所选读取流，具有authority/selection epoch所有权；无需等待默认发现或新增路由。main的Chat/Work/Mission/launcher也各自拥有原导航生命周期。准备按方案修改唯一启动排序；后端以真实global路由及临时文件系统测试Discovery完整输出，生产修改、after验收和提交尚未完成。

## 实施、真实页面与数据结果

生产只修改project.ts唯一发现实现及init.ts唯一启动顺序：精确ENOENT/ENOTDIR的扫描没有默认目录，仍读持久注册项目；其他错误继续抛原错误。前端已解析的有效非空location通过原导航先恢复，再按实际项目加载初始数据；没有locator的启动仍走原发现与偏好恢复，非法locator和失败资源仍由原settlement发布可见错误。接口shape、SDK、schema3、消息、Sources事实、执行调度及迁移均不变。当前07-panel原本拥有完整locator合同，故更新该事实源，未另建平行reactivity合同。

新增project-launch-discovery后端测试通过真实Server.App全局HTTP路由、真实临时文件系统与preload隔离数据库核对完整输出。原代码有效根/子目录通过、缺失根与文件根各500（原测试exit1）；修改后三项200/完整注册身份与明确defaultDirectory输出全部通过，原65960 exit0。不是UI/DOM/源码文案测试，未运行现存UI自动化。Overlay最初误指定包内不存在的typescript路径，原命令MODULE_NOT_FOUND；改用仓库已安装的node_modules/typescript/bin/tsc重跑原类型检查，95921 exit0；后端82563 exit0。正式Node构建24624 exit0/1分16秒，main-B1unUUgO；实际包存在既有第三方use client/大chunk警告，不以警告数量或构建通过代替视觉。

after18943/原74553/IAB95以同一关闭before完整数据、新正式bundle、仍失效自有launch-project-removed启动，03实图自动打开原tsk_g00VYhVoHG009opnUqaV。05/06实际点击两个成员到DP6d/arXiv和ByPb/ACL身份，原标题/域名卡片、各自正文可读；07隐藏再重开保留B来源。静态Source CLI资源已由新进程捕获，不重建磁盘后冒充正在运行的新包；实际DOM module src也观察到main-B1unUUgO。

10/11实图检查中文首页输入框下持续目标入口/说明、三步指南；英文首页和指南也已查看。12原首页草稿带入创建表单，13关闭保留原草稿；未点击提交，不新建Goal/会话。14实际不存在的Task链接产生本地化反馈和可展开原WorkspaceLocationError，随后从原侧栏选择Chat成功。16刷新同一原Session链接后用户请求/真实OK回复、Code/Chat身份正常；17通过原New chat进入全局launcher并刷新，Work产品/Chat创建意图、原草稿与Goal入口保持。一次将原生summary按Playwright button role查找超时，读取最新AX索引后实际展开，未计第一次为成功。17图全部人工查看，精选13图归档，其余重复/中间视图留私有。

请求摘录进一步确认before ff6c9516-ac65-40a1-85dd-1d44970da9df的discovery500/目录ENOENT与initApp错误同源；after显式Task先走原索引/选择器，后续实际手动GET同缺目录discovery200/4ms、163注册项目、defaultDirectory空。after原日志32次健康读取证明后续监测已活跃；这不等于启动离线恢复或传输中断测试。两个browser dev errors观察都为空仅是补充，原initApp实际错误由产品日志上报，不能以console空否认before失败。

before/after均公开shutdown200、原96638/74553 exit0、native physical/output/request/launcher/精确出生链完整结算，IAB94/95关闭。两scope实际/上限模型0/0、无auth/models副本/凭据使用；全部90表152721原行/所有字段/rowid或主键/时间保持，源文件bytes/mtime、schema3/实际应用对象/integrity、完整五键canonical保持，全部表计数相同、Provider activity382→382。服务原恢复计数Task/Mission均0；结合逐行事实未观察执行恢复/调度异常，修改也不接触这些入口。无用户18571进程/窗口/数据库操作、清库或升级。

局限保留：独立Work会话和Mission正常页未做本轮实页资格；只读筛选没有找到metadata含work的现有conversation，不据此推断功能不存在。startup offline后首次重连代码仍走当前选择/默认恢复，没有取得显式链接在该情况下的实证；也未做同文档实际断流重连。活跃成员流、连续帧Rendering、真实读屏语音、完整149目录性能与Rust父图继续未达，不拿本轮历史页面升级资格。Goal与默认页本轮复核没有观察到新的布局缺陷，不为强造改动增加平行入口。

[完整证据与13张精选实图](../../artifacts/2026-10-22-startup-location-discovery/README.md)。三索引、docs/architecture检查和范围提交/upstream同步/待推集合/正常push继续收尾；长期Goal保持active。
