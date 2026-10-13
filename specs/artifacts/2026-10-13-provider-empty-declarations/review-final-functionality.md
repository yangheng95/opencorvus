# 第11批最终只读复核与下一批功能 intake

## Recall 与范围

Root 委托核对第11批两个 Config primitive 是否进入并行提交9438501d5、24项正向测试与当前HEAD是否仍相符；另只读调查无Key保存后的Provider catalog刷新和IPv4自动ID。只写本scratch，不改产品、测试或共享spec，不使用凭据、不运行测试/UI自动化、不操作服务、不再次委托。本轮读取时HEAD为3c5adc5bf，工作区包含并行ACP/FileExplorer及本批Panel/locale/测试等改动，全部保留。

## 1. 两个 primitive 已被9438501d5集成

已直接读取 `git show 9438501d5 -- packages/opencorvus/src/config/config.ts`、零context hunks、当前HEAD源码和git blame，不靠提交标题猜归属。

提交：`9438501d5d6eaa627cd7276d481f1dfc2696b7b1`，标题 `fix(config): preserve declared layer inheritance in reads and writes`，2026-10-14 00:10:01 +0800。

| 第11批修改 | 该提交精确hunk | 当前行与归属 |
| --- | --- | --- |
| patchJsonc在record递归前观察目标；缺席/非record目标以原modify/applyEdits初始化{} | `@@ -2557,0 +2600,11 @@` | config.ts2600–2610，全部新增行由git blame指向9438501d5 |
| mergeWithNullDelete仅在source非record时整体替换；record source从原record或{}开始 | `@@ -2587,2 +2634,2 @@` | config.ts2634–2635归9438501d5 |
| 对所有record子值递归，包括原目标缺席/scalar | `@@ -2592 +2639 @@` | config.ts2639归9438501d5 |

两个函数的行为与本批方案/红绿完全一致；JSONC null删除、原record成员、array替换、mergeOverlay/preview原structuredClone及schema调用保留。`git diff HEAD -- config.ts`为空；`git log 9438501d5..HEAD -- config.ts`为空。因此不是产品改动遗失，也没有待本批重复实现的同一差异。当前config.ts的Source/defaults/Skill类型改动仍属于395，不能把整文件重新归为第11批。

归档归属边界需说明：395的 `specs/artifacts/2026-10-13-sparse-config-layer-defaults-395/implementation/config-hunk-split-review.json` 只把第10批JSONC formatter/import两项列为external；其记录时点没有把上述第11批RFC primitive列为external。这份早期split报告不能代替最终commit内容检查。Root后续第11批交付说明应明确“两个primitive已由9438501d5先行集成；本批交付其测试/Panel/文档及验收”，不能说本次待提交diff仍包含这两段。无需也不建议通过回退/复制补丁重写既有历史。本轮未核验remote是否已包含9438501d5，不将本地存在写成已推送。

## 2. 24项测试仍对应当前实现

`packages/opencorvus/test/provider-empty-declarations.test.ts` 当前仍为未跟踪文件，24项循环展开合同与最新源码对应：

- direct mergeOverlay缺prompt、preview empty/已有override、mergePatch缺席/scalar nested null；
- global/project JSONC scalar→{}、missing nested deletion→{}、record+{}完整source保真；
- models-only:{}、absent与{}保存，catalog模型继承/同ID覆盖恢复；
- 清空最后未引用模型保留Auth事实；model与agent引用400及持久原模型；project覆盖删除恢复global。

原exec74714已实际exit0，`backend-expanded-after.log/.exit`分别记录24pass/92断言、Conversation1pass/3断言、Mission2pass/3断言；日志中三个文件均DONE exit0。测试文件最后写入时间2026-10-13 23:49:45，日志最后写入23:50:24；本轮只读确认其内容，没有重跑当前完整HEAD。config.ts目标primitive在提交后未变；不能据此把其它并行文件的后续变更自动称为新一次完整HEAD绿测。原18绿42617、初始13红95584、共享18红5296与最终24绿日志继续保留。

`packages/overlay/test/provider-form.test.ts` 当前只有新增99行（10个空集合纯数据用例），既有helper源码未改。其原21pass/61断言是helper数据合同，不能证明Panel按钮的UI资格。第11批余留仍包括本测试文件入库、Panel/locale及文档的范围交付；root已另持有实页、TCP、Sol证据，本报告不重复冒称亲自验收。

## 3. 下一批候选A：无Key保存不刷新当前Provider观察

### 源码完整链

1. `ProvidersPanel.tsx:615–676` 捕获同一scope/occurrence后保存配置。唯一 `refreshAuthState(options)` 位于非空 `if(apiKey)` 分支内（670行）；未填Key直接关闭表单。
2. `services/config.ts:453–483` 的 updateConfigPath重读当前配置、应用field intent、发送merge patch，最后仅 `setAppStore("config", saved)`。它不发布Provider catalog或`providerAuthRefreshRevision`。
3. Provider catalog唯一正常赋值owner是 `services/config-load.ts:169–269`。它按authority/sequence/directory接受请求，独立提交catalog/Auth/config结果，并在catalog/auth成功后递增providerAuthRefreshRevision。
4. Panel `:254–278` 的自动重读依赖只有activeDirectory、API authority revision、board selectEpoch；config store变化不是该effect依赖。显式目录/模型刷新 `:280–294` 和认证/Key后续会重读。
5. 全仓loadProviderInfo生产caller还包括ComposerModelSelector的 `loadProviderInfoOnOpen:350–370` 与ScheduledAutomationsPanel初始化；Composer只在打开选择器时执行该动作。它们可在稍后修正观察，但不是无Key保存的即时后续。
6. 事件链未提供隐式catalog重读：backend global config发布`global.disposed`，Overlay event-policy:33将其列为显式no-op；现有`config.changed`事件handler（events.ts386–395）拥有Session overlay重新投影，不调用loadProviderInfo。reloadProjectScope也只loadConfigInfo/扩展/meta/tasks，不发布Provider catalog。全仓未发现另一个catalog赋值或保存事件重读owner。
7. `services/llm.ts:177–181` 的providerApiKeyConfigured只读取当前catalog的可选boolean；旧catalog无新ID时为undefined，catalog请求失败保留旧行但返回unknown。`providerConnected:168`、providerState和模型选项同样消费catalog，而Panel custom行name/modelCount来自刚更新的config。

### 可观察影响与边界

在同一已挂载Provider页面、不切scope、不打开Composer/执行显式刷新时，无Key创建新Provider会先有新config行，却还没有该ID的catalog观察，Key状态可能保持unknown；对既有Provider新增/清空模型或改变env等，config数量与旧catalog connected/credential事实可能来自不同时间。即使已有Key，用户本次未填写Key也走同一分支。旧目录issues亦可能继续显示，直到owner下次重读。

这是有完整调用链的候选，尚未由本轮真实页面/网络时间线证明具体视觉结果或持续时长。不能说所有保存都失效：有Key路径重读；打开Composer、重新挂载/切scope、手动刷新也会获得新事实。也不能先把旧boolean改unknown影子标记来遮蔽应重读的唯一owner。

现有规范06-provider要求current-observation三态与独立owner部分成功；第11批spec第29行已明确记录“未填Key保存仅更新config store”作为独立边界。git blame显示条件Key分支来自保留基线65d0bfc98，带authority的refreshAuthState调用由677f7afd17承接；不是第11批删除models guard才引入。

建议下一批资格：fresh自有global/project页面，新建无Key零声明→同页观察→直接公开catalog读取明确false→显式刷新后对照；已有虚构Key零声明增加模型→同页connected/数量→显式刷新对照；保持一个旧失败issue后修复配置并无Key保存→明确新catalog结果。全部只用自有样例，不需真实LLM。若决定修复，复用现有loadProviderInfo和scope/occurrence fencing，保持configCommitted后续错误事实；不要新增平行凭据推断。

## 4. 下一批候选B：IPv4自动ID取了域名启发式片段

唯一实现为 `ProvidersPanel.tsx:545–553`：标准URL取得hostname，按`.`分段，分段至少2个时取倒数第二段，再sanitize。`formProviderId:556–558` 优先级是editing ID→显式formId→name派生→API派生；因此仅在新建且显式ID/name均为空或不能形成ID时触发。

由当前源码可确定的值：`http://127.0.0.1:18590/v1`→`0`，`http://10.0.0.7/v1`→`0`，`http://192.168.1.40/v1`→`1`。端口和路径本来不参与hostname。这里不是URL非法；第五批接受合法IPv4 API地址，Config.Provider及record key也不拒绝`0`。

此ID被同一函数用于高级区提示、Save按钮资格、配置record key、后续Auth ID，以及Discover传入providerID。`provider-form.applyProviderForm`新建同ID冲突仍返回PROVIDER_ALREADY_EXISTS，所以不能称为默默覆盖配置。风险是不同IP被折叠到相同无辨识短ID，第二次新建需要用户纠正冲突；当前没有本轮真实页面、冲突流程或凭据交叉使用证据，不据ID名称臆测安全泄漏。

全仓未发现其它providerIdFromApi或相关数据测试。`git log -S 'function providerIdFromApi'`最早保留快照为65d0bfc98；第5批处理地址验证，不处理派生ID规则。若下一批选择此候选，应先给“自动标识如何表示IP主机/端口、已有name/显式ID优先、冲突如何显示”一个具体合同并实页复现；不能仅把特殊127地址映射为某个硬编码Provider名。现有helper不拥有此Panel派生函数，不新增源码/DOM断言测试。

## 5. 未执行与交接

本轮只读产品/测试/history与已有公开测试日志，唯一新增为本scratch。未运行任何测试、UI自动化、真实HTTP、模型或服务；没有使用真实credential或写共享spec。两个后续候选仍需先独立落盘再实施。第11批当前primitive逻辑未见与24合同冲突的新增阻塞；提交范围与归档应按实际9438501d5集成事实修正后收敛。
