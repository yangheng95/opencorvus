# Phase P 归档 allowlist 待 Root 审阅

唯一清单是同目录 `manifest.json`，状态 frozen-for-root-review。source 相对 `.tmp-task-question-recovery-406`，destination 相对 Root 选择的 artifact 目录；仅逐条复制，不递归复制整个 scratch。**尚未复制到 specs，未生成归档包，也未修改生产/Git。** 本目录 manifest/本说明和 scan/facts 索引本身也列入最终清单。

覆盖初始 red01、green01、related01、types01–06 原命令/owner/stdout/stderr；所有 Phase P 原源码与 helper preimages；process01/02/03及普通package01/02原来源、真实API/ledger/Tool/result/expiry/child receipt/closure；初始共享机制分析、调用/历史/源摘录与 retirement 横审。排除 UI/Root 临时索引/peer whole-worktree patch（before-all.patch），Task-specific original source仍保留。

## 明确排除与派生副本

- 16份 `config.json` 完整公开配置响应全部排除。
- 16份 producer `*-http.json` 含完整配置响应。原文件不动，清单选择 scratch 中明确标记 `.config-omitted.json` 的派生副本：只省略 `/global/config` 或 `/config` 的response body，并留原route/status/time及省略位置；其他所有原receipt逐项读取相等验证。
- `related01/stdout.log` 第10、11行各有两个完整受控Provider请求。原完整日志排除；派生日志 `.provider-requests-omitted.log` 只移除两行的 `/requests` 字段并注明原数量。其余scenario/abandonedProvider/真实canonical Messages保持，未改动行保留原字节和换行。
- 不包含runtime DB/home、auth/models、任何完整Provider request/body或binary。既有 `provider-requests.json` 均逐item验证只含 provider/index/kind/bodyState/model/stream/declaredTools这些metadata；早期缺bodyState保持原样，不回填。
- 实际worker/旧helper源码的 `apiKey: "local-controlled-provider"` 是本公开fixture字面量，按Root明确授权保留。owner中的继承环境只存键名（有API_KEY等名称），没有读取/归档对应值。

`scan-before-log-omission.json` 保留首次发现的4个原Provider body位置；最终scan不是删除原失败，而是对当前明确allowlist的重新审查。最终按JSON结构检查完整Provider请求/配置为0，私钥/OpenAI-token形状/Bearer长值模式为0；这不是读取真实auth后的known-secret值扫描，未声称后者已做。

17份派生副本均实际write→read Buffer.equals直接字节核对，没有hash门。此检查只证明所选归档对象完整性，不替代产品正确性。Root真正复制或压缩后应再将目标readback或解压后的bytes逐一与本清单source直接比较；不要自行重算hash当验收。

## 原四live结果与每case结算

`original-facts-index.json` 的 originalProcess01LiveFacts 明确列出 process01 两live场景的A/B共四原结果，包含原Request/Project/Session/Tool Message ID、Message真实completed时间、ToolPart与durable result的16字节公开CSV、prompt200、natural assistant stop和原四项ledger。Tool/result分别与已知公开资源精确UTF-8 bytes读取比较；无模型自述替代。

**process01正式live断言止于A错误期待stale，B后续断言没有运行**；这四份原件的离线事实读取不回写成该轮正式通过。随后process03和package02才完整通过四场景。

同一facts索引列出四group共16个case的全部原child physical owner与原cleanup字段；早期receipt没有providerResponsesJoined/resourceHandlersJoined时保留缺失，不伪填新字段。所有完整closure仍以对应原stdout/cleanup/owners为准。

- process02 dead-unexpired：原行为断言已到末尾；metadata export报错导致resource.stop/cleanup.json未执行。八child总体已经闭合、Provider stop已到、外父后来退出并清其runtime，不冒称该case正常resource closure。清单保持缺失cleanup事实；没有补造文件。
- package-entry01：监督脚本自身漏supervisor env，在onSpawned之前报错。无package case/child/Provider/resource开始，不填自然child退出0。原owner/source仍保存；一行自身env修复是helper前置修正。
- process03：exec50614 join0，原parent84452/子90796，190.748s，在原600s内；专用outer确实提供。
- package-entry02：exec85562 join0，parent61428/子91024，170.948s，在原外监督600s内；所有case真正outerDeadlineObserved:false/wrapper:null，自身600s；generic runner原900s未改。
- 两次最后通过各有八child全部闭合、四Provider/resource/handler/原请求全部true、errors=[]、stdout四managedDirectoryRemoved:true。原120s自然expiry与原expired值保持都有真实记录。

## 阅读顺序与覆盖边界

1. `process-final-handoff.md` 及 red01/green01/related01/types06 的原owner+stderr。
2. process01/02失败原stderr和对应preimage；package-entry01/owner及helper差异说明。
3. process03和package-entry02原owner/stdout/stderr，再按 original-facts-index 定位每case精确Tool/result/lease/grant/OS/API。
4. `retirement-timing-review.md`：normal Ask Message完成后的退休触发缺口仍独立未实施。

去重仍55 tests/247 assertions（23/92+28/97+4/58），两入口复验不累计；类型不是功能测试。此为真实受控流式Provider+普通公开Session/Webfetch过程，不是真实Sol或Task/Mission/Question完整恢复。Phase Q未实施，Root自己的UI与control-lease注册检查另有scope，不混进这份后端allowlist。
