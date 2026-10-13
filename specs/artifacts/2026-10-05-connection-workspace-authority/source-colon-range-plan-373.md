# 373 正文冒号行范围引用

## Recall

用户持续要求自主改进Sources/UI/功能，最新明确仅单agent。上一轮progress：372的db31a7159e6d1b5aada19c9ed304786513deb305已正常push，当前main与origin/main同步且工作区clean。54聚焦合同、15人工图、各8Sol流式EOF、原15809/31997和两固定scope均闭合。此轮从372真实自然回复中的`格式/cross.txt:2-3`普通文本继续，不改写此前范围按钮已通过的事实。

已读372完整Recall、370行锚点方案，当前file-reference完整parser/range/属性、SourceParts的fileSourceLocation与copy值、markdown两个文件识别入口及协议约束、main委托、workspace Native/workbench路由、file-workbench range契约及07-panel相关架构。全仓搜索FileReferenceLocation/parseFileReference/fileReferenceRange/openSourceFile/fileSourceLocation。当前Sources显示/复制本来就输出path:start-end，正文唯一parser却仅识别:line[:column]与#Lline[-Lend]。相关file-reference和file-workbench测试为纯数据/服务合同，无DOM/渲染；不运行或新增UI自动化测试。

## 根因、影响和实施方案

372实页及自然模型文本已显示缺口。直接触发：冒号范围未被parser剥离；codespan路径token含未解析的冒号而保持code，显式Markdown末尾不是扩展名而不能成为项目文件操作。显式链接是否导致离开/ui、实际错误仍需本轮实页确认。Sources按钮直接携带结构化range所以已正常；不能再修改编辑器或Source范围数据来掩盖解析缺失。370只补了#L格式，本轮补当前Source本就使用的冒号范围。

扩展唯一LOCATION_SUFFIX_RE，支持正整数:line-end，与:line:column互斥；沿既有endLine字段、data-file-end-line、fileReferenceRange和公共SourceFileRange传递。端点均须安全整数且end>=start；无效范围保持原引用文字作为path。保持单行/列、#L、Unicode/组合字符、Windows drive语义；不新增单独renderer解析器、全局状态、接口或数据库字段。更新已过期语法注释与当前架构。完整外部URL仍由现有scheme/原href路径处理。任意复合后缀和文件名字面冒号不扩称已定义新语法。

影响只在共享正文文件引用解析，Main/Side和两类Markdown入口均受益。Native已选编辑器仍用其已有起始行/列合同，桌面工作台支持完整行范围；本轮不操作用户外部编辑器。无后台调度/队列/恢复/并发修改；若发现相关异常立即横向审计共享机制。359首次复制结果未知不以本轮范围解析成功覆盖，也不增加双写/重试剪贴板绕行。单反斜杠代码的路径歧义另为未知候选，不加关键字过滤。

## 验收与交付

预先声明source-colon-range-373-before/18378与after/18379独立NativeService，各固定600000ms、12累计请求，不扩期或重开。授权auth与完整models成对私有复制，分别验证usable/projected/actual gpt-6.1-sol streaming。自身新项目编写40行Unicode文件，真实read offset20 limit3生成Source，模型自然输出相对codespan、显式Markdown、绝对Windows范围、#L对照与单行列对照。真实/ui点选并人工截图，保留改前实际行为；只操作自建页面/服务/文件。

改前新增聚焦正向parser/range合同，精确运行overlay test:unit原入口；不测试HTML、组件、DOM或截图断言。改后精确合同、类型、正式build、docs与architecture检查；新scope再次实际Main引用，顺序打开产品Side会话验证相同范围操作，不进行任何开发agent委托或并行agent工作。实际模型请求/消息/ToolOutcome/Source、完整文件字节、Provider/Native和截图分开归档，原launcher join并闭合全边界。范围commit，fresh fetch/merge及完整待推集合审查后普通push，不新分支/worktree/tag/release，goal active。

## 改前证据与实施决定

精确overlay parser合同16pass/5fail，新冒号范围四个解析与统一range映射失败；既有单行列、#L及无效引用原文合同通过。before18378/page197真实read产生20–22 Source和自然五项回复。点击行内范围后焦点仍Conversation且未打开文件；显式正文范围实际导航到/ui/资料/范围示例.txt:20-22，02为无样式Preparing Environment。Back返回自身/ui并从真实列表重新选择会话后，Source按钮实际打开20–22，单行列20:4正常。4图已人工查看。原37511与唯一shutdown均exit0、5 Sol流式EOF、全物理/output/request/端口/成对凭据关闭；没有把启动页故障归为任务调度异常。现在实施唯一parser分支及过期语法注释，不改路由、文件加载或编辑器导航。

## 改后验收与收敛

32聚焦parser/service合同通过；60893类型exit0，82967正式build exit0 53.91s/main-B5ENb1Oe.js，docs/architecture通过。after18379/page198 Main相对codespan、显式Markdown、Windows绝对范围实际打开20–22并留在/ui；#L20-L22与20:4对照正常。顺序进入产品Side（无开发agent委托），实际read完成后两种范围引用都激活File并显示20–22。改前4+改后8=12图全部人工查看。

原37511/70590实际join exit0，Native207158/460397ms，各5/9实际Sol流式HTTP200/EOF；全物理/output/request/端口/临时auth-models pair、页面197/198闭合，最终IAB为空。真实checker核对完整原输入字节、Source1/3（Main/继承/Side）、自然Message、实际read完整输出、HTTP/Provider/Native，未添加UI断言。归档AX原文时直接完整压缩并保留私有原件，不修改原生空白。范围commit、fresh upstream合并和普通push后继续goal active。

绝对范围after03实际仍显示Read only，而同文件相对引用可编辑；这是现有workspace absolute-source分类的语义差异，此轮只交付范围解析，下一轮先审查其权限及资源身份合同再决定调整。Native外部编辑器、359首次复制及非UTF8编辑不扩大为已验。没有新调度/恢复异常或用户进程操作。
