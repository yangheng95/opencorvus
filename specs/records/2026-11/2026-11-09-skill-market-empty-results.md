# Skill Market 成功空搜索的完成反馈

## Recall

用户要求持续按批次调查/分析落盘/真实桌面交互及本人截图/聚焦正向检查/范围提交/上游普通合并/正常推送后继续，直至明确停止；最新要求本人独立，不用子agent。第31批7558bd355已正常推送全部hook通过，main/upstream0/0、原177条状态和空暂存精确保持。Sol授权仍未收到，零模型/凭据；不批准任何技能安装，不碰用户现用进程/窗口或数据。

已读04-extensions全局市场/精确bundle/权限合同、07-panel及07-panel-reactivity投影原则、第31批Recall/真实中英文/接口证据；读取完整市场signals/handlers/render，全部marketResults/setMarketResults/searchSkillMarket调用及同义empty/no-results翻译、SettingsDetailSection/Feedback原组件、global search schema/SkillMarket.search与唯一services/extensions路径。仓库检索到的相关服务测试未运行，未发现触及路径的UI自动化。Solid当前官方[Show](https://docs.solidjs.com/reference/components/show)说明truthy条件与accessor，[For](https://docs.solidjs.com/reference/components/for)明确支持空列表展示；计划使用现有组件，无新增库或公共抽象。

## 实施前根因和影响分析

官方skills.sh公开查询zzopencorvusnomatch20261109b32zz实际HTTP200、skills=[]，不是故障。当前marketResults初始[]，开始搜索也清为[]，成功空数组仍为[]；唯一结果section条件为length>0，空成功与初始/请求中/失败被同一个数组状态抹平。直接触发是合法成功0项被条件隐藏；旧路径只有非空列表，没有保留一次成功搜索的身份与结果，翻译本身不能补回完成事实。仍须本人fresh实页确认后才实施。

方案把同一私有结果signal替换为唯一成功回执{query, items}或undefined：初始/新搜索开始undefined，search成功用本次trim后的query和原候选items一起发布，失败继续现notice且保留undefined。不是额外completed布尔、影子结果或第二数据源。结果section依成功回执存在而显示，原标题/当前语言数字count含0；For空列表呈现现Feedback neutral/status和两语言一键文案，引用已提交query原文并建议换词。输入编辑未提交时仍准确描述上次query。安装后installed投影的唯一setter同步适配同一回执，只更新items且保留query，不改变安装算法或授权。

影响覆盖私有signal定义、搜索清理/成功提交、安装后投影setter、唯一section/count/For消费者、两语言、当前架构/索引。全局搜索服务/API/SDK/Provider/风险算法/详情/权限/配置/持久数据不变，无迁移需求。市场是全局资源，未观察调度/队列/恢复/Task/Mission/Session occurrence异常，不根据局部展示推断运行机制故障。初始、loading、400/502失败不能显示成功0项；真实失败由原notice负责。风险是空数组truthiness误用、accessor越界或丢失候选投影、编辑查询后误指当前输入、语言切换不反应。用Show成功对象accessor/For空呈现、原回执query和渲染时t，以及真实请求切换验证。

## 方案与验收

Temp opencorvus-iteration-20261109-b32，fresh本人profile/项目/私有Git配置，dev38982/38983 /ui隐藏独立页面；前态真实零查询及HTTP200 []、中英截图。改后初始→零成功0/建议、同一结果切中英、输入改react未提交仍引用原query、真实提交react命中列表、再0、超120字符输入由现真实validator发布400错误而非空成功，恢复合法查询。无需人为断网/拦截/mock或注入状态，若不能自然获得某状态则记录未验。真实节点截图逐张本人查看，无UI自动化或源码文案断言。

辅助overlay typecheck/双语检查/正常Node构建和renderer、docs:check/architecture-index；纯UI展示不新增或重复无关服务单测。真实search两类成功和400响应按运行时/doc公开schema正向验证；两个项目原文/Git保持，自己的页面关闭、服务正常shutdown和原session exit0。范围提交三个README仅本条，fetch/普通merge/完整待推集复核/正常push后单人继续，不发版本/tag/Release。低风险/allow/安装和网络502等未体验分支不冒称合格。

## 前态实证与实施定稿

38982/IAB68真实输入同一公开零查询，Loading结束后按钮恢复Search；独立HTTP200 body=[]和requestID保存。01初始、02英文空成功、03同一结果中文，全部本人呈现查看：成功完成后与初始一样直接接Installed skills/已安装技能，缺少结果数量和建议。不是请求中截图或上游错误。自己的基线页已关闭，正常服务退役后实施。方案保持单一成功回执{query,items}/undefined，不增completed或平行结果signal；query为实际已提交trim值，空列表也保留该成功事实，失败继续原错误notice。

## 最终实现和真实验收

唯一marketSearchResult取代原纯数组，成功回执{query,items}或undefined，无平行completed状态。搜索开始清理成功回执/原详情，成功原样投影候选；安装后唯一投影保留query并更新items。Show按成功回执存在，For空内容使用现Feedback/role=status/aria-live=polite。仅增加两语言各1键。没有后端/API/SDK/风险/权限/持久化修改。

overlay typecheck、双语2929键、正常Node构建54.39秒及renderer public surface通过；实际main-WxJflJJM.js，docs352操作/26组及architecture20文档通过。纯UI改动，没有新增或运行任何UI自动化，也未重复不相关后台测试。

38983/IAB69本人04初始、05成功空结果英文0/原query/建议、06同一结果中文、07输入改react但尚未提交仍引用上次query，08真实回车提交react显示10项及原数字分组，09再零项。10/11真实121字符输入返回400，原失败摘要/Details与requestID 0027911c-94f1-43d0-a801-8db82fececaf完整；12带前后空格的合法查询恢复成功0并保留已提交trim后的身份。实际读取Feedback已有status/polite属性，但未声称实测屏幕阅读器播报。

独立TCP（Transmission Control Protocol，传输控制协议）checker（检查器）进入真实公开路由及运行时/doc，以Ajv2020校验成功0、10项、明确400 too_big/query和带空格0四项，均通过。前态PowerShell元数据把空数组经ConvertFrom-Json管道枚举成null；证据文件保留该原parser输出，并注明原工具直接打印Content为[]。后态Node直接JSON解析保留[]，未把null当作真实协议，也未重写请求ID。手动原生Details在AX（Accessibility，辅助功能）显示button但角色locator没有匹配，随后依据新状态用可见“详细信息”文本打开；10截图重新实际呈现本人查看，非产品故障或UI自动化测试。

### 补充查询发现的独立来源合同差异

特殊查询“"空<界面>&查询"”原计划假设200空成功；补充checker实际502!==200失败，该成功验收明确未达成。13/14真实页面显示原错误而非成功0，Details requestID 6e584ad9-597f-4af4-aae8-90f7345cc11d。读取官方API得HTTP200、一个候选id=open.feishu.cn/lark-wiki、source=open.feishu.cn、skillId=lark-wiki，而本地SkillMarket.identity要求owner/repository/skill三段，search对整批map时抛出并asUpstreamError转换502/SkillMarketUpstreamError。故不是编码/网络失败，也不能称上游没有结果。实际官方响应与原本地具名错误完整保存。

第五项真实TCP检查只证明当前502具名错误符合公开schema/operation=search/endpoint，不将其改称新来源搜索成功。来源合同差异影响同一市场共享owner的全局/项目路由、Settings及运行时工具；下一批必须横向调查身份、下载、仓库/信任/provenance/目标路径/manifest、精确安装及历史决定后定方案，不能简单跳过候选、关键词过滤或建立备用协议。本批不混入来源兼容或安装功能。15重新提交原合法零查询成功恢复0，证明UI状态收敛；尚未支持该新身份，不能宣称完全修复Skill Market。

全部15张截图均逐张真实呈现本人查看。两个本人项目原文各44字节、Git HEAD与空配置文件清单在正常关闭后精确保持；两页68/69关闭，两服务18871/89412正常shutdown200/原session exit0，零模型/凭据/安装和用户进程操作。Sol授权仍未收到；安装后投影、真实安装成功/allow、低风险和新来源成功搜索未验。按范围提交/普通上游合并/完整待推集检查/正常push后，优先独立调查新来源差异；原持久路径/空目录搜索等未决仍保留。
