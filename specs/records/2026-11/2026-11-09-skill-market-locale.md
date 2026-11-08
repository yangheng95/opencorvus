# Skill Market 数量与风险本地化

## Recall

持续批次迭代，先根因/影响落盘、真实开发模式 /ui 桌面交互及本人截图复核、聚焦正向检查、范围提交、上游普通合并和正常推送，再进入下一批。用户最新要求“不要用子agent，你自己工作”，本批独立。b30 0f61f65d9 已正常推送，main/upstream 0/0，原177条他人改动保留。Sol凭据授权仍未收到，本批零模型/凭据，不安装任何市场技能。

已读当前04-extensions市场authority/精确bundle/权限合同、07-panel语言/错误合同、SkillMarketPanel搜索/检查/确认/展示及全部risk/count调用、services/extensions全局路由、SkillMarket wire schema和SkillManager.inspectMarketBundle/riskForMarketFiles、i18n插值和localeTag、现有Intl.NumberFormat调用及11月技能发现记录。全仓定义/同语义检索确认review风险与确认风险共两显示消费者，颜色判断是独立原枚举；未发现现有公共risk标签。检索到的settings-save-transaction和mission-skill-service是纯服务检查，不是UI自动化，本批不运行或扩展它们。

## 实施前根因、影响与未知

可观察线索：官方skills.sh公开搜索2026-11-09实际HTTP200，react候选有880329/1299187等六七位安装量。当前列表将installs:number直接传入t，fillTemplate仅String(value)，没有当前语言数字分组。review的risk.level和安装确认也直接插值原low/medium/high；文件字节size直接模板化。必须先在本人独立实例实际确认，不以代码代替视觉验收。

直接触发点是产品展示没有把机器枚举映射到现有语言面，数值没有进入现有Intl.NumberFormat(localeTag())。旧翻译只翻译外围“风险/次安装”，因此中文仍混原英文枚举，长数字难读。数据/API本身有正确非负整数和封闭风险枚举，不是丢失数据。市场搜索/详情是GLOBAL资源，不把其没有项目目录误报为项目并发归属问题；无Task/Mission/Session occurrence调度、队列、恢复或终态异常实证。

拟范围仅SkillMarketPanel及两语言，各枚举增加低/中/高标签，两个真实显示调用共用一个私有函数；当前语言的Intl数字函数供安装量、文件字节和结果数使用，保留精确整数、B单位、原文件路径/名称/仓库/内容hash。确认框policy若也是原allow/deny，使用现已存在的当前策略标签，先核对现有唯一映射。语言切换必须即时重绘已加载详情。原枚举比较、risk算法、recommended_policy、安装expected_hash、installed投影、加载/错误/路由/权限均不变，无持久数据/迁移/SDK变更。真实内容hash用于不可变bundle授权，属于有效完整性校验，保留。

风险：误翻译上游原文或技术身份、改变风险/权限策略、渲染时未追踪locale、改变字节计量、确认取消后误写。保留原身份与数值，标签只在渲染/打开确认时读取当前语言；先审查nativeConfirm为showAppDialog且批准前才install。仅打开确认并取消，不批准安装；检查原详情/配置/managed目录状态。所有网络只读取公开react/候选，无私有输入。空搜索反馈为独立候选，本批不混入。

## 方案与真实验收

Temp opencorvus-iteration-20261109-b31；本人fresh前后profile、项目、私有Git配置；dev38980/38981，通过/ui隐藏独立页进入设置Skill Market，搜索公开react、检查实际候选，截图中英列表/风险/文件字节/确认并取消。详情下载公开bundle并解析，不执行其中内容。若上游详情接口故障，保留真实错误证据，不能用fixture或响应注入冒称通过；按实际可达范围收敛。截图逐张本人查看，禁止UI自动化和源码文案测试。

实现前补充实际页面前态后定稿；辅助overlay typecheck/check:i18n/正常Node构建、docs:check/architecture-index。无非UI实现变更不添加重复单元测试；实际公共search/detail响应与页面信息对应作为真实服务路径证据。服务正常POST shutdown及原session exit0，关闭自己的页，保持项目原文/私有Git和原177状态。精确提交三个README仅本条，fetch/merge普通上游、审查完整待推集、正常push，不发版本/标签/Release。

## 前态实证与实施定稿

38980/IAB66真实search得到10项，01本人查看880329 installs等原数字；02英文详情/76文件，03中文同一详情medium 风险、108261 B。04实际确认框为风险medium/策略deny，随后真实取消并关闭页。真实search/detail HTTP200分别保存JSON，详情id、hash、76文件及首个108261字节与界面一致，installed=false/recommended_policy=deny。源名称/描述为原公共内容，不应翻译。确认框批准前才会install，取消保持详情可操作。前态正常shutdown200、原session25878 exit0。

首次私有启动漏OPENCORVUS_TEST_PROCESS_ROOT而被隔离保护拒绝，未监听；读取runtime-paths后补配同一Temp绝对父路径再启动成功，不修改保护或绕过hook。当前方案按已证实范围实施：私有marketNumber复用Intl.NumberFormat(localeTag())；marketRiskLabel由封闭枚举到三条词键，两消费者共用；确认policy复用既有skill.policy.allow/deny词条。中文外围风险改为无多余空格的{{risk}}风险；产品身份/hash/字节/B/算法与授权保持。低/高风险实时候选未体验，不可从medium截图冒称全覆盖。

## 最终实施、真实验证与边界

按定稿实现私有marketNumber/marketRiskLabel和两语言各3键，确认策略复用原词键。overlay typecheck、双语2928键、正常Node构建50.63秒及renderer public surface通过；实际改后main-CZKbjVR4.js。docs:check 352操作/26组、architecture-index20文档通过。纯UI展示，没有非UI实现变化，未新增或运行UI自动化，也未重复不相关服务单测。

38981/IAB67实页05英文列表880,329等分组；06英文Medium risk、AGENTS.md 108,261 B，07确认Risk Medium/Policy Deny；08同一已加载详情切中文中风险，09确认风险中/策略禁止。10中文列表880,329 次安装，11真实滚动可见1,299,187 次安装。12/13原react搜索第四候选react:components的真实检查，11文件/has_scripts=true、原risk=high：高风险和确认风险高/策略禁止，14同一详情切回英文High risk。所有确认均真实取消，未批准安装；全部14张截图逐张呈现本人查看，原上游名称/描述/仓库/path/hash完整保留，不翻译原事实内容。

真实TCP（Transmission Control Protocol，传输控制协议）search与两个detail返回200，用运行时/doc公开schema和Ajv2020验证3项均通过。首详情完整JSON与前态相同，含76文件、首文件108261字节、原hash/risk/deny/installed=false；第二详情保持high/has_scripts=true/deny/installed=false。不是静态文案或fixture证明。两个本人项目各53字节原文、Git HEAD和空配置文件清单在正常退役后精确一致；原managed安装未触发。前后两页66/67关闭、两服务25878/25585正常shutdown200及原session exit0，无用户进程/窗口操作，无模型/凭据。

低风险自然候选、allow策略确认和安装成功路径本批未体验；安装未授权也不是本批展示目标。上游故障/空搜索反馈/慢并发归属未在本批实证，不冒称解决；GPT-6.1 Sol因授权仍未收到而未达成。原空目录搜索、持久路径演进、root缺失视觉/Windows移动拒绝handle调查继续开放。接着范围提交、fetch普通merge、完整待推集审查、正常hook/push，再单人下一批，不发布版本。
