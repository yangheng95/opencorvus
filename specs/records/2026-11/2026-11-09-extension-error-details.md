# Skill/MCP 面板保留完整公共错误诊断

## Recall

用户要求持续独立迭代直至明确停止；不得使用子agent。按批根因与影响分析先落盘、真实桌面/ui交互及本人截图、聚焦正向功能检查、范围提交、拉取普通合并/完整待推集复核/正常推送后继续。前批69006be9c已在origin/main实读确认，HEAD/upstream0/0。原177条工作区状态与空暂存精确保持。Sol凭据使用授权仍未收到，不重复问、不读/复制/使用凭据或模型目录，不发送模型请求，不冒称模型端到端。

已读SkillMarketPanel全部setPanelError定义/16处调用、唯一errorDetail使用、ApiError materialize/message/body/requestID和共享formatErrorDetails/ConfigMutationReceipt脱敏契约、Feedback/Disclosure、纯服务api-error.test、后端validator/badRequestBody、04-extensions/07-panel相关合同及b32原121字符400证据。全仓搜索确认errorDetail仅本组件使用；ApiError在本组件仅为手工编号提取。共享formatErrorDetails已有HTTP方法/状态/路径/请求ID/stack/原response body与已提交配置receipt专门裁剪。未发现或运行触及路径的UI自动化测试。额外planner所有权及空目录搜索仅调查线索，证据不足，不混入本批或称调度异常。

## 实施前根因与影响分析

b32真实121字符查询返回明确400错误，包含data.message与error数组code/path/message；旧Details只有API400 generic message与requestID。代码触发点是setPanelError将errorDetail(error)=error.message和手工编号拼接，而ApiError.body仍完整。数据根因是共享owner边界再次把结构化错误降为字符串；早前全局ApiError和formatErrorDetails修复并未覆盖该局部投影。反馈组件接收到的details已丢失，Disclosure展开不能恢复。先启动新before真实页面确认后才改产品。

影响同一Skill/MCP ExtensionSettingsPanel的市场搜索/检查/安装、载入/添加/导入/移除/更新/open/reveal与MCP添加/连接等全部setPanelError调用。保留原localized摘要key、origin/directory与异步scope检查，不改请求/参数/权限/状态/installed事实。只用既有formatErrorDetails(error)发布details，删除局部errorDetail和仅为手工提取服务的ApiError import。配置已提交receipt仍由共享诊断器保留committed/message/failures，完整config仅保留原business receipt，不能为此次展示另行JSON.stringify全部配置。字符串/普通Error继续现共享契约。完整原技术错误作为诊断事实保留，不以翻译改写原字段与消息；正文、Details标题沿现语言。

无后端/公开API/SDK/配置/DB或持久化变更，无迁移。未观察调度/队列/唤醒/恢复/并发/终态异常；不扩大为Engine审计。风险是长stack影响可读性及敏感配置receipt误展示；复用既有Feedback diagnostic换行、设置页滚动及既有裁剪单一事实来源，以实页截图确认。HTTP诊断保留当前公共响应，不添加网络payload记录或后台请求。额外公开查询只用本人的非敏感测试字符串。

## 方案与验收（修改前）

本人Temp b35两个项目/全新profile/私有Git配置，before38990与after38991开发模式/ui，正常Node构建最新前端再启动after。前态真实121字符查询、展开Details，中英文本人截图，独立TCP保存真实400及请求ID/运行时doc schema验证。after同样操作查看完整method/status/path/ID及原code=too_big/path=query/message；还要真实合法0结果/react命中恢复，确认错误状态经原搜索owner自然收敛。MCP项目载入普通路径及中文导航体验，不为制造故障修改凭据或外部配置；未自然覆盖的故障分支明确未验。

现纯api-error HTTP服务/formatter正向契约可运行，不能冒称UI测试或端到端。UI变更不新增DOM/组件/源码文案/快照/fixture/Playwright test。正常overlay typecheck/build/renderer及docs检查辅助；本人截图才是视觉资格。保存原notes字节、seed Git HEAD、配置清单，两页关闭/正常POST shutdown/原进程session退出。仅本批源文件/spec/artifact与3README本条进入范围提交；fetch+普通merge+待推集检查+正常push，不发版本/tag/Release。

## 尚未达成

原实施待做状态已由下方最终验收完成。Sol及真实模型/Permission/Session链路未获授权；不宣称Skill安装或MCP外部认证成功。长期空目录索引/持久路径演进等待核实事项继续保留。

## 前态确认

38990/IAB76真实121字符搜索，原页面requestID 61f9097a-841c-4fc2-a407-6a1df3bb741c。本人展开Details/详细信息，中英文01/02截图真实呈现并查看，均只有通用Request validation failed及编号。独立实际TCP请求52b8a822-0ff6-438e-82d7-069832e831c4返回400，原body具有too_big/query/明确<=120消息，按运行时/doc公开schema用Ajv2020验证通过，完整保存在before-validation-response.json。两个请求身份明确分开，不伪称同一次响应。原页面关闭，服务正常shutdown200，原session28312退出0。分析和方案不变，开始唯一UI投影修改。


## 最终实现、验证与范围

产品唯一改动为setPanelError直接调用已导入共享formatErrorDetails，移除局部errorDetail函数及仅为手提请求编号使用的ApiError import。原localized summary/origin/directory/权限/请求/状态不改。架构04同步该公共诊断投影合同；新增一个纯HTTP错误对象→明确完整详情的正向服务测试，不是UI自动化，不验证源码文案/DOM/组件。此测试在旧共享formatter本就应通过，真正缺陷前后证据为实际组件调用及01–04实页，不伪称测试曾使旧formatter失败。

聚焦命令均在overlay执行：`bun run test:unit test/api-error.test.ts`为29通过/109断言，`bun run test:unit test/config-mutation-receipt.test.ts`为14通过/42断言；后者涵盖原配置业务快照与精确公共裁剪输出。最后测试仅格式整理构造参数后重跑api-error，仍29/109。两文件均为纯运输/错误数据合同，未运行UI自动化。overlay typecheck退出0；正常Node build57.37秒及renderer检查通过，实际前端main-Knc9Q_NS.js；docs352操作/26组、architecture20文档与精确源文件diff检查通过。语言正文和控件沿既有键，无新增翻译或本轮i18n数目变化。

after38991/IAB77实际121字符查询，requestID 02c2950c-a8fb-4c86-b395-78552fc29629，03/04英文/中文真实截图已本人呈现查看。完整详情可读HTTP GET400/原query路径/请求ID/实际stack/response body，明确code=too_big、path=query和<=120错误。原原生Disclosure可折叠，折叠后搜索控件恢复原位置；没有加入高度阈值或第二格式化规则。05合法零查询自然清除原错误并显示成功0/建议，06真实回车react返回10条原公开候选。07中文MCP面板正常显示配置0/空状态；未人为注入MCP故障，不声称其外部连接/错误分支实测。7张截图全部本人查看，无自动截图断言。

前后独立TCP各一次真实400按运行时/doc及Ajv2020校验，after请求ID dbebd730-1539-4c13-9545-94c92591418c，before与after公共body完全一致。它们与两次UI请求身份不同，分别记录，不伪称浏览器网络抓包。check-tcp.mjs保留明确status400/data.message/error.code/path与schema检查，可复跑当前真实服务器，无fixture/mock。页面上的成功0和10条由真实本人交互/截图确认，不用独立请求代替视觉资格。

两页76/77关闭，服务28312/54245分别正常shutdown200、原exec session退出0。原notes分别38/37字节、worktree内容、seed提交内容和Git HEAD均精确保持，profile配置清单均空；数据/receipt schema/SDK未修改，零凭据/模型/真实Skill安装。Sol、Permission/Session完整链路以及MCP外部认证/安装成功等仍未验，不能宣称全产品端到端合格。当前批范围只修复同一面板的诊断信息丢失，后续继续独立调查。

## 提交与同步

提交前范围限定为组件、纯服务测试、当前架构04、本记录/7图及响应/检查器/测试输出/项目核验、三个README仅本条。保留原177条工作区状态和空暂存基线；提交后按既有授权fetch/普通merge、完整待推集审核及正常push，不创建新branch/worktree/tag/Release。推送最终事实在下一批Recall据实际sha记录，不在推送前预报成功。
