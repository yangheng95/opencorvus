# 344 子侧栏来源位置复制

[Recall与实施方案](../source-copy-plan-344.md)。Root单独完成调查、实现、两轮真实页面和人工截图复核，没有开发子agent或新产品成员。

Sources每条可定位来源现在提供独立复制按钮，支持单击、Enter与Space。网页复制真实URL及原编码查询/fragment；文件复制完整path和现有行号格式。主打开动作、标题、来源分组与摘录保持各自语义，缺少地址的document不生成虚构地址。复用createClipboardCopy、Button、Icon和Feedback，值变化/卸载退休、pending与反馈均由已有primitive拥有。

## 真实来源与页面

使用329的实际Task tsk_g00VXnHXUY002nUsxVFT、项目prj_hnAe7JXn1mGYEFjYlQiU、子会话ses_h2A1pB4lrdxKayuXRM03。源库current schema、Task completed/epoch1、两ingress处置、权限/工具/Provider/Message/publication和两Memory idle均已逐项核对。唯一无限期runtime lease的原出生已死；不能把它当活进程。两轮均复制完整90表并逐行比较，不导入拼装消息、不改变Source、不中途重新执行Task。

在localhost:18321/ui的真实Expert Squad子侧栏完成以下人工操作，Root逐张查看截图：

- [01改动前文件来源](01-before-file-sources.png)、[02展开](02-before-file-expanded.png)、[03网页来源](03-before-web-source.png)：确认原来源紧凑、文件只有打开动作，缺少直接复制位置入口。
- [04实际复制第2行](04-after-file-copy.png)：Enter取得完整Windows路径加:2；第3/4行展开后各有独立复制入口。单击第4行复制取得同一完整路径加:4，分别保存原clipboard读回。
- [05原打开行为](05-original-open-line4.png)：点击原Open source file动作仍打开真实文件并高亮第4行，没有把复制并入打开。
- [06网页片段](06-after-web-copy.png)：返回子会话后用Space复制MDN的完整地址，保留#%E5%8F%82%E6%95%B0，显示仍为可读的#参数。
- [07长查询](07-after-long-query-copy.png)：单击复制保留完整查询和编码的北京市，380px侧栏内标题/次行/复制按钮可读。
- [08关闭重开](08-after-reopened-source.png)：同一长查询来源附近的阅读段落和来源分组保持；复制反馈属于当次操作，没有伪装成长期状态。
- [09实际Ctrl+V](09-actual-paste.png)：将真正剪贴板地址粘贴到本轮未发送输入框，人工核对后清空。没有发出新消息。

copied-file-line2/line4、copied-web-fragment/query.json保存实际读取值；这些值由真实页面动作产生，没有从预期字符串写入测试输入。后端Source事实见[canonical-sources](checks/canonical-sources.json)。

## 运行、检查与限制

两轮Source记录6条、Message行14条和持久化Provider request身份15条均与关闭的原329完整相等，新增Provider请求为0。此处15是规范存储的记录数，不改写329独立实际Provider审计17请求的结论。页面130/131关闭；原启动13632/14069均实际join0，Host/Native、输出、请求完整结算，运行228726ms/299283ms，固定600000ms上限未改变。两轮各5份native pile按精确出生归档。无auth/models复制；模型目录未投影的历史阅读提示不是原账户认证失败。

最终overlay类型检查、2语言2136 keys的i18n检查、build通过；main-tuh6dcX2.js实际GET200，before使用main-DE9lj1nS.js。原运行日志、检查输出以gzip无损保留，完整解压字节与脱敏原件直接比较，不使用源码哈希冒充验收。[运行资格](checks/runtime-qualification.json)、[归档记录](checks/archive-receipt.json)和各history目录保存独立事实。

纯UI增量，没有新增或运行UI自动化测试，也没有以DOM文案/截图断言代替人工视觉。此次为已完成历史阅读，没有新实时正文生成或逐帧闪烁资格；原Research Studio209来源、附件/无地址document/POSIX路径与Tauri窗口未在本轮独立呈现。持续goal保持active，单agent继续。
