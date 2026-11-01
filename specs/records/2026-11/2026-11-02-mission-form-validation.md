# Mission 创建表单的本地化校验（886）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）及功能，实际页面验证后提交推送，不操作正在使用的窗口。沿后续明确单agent要求，旧Goal中三Astra文字不再适用。上一轮e9942c249cc8fdcd21ce8f71790fc95341360d4e已真实推送，fresh HEAD=origin/main、0/0；885-final schema9/92表、258768行、100项目及229附件完整合格，原句柄78779 exit0/public shutdown200/物理输出请求与出生身份结清、成对副本退休，累计1260模型请求。本轮保留177项无关改动，不新建分支或工作树。

本轮从任务创建与草稿编辑继续真实体验。代码发现MissionCreateDialog同时持有原生required和现有submitAttempted/titleInvalid/requestInvalid；原生约束校验发生在submit事件前，空字符串可能被浏览器拦下，产品本地化错误与焦点修正无法执行，而纯空白能进入现trim校验。页面现象待本人隔离实页确认，不把代码推断当视觉验收。

验收：空AI请求、手动空标题/描述、纯空白、逐项纠正均使用当前语言的既有字段错误，焦点落到首个需要修改的字段；保留项目、类型、专家团、有效输入与切换模式合同。原生maxlength/required语义及服务端契约保持；在after本人数据中实际保存一份有效、未执行的手动草稿，再通过编辑请求正常保存，读取真实POST/PATCH、GET和持久Session核对文本、目录及backlog。中英文截图人工复核，不启动模型执行。

已读：根AGENTS；885 Recall/完整数据资格/fresh推送；07-panel Mission draft/creation feedback与现Goal单owner校验合同；MissionCreate完整提交、必填错误、表单/控件、复位与值写入；MissionDraftEdit完整目标快照/保存/错误与disabled；TextField、AutoGrowTextarea；mission服务的draft create/edit、生产路由和MissionPendingPrompt schema。全仓搜索missionCreateForm及两个错误键：唯一生产表单和唯一当前错误实现位于MissionCreateDialog；目标相关测试文件清单未发现UI自动化测试，不运行UI测试。其他服务逻辑测试不属本UI改动，不扫描或删除无关测试。

## 修改前分析与实施方案

- 触发与根因：上下文已齐后点击提交空表单，浏览器required校验先于submit事件，setSubmitAttempted(true)不可达；现ErrorMessage虽然完整本地化，却无法覆盖此路径。纯空白不是原生valueMissing，反而走现trim分支。旧实现将原生校验与产品校验并列，未统一提交入口。实页若不符合该推断则先修正分析，不实施。
- 单一实现：确认后仅在现Mission创建form启用noValidate，让已有submit()/canSubmit()/titleInvalid()/requestInvalid()负责提交前错误；不增加validator（校验器）、状态、原生自定义错误或并行提示。现字段required、aria-required和maxlength保持语义与编辑长度控制。现输入仅由本表单onInput写入、打开时清空，没有程序化外部预填分支；非空长度由现控件上限及原服务端schema守护。
- 影响面：同一创建表单AI/手动两种模式、空标题/描述、首错误字段聚焦；上下文前置条件、请求提交/失败Feedback、切换模式与重新打开复位仍由既有owner持有。草稿编辑自身已禁用无效保存，保留现方式，不机械扩张为所有表单。接口、配置、函数签名、错误类型、公共后端、持久格式/schema与数据库迁移不改。纯UI不加任何自动化测试。
- 调度/队列/唤醒/恢复/重试/并发/终态机制不改，manual create与edit仅作为既有生产路径验收；若发现相关异常立即横审共享机制，不归因模型。本轮不评估完整模型工作流，不以0请求页面验收冒充LLM（Large Language Model，大语言模型）端到端。
- 真实数据：只在本人after副本新增一份表单校验验收886（未执行）草稿，初始请求为这是一份未执行的表单校验草稿，仅保存此请求以核对标题和描述；不启动任务或调用模型。保存后仅编辑这份本阶段新记录，追加补充：以当前标题和真实目录为准。全旧业务行必须保留，原用户数据库不作为目标；不直接SQL写入或合成消息。
- 风险：noValidate会取消此form的原生交互提示，需要实际覆盖空串/空白/模式切换和纠正后真实保存；maxlength仍在字段上且后端继续验证。草稿编辑若出现正常revision冲突按现错误保留文本，不放松身份/事务合同。UI截图与真实接口是验收依据，build/typecheck/i18n/CSS（Cascading Style Sheets，层叠样式表）/docs只作辅助。

## 首次资源及顺序

before/after首次模型配额各0；首次prepare前声明75分钟共同绝对截止，预留5分钟闭合，不续期、不加额、不重启失败阶段。源为885-final完整258768行，保护100旧项目业务文件/Git及229附件，认证与完整模型目录配对验证/复制/退休，不输出凭据内容。本人隔离开发CLI（Command Line Interface，命令行接口）/ui/端口38592/38593；before复用885-final main-rfyQogTc.js，after用Node.js构建。不启动独立Vite，不碰用户18571或其他窗口。

1. before实页英语及中文的AI/手动空字段、纯空白与现模式切换，截图人工查看；必要只读控件validity/validationMessage补充可观察事实，禁止断言DOM（Document Object Model，文档对象模型）或截图。正常关闭、原句柄exit0、shutdown200、物理结清/配对副本退休/全数据资格后再改产品。
2. 依确认结果统一现form校验所有权并同步07-panel；执行聚焦构建、类型及语言/样式/文档检查，不运行UI自动化。
3. after中英文实页逐项纠正、模式切换、项目和专家团保留；实际手动保存唯一新草稿再编辑此新请求，真实输入、GET与持久事实正向检查，旧业务数据/项目文件/Git/附件不变。
4. 正常闭合、配对副本退休、全旧数据资格；三索引同步、仅本轮提交；fresh fetch/普通merge、完整待推集合审查、正常hook/push/fresh同步。持续Goal保持active。

## 实际证据

before01/02真实英语空AI请求和手动空标题均由浏览器浮层Please fill out this field拦截；03输入纯空白却能触发现有两个字段错误并聚焦标题；04中文空请求仍出现同一英语原生浮层，已真实截图确认根因。原服务句柄41312消费exit0、public shutdown200、原native/launcher出生身份/物理输出/请求结清、配对副本退休；全部258768旧行保留，总258770（仅本阶段两条运行lease），源数据库/100项目文件和Git/229附件/原认证与完整模型目录元数据保留，schema9/92表，0模型请求/累计1260。

私有请求取证脚本生成时的正则转义在首次启动前发现丢失，已改为直接读取已声明路由的路径结构并经真实Bun TypeScript解析；随后才首次启动原服务，没有重启或延长阶段。该取证仅记录真实POST /mission/draft和PATCH /mission/:missionID/draft输入，不改变产品路由或校验。

## after实页及共享TextField根因追加方案（修改前）

05/06空AI/手动字段已显示英语本地化错误并聚焦首错字段；07纠正标题后焦点进入描述，08纯空白仍走现trim校验。切换模式按现owner清除该次错误、保留输入。09切回新挂载的有效标题后显示正常，只能证明该次重挂载路径，不能据此排除原位纠正问题。

真实手动创建c7f66600b7f80fc0 / ses_-zUQENsLqzzjXteuzqt3成功，11卡片待规划；标题和请求首尾空白沿现submit去除，真实POST、GET与持久Session核对Work、Base、Project journey 773及真实目录通过。12通过现编辑入口补充同一新草稿，真实PATCH带精确expectedRequest，GET与持久Session确认补充文本、同Mission/Session与backlog。空编辑请求时Save draft按现合同禁用，未修改草稿编辑器。原885草稿未编辑。

13/14中文空AI/手动已显示既有本地化文字，15/16却真实发现纠正后标题仍红：标题值有效、原生valid=true、aria-invalid已清除，Root仍有data-invalid空属性，border=rgb(231,152,152)；错误正文已消失。这是新的共享组件根因，不能仅凭字段文本或09重挂载成功宣称已修好。07同现象保留。

已读并横审TextField.Root全部属性构造、label/div两个生产分支、Context/input/textarea的现reactive accessor（响应式读取）、text-field.css当前data-invalid/data-disabled规则、全部Root调用。唯一同语义const shared对象在TextField.Root中，于组件初始化时读取local.class/size/variant/disabled/invalid一次；Context和输入ARIA却继续读当前local.invalid，形成同一字段的静态外层标记与实时内层状态不一致。重新挂载会重取一次，故原位纠正与模式切换挂载时序表现不同。旧仅加noValidate并未解决该共享属性投影，实际触达原校验后才清晰呈现。

动态消费者包括Mission标题/请求、Goal目标长度、通道公开URL、Provider API地址invalid，预览地址disabled、定时字段class；其他Root静态调用也经过同一实现。已检索相同shared构造，当前ui primitive中只有这一处；Checkbox等已有className accessor，不能复制一份局部修正到Mission。相关provider-form.test.ts是纯服务地址/身份数据映射测试，未运行、不改；未发现需要删除的UI自动化测试。

权威依据：[Solid Props文档](https://docs.solidjs.com/concepts/components/props)说明在组件体中保存属性值会失去后续更新，应在绑定/函数中读取；本轮实际代码和上述实页状态已独立证实同一机制。方案：将现shared对象改为现函数读取，label/div的JSX（JavaScript XML，组件模板语法）spread（展开）调用该函数，让同一local props保持响应；不增加缓存、影子状态、effect（副作用）、强制重挂载、特殊CSS或第二校验。相同改动覆盖class/size/variant/disabled/invalid当前公开属性；classList、rest转发、Context、输入事件/refs及数据/函数契约不变。同步07-panel公共primitive合同。

final新阶段首次0模型请求，仍沿本轮最初75分钟共同截止和5分钟闭合预留，不续期、不重启after；基于严格合格且正常闭合的after保留新草稿。实页至少覆盖Mission空字段红框出现→逐项纠正→有效字段恢复中性，以及模式切换/中英文/上下文保留；另在Provider新建表单只输入无效/有效URL，核对共享Root错误样式恢复，不保存配置、不发现模型、不写凭据或发起Provider调用。修复纯UI，无后台/迁移/调度改动；仍禁止任何UI自动化验收。

## final真实回归及最终修订方案（修改前）

17/18保留第一次shared函数spread实测回归：标题纠正后Root样式恢复，但在描述框用真实键盘pressSequentially输入首个x，原错误清除时控件被替换，AX输入18变68，焦点落至页面0。不能交付该版本，也不能以样式中性/构建通过掩盖。实页尚未进行Provider交叉验证，未伪称通过。

根因补充：shared()作为动态spread表达式返回新对象，让该动态属性合并与rest.children处于同次重求值；当前真实运行产生子节点替换，失去编辑焦点。已读当前安装Solid web/dist/web.js中spread的children独立render effect（渲染副作用）、refs与assign路径，保留稳定props对象及按属性读取能让属性更新与children创建分离。修订为现shared对象的class/data-size/data-variant/data-disabled/data-invalid五个getter（取值器），label/div继续展开同一稳定对象；删除刚才函数spread，不增加effect、状态、重挂载或局部样式。公开属性不变，原rest.children归属保持。最终验收必须连续原生键盘输入多字符并确认焦点/选区保持，不能只用fill完整赋值掩盖首字符重建。

final原句柄2011已消费exit0、shutdown200/settle原native/launcher身份与物理输出/请求结清、配对副本退休；严格资格保留258858旧行，总258860（仅本阶段两lease），所有100项目/Git、229附件、源DB和原认证/模型目录保留。final2新阶段首次0请求，沿同一共同绝对截止及5分钟闭合预留，不续期、不重启final；源为已合格final。真实草稿仍沿after唯一记录读取，Provider仅本地输入，不保存。

## 最终实页结果与边界

final2 main-DSE5KBTe.js；19–21英语、22–23中文重复同一AI空请求→手动空字段→逐项纠正路径。原生连续键盘输入Title recovery 886和Keep typing 886后仍分别保持原AX输入14和18、最后光标15，focused=true、aria-invalid和Root data-invalid均已清除、焦点蓝框rgb(91,141,239)，标题失焦恢复中性。中文连续输入同样保留输入13/17及焦点，旧错误正文与红框同步纠正，项目/Work/专家团上下文保留；最终取消，没有重复创建草稿。

24–25真实进入设置/模型服务商/添加，只填写无效not-a-url-886及有效https://example.com/v1。无效地址出现中文字段错误与红框，原生逐字纠正过程中输入320保持焦点，最终caret22、focused=true、Root/ARIA错误清除且蓝框；取消后配置文件与源副本字节完全一致，未点击发现模型或保存配置、未填写凭据。最初exact可访问名称选择器在首字触发错误后名称增加错误文本而失配；读取实际角色后改用已观察到的字段名称前缀完成连续输入。该工具定位问题不当作产品回归；18的原输入失焦有独立实际证据，二者不混淆。

最终真实GET /mission HTTP200及持久Session再次确认原c7f66600b7f80fc0 / ses_-zUQENsLqzzjXteuzqt3，标题、修订后请求、Project ID/目录和Base快照正确，仍backlog。UI（用户界面）验收为25张真实截图、人工查看与原生键盘/鼠标交互；没有新增、修改、更新或运行UI自动化测试。未逐页重验全部15个Root消费者的所有class/size/disabled组合；实际共享修复覆盖稳定属性对象，交叉视觉验收覆盖Mission与Provider，未宣称其他页面全部运行矩阵已复验。

四阶段首次模型配额均0、实际0、累计1260；共同75分钟截止保持且原服务正常退出，8份成对认证/模型目录副本退休。源码最终仅Mission创建现校验入口与共享TextField当前属性读取，不留函数spread中间实现、重挂载路径或影子状态；后端、调度、数据库schema与版本不变。Node.js构建final2、类型、语言2748键、CSS 9052引用及docs 352 ops/26组通过。交付保留原177项无关改动，按当前upstream同步/普通合并、全待推集合复核及正常hook推送，不创建branch/worktree/Release/tag/PR。持续Goal保持active，继续单agent。
