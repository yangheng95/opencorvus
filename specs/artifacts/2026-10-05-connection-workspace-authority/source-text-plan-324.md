# 324 来源纯文本的实体与结构

## Recall

用户要求持续自主体验修复UI（User Interface，用户界面）、Sources/子侧栏Rendering与功能；最新明确单agent，覆盖旧goal的多Astra措辞。323已推送76531c1161cf20af98b4ac3be41b18f981476455，当前git status干净；前轮判定progress。真实W3C XHTML读取的markdown出现`غرب`，text却返回`&#x063A;&#x0631;&#x0628;`，证据在[source-mime-323实际Tool输出](source-mime-323/actual-source-contract.json)。旧局部测试还预期`Format &amp; 标题Actual headingActual body`，证明块文本和实体没有语义转换。

已读323 Recall、完整webfetch及其参数/说明、source-title/body/fragment后端合同、07-panel、package.json/bun.lock、唯一extractTextFromHTML调用与全仓同语义搜索。现有Domino仅在标题/Turndown解析使用，其随包README明确不作为通用DOM（Document Object Model，文档对象模型）实现维护。没有现成的纯文本格式化primitive；不新增UI自动化测试，不运行依赖包的浏览器测试。

## 根因、范围和旧路径

extractTextFromHTML采用Bun HTMLRewriter累加input.text。该文本为原始片段，未执行实体解码；没有块/换行/列表边界。一个布尔skipContent由忽略元素开启、任何其他起始标签关闭，却没有元素退出语义，因此忽略元素后的未包裹尾文本可能被吞掉，嵌套普通标签也可能解除父元素的忽略。必须以真实HTTP正向用例分别复现，不能只以代码猜测当已验收。

调用范围为唯一webfetch的HTML/XHTML format=text；普通Chat、Task、Mission、worker通过同一Tool。323的媒体类型修复只修判别，没有改变此算法。metadata标题、Sources原URL/ID/持久化与markdown/html输出不变；无新API（Application Programming Interface，应用程序接口）或SDK（Software Development Kit，软件开发工具包）字段/路由/存储迁移。网络请求、redirect、5MiB响应上限、已有输出截断/附件、超时和取消仍属原HTTP body owner。没有调度/队列/唤醒/终态异常证据。

## 唯一替换方案

使用专门的html-to-text，不自行补实体正则或维护HTML块标签遍历器。已查[上游README](https://raw.githubusercontent.com/html-to-text/node-html-to-text/master/packages/html-to-text/README.md)及npm官方registry：当前10.0.1、MIT、Node>=20.19，提供实体/块/列表/pre处理和同步compile；类型声明当前@types/html-to-text 9.0.4，所用公开选项在上游文档一致，须用实际类型与Bun1.4.0运行验证。Node25.7已可用。不升级全局Bun或其他无关依赖。

在核心package按现有单一依赖面精确添加版本并更新bun.lock。只保留一个compile配置和一个当前转换器，删除原HTMLRewriter/skipContent实现与多余await。固定处理整个解析输入（包含片段），非正文head及script/style/noscript/iframe/object/embed按子树处理；链接保留文字、图片不注入URL，标题文字不强制大写，不额外折行。段落/列表/br/pre由库的文档语义处理；Source的文档title仍在原metadata中，纯文本不再重复head标题。不会增加额外fetch、运行远端脚本或进行布局/可见性推测。

接受的HTTP字节上限5MiB低于库默认16Mi字符上限，因此库不会先于原边界隐式截断；最终转换文本继续由formatFetchedText执行既有UTF-8字节预算。风险为text格式从原始拼接变为结构文本、增加纯JS解析依赖与运行时兼容性；更新旧错误预期，不保留旧路径。

## 验收

先在现有真实本地HTTP的webfetch-source-title用例扩充正向输出：十进制/十六进制/命名实体与非BMP字符、临近段落和br、内联词缀、列表、pre缩进、忽略元素后的真实尾文本、嵌套忽略子树后可见文本；同时断言规范Source不变。先取得原实现失败，再安装依赖并替换，重跑同一测试与source-fragment/body边界，核心typecheck、package topology和docs。所有断言针对实际非UI输出，不做UI源码/DOM断言。

新正常开发/ui18294，auth+完整models授权配对、目标模型投影及实际gpt-6.1-sol流式预检；普通单人Work Chat仅读取323相同公开test.xhtml的text并对照markdown。原累计12请求上限/NativeService固定截止与活动检查，不启动产品worker/Task、不延长旧scope。实际Tool输出证明Arabic字符已解码、正文结构可读；Sources标题与网页人工截图复核，不能把模型自述、测试夹具或类型检查冒充页面验收。

如新的实现或检查器失败，保留原失败、修根因并重跑。完成自己的页面/所有原handle join、Native/Host/端口/复制配对清理，归档脱敏真实数据；根/月/目录与07-panel更新并运行现有文档检查。范围提交，fetch/merge upstream、审阅全部待推送提交并正常push。持续goal保持active，不把本批完成等同所有体验问题消失。

## 完成后的Recall

真实红测确认六类输出问题，记录在[结果](source-text-324/README.md)。单一库转换器替代旧路径后实体/块/尾文本/嵌套/列表/pre均通过；新增链接/图片保留契约也进入实际HTTP并通过。当前9个唯一聚焦用例合计77断言，类型、接口、包依赖和文档通过。没有其他caller或旧提取别名残留。

真实普通Chat `ses_-zUSD61nszzp9Buuhd3w` 对323相同public XHTML执行text/markdown，当前纯文本两处Arabic行均为真实`غرب`，换行及pre缩进由规范Tool输出证明，Source保持原标题/URL；6次实际gpt-6.1-sol流式请求正常结束。页面截图人工查看，不依赖模型自述。旧数据比较器一处错误换行假设已修正，并保留原失败；没有改历史输出。

页面96已关，Native36012/Host70104及原启动41028物理退出0，类型64388和测试45164也已actual join0；18294/复制配对清理完成。剩余仅范围提交、fetch/merge和完整push检查。持续goal active，单agent，不宣称全产品完成。
