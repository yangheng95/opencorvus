# 第13批只读功能调查：Provider 新建自动 ID

## Recall 与范围

Root要求只读调查 Provider 新建自动 ID。多次真实桌面输入 `http://127.0.0.1:<port>/<path>/v1` 后高级设置显示 `0`，原图由Root拥有。本agent核对唯一实现、全部消费者、同语义实现、历史、URL主机边界、配置冲突与Auth/模型身份影响；不修改第12批文件、产品或正式spec，不运行UI自动化、服务、Provider/模型请求，不用真实凭据，不再次委托。只新增本scratch报告。

本轮读取时HEAD曾为 `020f7b0004da883695392f5cc8b24550acf9c638`，工作区有Root第12批和其他owner变更，全部保留。当前AGENTS新增数据库自动迁移规则与本纯前端新建建议问题无直接关系；旧持久Provider ID、Auth与模型引用不得为了新算法迁移或重写。

证据分层：Root的实页现象作为已传达事实；本agent没有重新打开或评价原截图。下文Node只计算虚构URL的标准解析字段和当前两行选段/清洗表达式结果，没有网络、浏览器或生产组件执行；它是纯数据证据，不冒充UI或Provider E2E（End-to-End，端到端）资格。

## 唯一定义、触发与消费者

`packages/overlay/src/components/settings/ProvidersPanel.tsx:537–558`：

```ts
sanitizeProviderId(value)
// trim → lowerCase → 非[a-z0-9-_]变'-' → 连续'-'折叠 → 去首尾'-'

providerIdFromApi(value)
// new URL(value.trim()).hostname
// split('.').filter(Boolean)
// 两段及以上取倒数第二段，否则第一段
// sanitizeProviderId(source)，URL异常返回空串

formProviderId()
// editing() || sanitize(formId()) || sanitize(formName()) || providerIdFromApi(formApi())
```

根因不是URL parser丢失IPv4，而是已正确解析出的主机被当成“域名品牌”取倒数第二段；随后标点清洗又会丢失IP（Internet Protocol，互联网协议）地址中的结构。`127.0.0.1`被选为第三个octet `0`，因此端口、目录、名称都没输入时高级摘要准确显示了错误推导结果。

直接生产消费者全部位于同一组件：

- `:1320`高级设置的派生ID提示。
- `:1414`保存按钮是否有ID；空派生ID会阻止保存，即使URL本身合法。
- `:626` Save捕获ID，`:657`将声明写入 `config.provider[id]`。`provider-form.ts:103–104` 在Name空时同时把该ID作为显示名称。
- `:599`发现模型请求的 `providerID`；可能触发该ID已有Auth的地址归属检查。
- 同次Save的 `:672` 使用ID作为 `/auth/${id}` 的唯一认证写入键；cleanup也使用相同ID。

编辑入口 `startEdit:519–534`捕获现有键作为editing，并回填formId。因此修改已有名称/API（Application Programming Interface，应用程序接口）不会重算其持久身份。新建 `startAdd:512–517` 清空ID/name/API；只有editing、显式ID、Name三者都不能提供有效值时才走API派生。显式ID和Name本来仍受同一旧清洗规则，不宜借本批自动ID修复顺手更改其持久意图。

全仓对 `providerIdFromApi`、`sanitizeProviderId` 和hostname取段表达式的搜索只找到这份生产实现。`provider-form.ts`有字段/模型合并和URL验证，但没有另一个ID推导。BrowserPreviewPanel的hostname去`www.`仅用于网页标题；backend transform/Copilot按SDK provider名称取段是另一个协议，不是ID生成器，不能混用。

## 历史与旧路径为何未根治

完成的 `git log --all -S providerIdFromApi` 和 `-G 'sanitizeProviderId|parts\[parts.length - 2\]'` 精确组件路径搜索，仅返回保留根提交 `65d0bfc983`（2026-08-07，OpenCorvus v0.0.35beta）。当前三函数blame也均归它，不能推测更早选择这一启发式的原因。

第5批地址验证修复只定义合法新建/显式编辑URL；第8批零模型发现修复只恢复configured state与saved-key授权地址；第11批空声明修复只处理合法声明意图/JSON Merge Patch（JSON合并补丁）。它们均复用已有formProviderId，没有修改主机取段。第12批保存后观察正在由Root交付，也保持ID生成不变。

此前第11批只读报告 `specs/artifacts/2026-10-13-provider-empty-declarations/review-final-functionality.md:66` 已列出IPv4→0/1候选，本轮扩展同根因地址类型与数据流。当前Provider architecture 06-provider:341把模型身份定义为 `{providerID}/{modelID}`，:454把Auth定义为data-root-global，因此ID不是可任意改名的展示文本。

## 已实际计算的URL边界

命令：PowerShell literal here-string送 `node --input-type=module`，Node **v25.7.0**，原工具chunk **389cb9**，实际exit0。输入均是下表虚构地址，脚本只调用URL与字符串操作。完整结果可由该工具原输出核对，没有读取模型/凭据。

| 输入类别/样例 | URL.hostname | 当前ID |
| --- | --- | --- |
| `127.0.0.1:18600/one/v1` | `127.0.0.1` | `0` |
| 同IP、18601、`/two/v1` | `127.0.0.1` | `0` |
| `127.0.0.2:18600`、`10.0.0.7` | 各自完整IPv4 | 都是 `0` |
| `192.168.1.40` | `192.168.1.40` | `1` |
| `127.1`、`2130706433`、`0x7f000001` | 都规范为 `127.0.0.1` | `0` |
| `[::1]:18600` | `[::1]` | `1` |
| `[::]` | `[::]` | 空串 |
| `[1::2]` | `[1::2]` | `1-2` |
| `[1:2::]` | `[1:2::]` | `1-2`（与上一行不同地址碰撞） |
| `[::ffff:127.0.0.1]` | `[::ffff:7f00:1]` | `ffff-7f00-1` |
| `localhost:18600`、`localhost.:18600` | `localhost`、`localhost.` | 都是 `localhost` |
| `gateway`单标签主机 | `gateway` | `gateway` |
| `api.example.com` | `api.example.com` | `example` |
| `api.example.co.uk`、`example.co.uk` | 各自完整域名 | 都是 `co` |
| `API.Example.COM.:443/a/v1?revision=2#anchor` | `api.example.com.`，port为空 | `example` |
| `例子.测试` | `xn--fsqu00a.xn--0zwm56d` | `xn-fsqu00a` |
| 同域名的`/v1`、`/other/v2`、`${region}/v1`路径 | 相同hostname | 相同ID |
| `${API_URL}/v1`、`/v1` | URL构造TypeError | 当前helper返回空串 |
| `ftp://gateway/v1` | `gateway` | ID可生成，但现有API validator拒绝保存 |

实际IPv6全零地址 `[::]` 得空串是确定的纯数据结果。它虽然不是常用可连接远程服务，但它是合法URL输入；该值不能用来宣称实际连接成功。IPv6结构丢失还体现在两个不同合法地址生成相同 `1-2`。因此“直接取完整hostname，再原样套现有sanitize”仍不能根治同一类IPv6问题。

IDN（Internationalized Domain Name，国际化域名）的punycode双横线被旧sanitize折叠，不再保持标准host标识，但目前ID只是应用键，不是要拿来解析DNS的hostname。不能单凭这个结果断言已产生线上身份串线；它是选择新编码合同要考虑的信息损失。

端口、scheme、path、query、fragment从来没有进入当前派生函数。多个服务共用一台机器、端口不同或反向代理路径不同，都会产生同名建议。这是当前实现事实；是否要求新自动ID区分这些endpoint属于要先落盘的命名合同，不能为了观察到`0`就预设拼接所有URL字段。query可能携带配置标识或敏感值，不能把它原样写进可见/持久Provider ID。

## 成熟primitive与避免错误复用

已经在仓库使用的跨宿主原生 `URL` 就是首要成熟primitive。其hostname/host/port分离、IPv4规范形式、IPv6括号/压缩序列化、IDNA处理都由平台实现。已查权威 [WHATWG URL Standard：URL接口与host解析](https://url.spec.whatwg.org/#dom-url-hostname)，当前页标注2026-10-07更新；host解析区分域名、IPv4与括号IPv6，不能靠split('.')推断它们是同一语义。这里只采用标准解析结论，没有引入第三方建议。

仓库当前依赖/Overlay/util/transport-protocol搜索未找到已声明、可直接复用的 public suffix/IP解析库；不应为一个新建ID建议复制手写IPv4/IPv6 parser，或把Node专有net.isIP塞进浏览器。若最终需求是“准确识别注册域名品牌”，需要完整public-suffix语义与成熟库，这是比修自动ID信息丢失更宽的需求；当前倒数第二段不是那种实现。

`transport-protocol/src/index.ts:1369`的parseServerBaseUrl也使用URL，但它禁止query/fragment，是服务器连接地址的不同公共合同；Provider form允许这些字段，直接复用会意外扩大第5批验证规则。`provider-form.ts:19`的validateProviderFormApi仍应是Provider新建/显式编辑的地址准入源，原字段未编辑时保留模板合同。

本轮不预选`local`/`localhost`/`provider`关键词、随机ID、数字suffix、hash后缀或第二套冲突状态。应先明确：新自动ID是用户可调整的可读建议，还是要代表完整endpoint；随后定义准确的主机/端口/路径编码输出。无论选哪种，一份纯业务函数应成为高级提示、按钮、发现与Save的共同来源，替换并删除组件旧取段函数；原表单显式ID始终可用，不应另设隐式后备实现。

## 声明冲突、Auth与模型绑定的实际影响

### 已存在的同scope声明

`services/config.ts:457–460`保存前实际GET当前配置并clone，然后mutator调用 `applyProviderForm`。`provider-form.ts:100`在新建(initial为空)且current是record时抛具名 `ProviderFormConflictError/PROVIDER_ALREADY_EXISTS`，并说明选另一ID或编辑已有Provider。mutator拒绝发生在PATCH之前。由此，对于**该次GET已看见**的同ID声明，旧`0`建议通常造成用户碰到明确冲突，而不是自动覆盖。

该规则看的是scope读取到的有效配置。项目有效配置包含继承的global声明，所以已有global同ID也可能触发项目新建冲突。不同项目的私有声明不会自动互相可见；global新建也不枚举每个项目来判断这个ID被占用。Config.Provider的根键本来是`z.record(z.string(), Provider)`（config.ts:1558–1561），数字字符串`0`并非非法schema值。

上述client GET→PATCH不是同字段比较并交换(CAS)事务。不能将“GET已见同ID会拒绝”写成“任何并发新建都永远不能同ID写入”的保证。第12批spec已把同字段CAS列为范围外；本轮没有运行并发或发现实际调度/终态异常，不扩改后端writer。

### Auth是同一data root按Provider ID绑定

`Auth.get:82–84`按字符串键查唯一auth.json，`setWithGeneration:171–175`在原共享JSON锁内写entries[key]。`server/routes/auth.ts:50`写入后沿原resetAll结算Provider/native缓存。`Provider.buildState:509–518`将savedAuth每项按相同providerID合入配置/目录；SDK入口`:902`把对应provider.key按现有优先级交给SDK。地址本身不是Auth键。

因此自动ID若在两个原本分开的项目中都坍缩成`0`，它们会表达同一个data-root-global凭据身份。B的新建若填Key，将更新Auth `0`，A下一次按同ID解析会观察同一Auth。这个因果由代码与公开Auth合同支持，但本轮没有写Auth、没有实跑串线，更不能宣称已泄露实际凭据。即使新命名改善，不应迁移/重命名用户原有`0`：已保存配置、Auth generation、模型引用和历史账本都可能依赖它。

只有Auth `0`而当前scope尚无config `0`时，applyProviderForm不把Auth存在当声明冲突；新config `0`可绑定既有Auth，这是现有全局ID合同。不能通过额外扫描/复制凭据map给ID helper“补”一层事实来源。

### 模型身份与发现许可

`provider/provider.ts:372/402`分别以config键建立Provider.id和model.providerID；`provider/model-ref.ts:22`把`provider/model`第一段作为原providerID，剩余全部保留为modelID。因此新建议`0`会进入`0/<model>`及模型用量身份。编辑旧provider用editing ID固定，这一行为必须保留；改显示名称/API不能顺便移动模型namespace或Auth。

发现请求带formProviderId（Panel:599），但不能据同ID碰撞就推断凭据被发往任意新URL。`operations.ts:73`读取该ID savedAuth；没有explicitKey而有savedKey时，`:82–102`要求当前scope configured Provider与其top-level discovery endpoint/实际model API集合匹配；host、端口、路径参与原normalized URL比较。不同IP/端口/path通常得到明确400 `Saved provider credentials can only be used with that provider's configured API URL.`，不能绕过这一guard。query/hash现按原契约从比较与请求base清除，本批不改它们。explicitKey是用户本次明示凭据，沿原显式请求合同，不是自动ID额外授权。

## 正向合同与后续资格建议

没有修改/运行测试。现有 `overlay/test/provider-form.test.ts:108–126,299–312`已是同ID/已删除的正向具名错误合同；字段保真与空声明回归也可复用。它目前不测试组件私有自动ID。`provider-discovery-bootstrap.test.ts:145–255`覆盖两个scope、旧/新地址许可与configured零模型，但不是自动IDUI证明。

在最终spec明确新命名规则后，建议把实际派生业务放入现有provider-form服务并仅加纯数据exact-output合同；不得读取组件源码断言或渲染DOM。矩阵至少包括：

1. Root已复现的完整IPv4、两个不同IPv4、两个端口/路径的准确新输出；端口/path是否参与命名必须由已落盘规则给定，不能测试自行猜测。
2. IPv6 `::`、`::1`、`1::2`、`1:2::`、嵌入IPv4及规范等价地址；选择的输出必须满足同一明确语义，不能靠一条loopback特例通过。
3. localhost、单标签主机、普通FQDN（Fully Qualified Domain Name，完全限定域名）、多级公共后缀、IDN、大小写与尾点，以及URL标准省略默认端口的准确输出。
4. 编辑ID、明确ID、Name、API的原优先级；旧持久ID `0`保持原值，改Name/API不改identity。新API非法/相对/整段模板按原地址错误合同；原模板字段未改的编辑按原保真合同。
5. applyProviderForm新建碰到最新已存在声明得到准确PROVIDER_ALREADY_EXISTS；换明确ID得到完整新声明；编辑保留peer字段/模型。不要用“没有请求”“没有覆盖”作核心断言，验证明确错误与完整数据。
6. 真桌面Root两scope分别新建→高级摘要→canonical配置键→目录行→模型引用观察；碰撞显示可恢复的明确错误。仅纯函数回归不能替代这些截图。

若要证明Auth跨scope归属，另用全隔离无真实凭据的公开Config/Auth操作或后端数据测试，输入只用虚构sentinel且输出match boolean/状态；不需要模型请求，也不能用catalog.apiKeyConfigured=true证明某一个具体Key已绑定。是否纳入该真实资格由Root按最终修复影响决定。

## 未知与交付边界

- 本轮没有访问原图、实页、用户配置、auth/models文件；没有实际保存`0`、多项目Auth改写或模型请求。上述外部后果是代码因果，不是已发生事故。
- 已知UI现象与纯URL计算足以确认旧自动ID丢失主机信息；最终可读性/唯一性合同尚需Root落盘，不应将候选编码方案当已实施。
- 仅改变新建建议不需要后端schema、SDK、数据库迁移、模型/凭据协议或旧配置兼容层。任何自动迁移旧ID都会扩大到所有模型/Auth/Session引用，应明确排除。
- 所有第12批文件和其他owner改动均未触碰。本报告不代表第13批已实施或验收。
