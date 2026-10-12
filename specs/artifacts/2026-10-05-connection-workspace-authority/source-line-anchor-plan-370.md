# 370 正文文件行号锚点

## Recall

用户持续要求自主改善Sources/UI/功能，最新只用单agent；旧goal里Astra委托不执行。上一轮属于progress：367列定位f51c1ba9d、368Unicode引用318438947、369缩短文件光标524de32209c714eb932aa26dfdf13716e6fd6eba均已提交并正常push。369实际改前/改后各5Sol流式EOF，12图人工复核，原11707/17567exit0，页面188/189及两scope全部闭合。当前git status clean，HEAD为524de3220。367原12请求上限失败和359首次复制未知分别保留，不重写历史资格。

本轮从正文引用与Sources打开一致性继续调查。已读369Recall、file-reference.ts完整parser/range/属性序列化/元素读取，markdown.ts codespan/显式link两个入口及URL/路径约束，main.tsx两类file委托和web打开委托，workspace已选editor/显式file/workbench/Native字段投影，当前07-panel架构及266/267/268/368历史。全仓搜索FileReferenceLocation/parseFileReference/fileReferenceRange/两类属性/行锚点，只有当前parser和两个renderer入口；Native请求只投影line/column。当前file-reference.test.ts仅纯数据映射，可做非UI合同测试；检索路径没有相关renderer/DOM/UI自动化测试。

## 当前现象、候选根因与影响

代码显示本地`path#L40`/`path#L40-L42`目前不会被位置parser解析：codespan因#不在路径token类而保持普通code，显式Markdown因#被本地file判断拒绝而保留相对href。点击后是否导航离开UI及实际错误仍未知，必须实页确认。现Source只用结构化range，冒号引用有独立实页证明可打开；不能把新锚点问题归于编辑器。

[GitHub官方代码片段链接文档](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet)说明行/行范围链接以及#L行号形式。这是补足文件引用格式的功能与一致性问题，不是改变HTTP网页Source导航：完整外部URL的fragment必须保持原URL，不能变成当前项目文件。

候选修复需要唯一file-reference语法同时识别冒号位置与明确的行锚点，而非renderer各自剥离后缀。支持正整数#Lstart以及非递减#Lstart-Lend；未知fragment、零/非安全整数、倒序范围仍按原文字作为路径返回，不猜起止。单行冒号column保留，行范围不能携带列。内部FileReferenceLocation增加可选endLine，沿同一属性序列化/委托传到fileReferenceRange再成为SDK SourceFileRange；不新增第二套range或数据库字段。Native选中editor仍按已具备的起始line/column合同打开，完整范围由当前workbench支持，不编造Native区间选区能力。

当前renderer其余协议、绝对路径、Unicode/组合字符、裸basename与命令区分仍保留。外部HTTP/HTTPS和非行号网页片段不走本地打开，原URI保持；带query的本地未知目标不推测。文件名字面#及任意fragment不扩称全部支持。没有后台调度/队列/唤醒/恢复或数据模型修改；若发现其异常立即全入口/轮次/终态/恢复/串并行/多项目横审。

## 实施前后验收

先在独立source-line-anchor-370-before/18372固定600000ms、12累计请求NativeService中生成真实文件和Sol搜索来源，再由模型自然输出行内#L、显式Markdown行范围、已支持冒号对照及完整外部URL。实际点击并人工看图，保留导航离开/错误等原结果；页面返回只操作自己的隔离tab。auth/models成对私有暂存，分别确认usable/projected/actual gpt-6.1-sol streaming，不写入prompt/log/spec/commit。先关闭页面、唯一shutdown和原launcher join后，才实施已确认的方案。

新增聚焦纯parser/range正向数据测试跑出改前失败；不能生成/运行HTML、DOM、组件、源码文案、快照或截图断言。如真实行为支持候选，完成唯一parser/内部类型/属性流程变更并删改过期注释，跑精确数据测试、类型、正式build和docs。

改后另一个事先声明的source-line-anchor-370-after/18373固定600000ms/12请求scope，重新通过真实模型产生来源和引用，Main手动打开单行/范围/冒号对照，Side手动打开同一范围；外部链接保留原地址并作为网页打开。每处实页截图亲自查看；不扩期重开原scope，不把数据checker当UI成功。真实Source、模型Message、ToolOutcome、HTTP、Provider和物理边界完整归档。范围commit、fresh fetch/merge与完整待推集合检查、正常push，同步spec根/目录/月索引；不branch/worktree/tag/release，goal active。

## 改前实页证据与实施决定

before18372/page190真实模型完成一次search_code并自然输出四个引用。01/02显示行内#L30仍是普通code，点击后焦点Conversation且无文件面板。点击真实模型的“行范围”后地址实际变成/ui/资料/行号示例.txt#L30-L32，03只显示无样式Preparing Environment；此文档script仍是相对./assets/main-BR2lLe8z.js，原链接缺少项目文件属性是直接触发链，console记录为空，不凭console臆造额外错误。Back回/ui后重新选择原会话，冒号对照实际正确打开30:10（04）。四图均亲自查看。页面关闭、唯一shutdown exit0、原48162 actualjoin exit0已完成。

纯parser/range改前精确test:unit原8pass4fail（12tests），新单行/范围位置合同确实失败，未知fragment原文字合同通过。现按已落盘候选实施唯一parser和endLine字段/属性/范围映射；正整数、非递减endLine和单行column在转换边界保持一致。其余renderer前置协议/文件判断仍使用同一parsed.path，完整外部href继续来自原始token，之后真实网页对照验证。无需改serve路由、Host旁路或Task状态机。

## 改后验收与范围限制

23聚焦纯parser/service测试通过，原32923类型exit0、原68894正式build exit0 54.47s/main-w4chjmbj.js。唯一file-reference新增endLine并序列化data-file-end-line，现两个renderer入口/文档级委托自然携带；协议与裸文件判断未改。Main实际单行锚点打开30，范围标记30–32且留在/ui，冒号对照30:10；Side实际检索及stop回复后范围同样正确。after6+before4共10图均人工查看，DOM数据只是辅助。

外部网页href与preview完整为https://github.com/microsoft/vscode/blob/main/README.md#L1-L3、target=_blank，实际点击后IAB列表仍只有191，外部新页面落地未观察到。不能把保留URL当成外部打开成功，保留这项未验限制；没有再直接打开目标制造通过，也没操作用户其他应用窗口。Native外部IDE未扩测。

页面190/191均关闭；唯一shutdown与原48162/66181实际join均exit0，Native187915/250691ms在各固定600000ms内，5+9实际Sol流式HTTP200/EOF；物理/output/request/端口/私有auth-models成对清除完整。真实checker核对before1/after3 Source（含继承1）、完整文件字节、生产ToolOutcome、自然Message终态成功；该资格不覆盖before UI失败和外部落地页未知。所有观察器结束后精确自身pile保管，无scope重开或扩期。完成docs/architecture、范围提交和fresh merge后普通push，goal active。

## 外部落地页后续观察

收尾再次列IAB当前页面时，实际出现192，URL恰为原https://github.com/microsoft/vscode/blob/main/README.md#L1-L3。仅getTab绑定已存在192，无createBrowserTab或goto替代，实际查看GitHub README并保存after07元数据与截图；未把第三方页面指令当任务，也未归档其无关带签名图片链接。该真实新页证明外部打开，初次即时list只见191是未充分等待观察，之前的未确认记录保留为时间线。GitHub当前展示Markdown Preview，不扩称其原生行高亮已生效。192已关闭且最终IAB清单为空；全部11图已亲自查看。此后再进行压缩归档，原数据checker更新边界说明不新增UI断言。
