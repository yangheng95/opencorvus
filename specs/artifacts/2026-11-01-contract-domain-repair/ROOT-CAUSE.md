# 为什么拒绝合法源路径、为什么验证没有发现

## 已证故障链

旧R04的source和target虽然都由JSON字符串承载，却属于不同接口合同：source指本机Windows文件系统，target指ZIP成员。实现用同一个`relative_parts`验证两者，在任何反斜杠上抛ValueError。`load_entries`验证source发生在读取源文件之前，因此真实存在、字节正确的源也提前失败；不是缺文件、ZIP损坏或Provider错误。

原公开请求只把target定义为forward-slash ZIP path。将本机source也改成“portable forward slash”是作者增加的限制；HANDOFF重复该限制，不能构成原合同的权威。检索当前共享提示、工具说明和环境装配，没有发现要求生成业务程序一律拒绝反斜杠的全局指令。特定工具协议的相对路径规则仅属于该工具字段，不能转成所有业务数据的规则。模型最初选择该设计的内部因果仍未知，不据命名或自述编造唯一原因。

## 两层验证为什么同时漏检

1. 模型自测独立计算了输出字节和索引，但所有合法source都写为`left/same.dat`、`dir {}/same.bin`等同一种表示。40个随机文件改变的是内容/数量/顺序；target反斜杠拒绝测试不能证明source合法表示被接受。
2. 主方原三个fixture同样只生成正斜杠source。期望值独立，不等于输入合法性的分类也独立。正确witness和错误prototype证明了枚举维度中的检测能力，没有检查两个角色是否错误共享约束。
3. 共享规则已经要求合法变化、独立预期、最终程序消费，但没有明确把“允许域/拒绝域”本身也作为需权威依据的正确性主张。成熟Path/zipfile存在也不能抵消外层validator缩窄合法域。
4. 旧运行汇总的passed仅来自三个fixture。上轮人工复核后才发现域遗漏；不能再以该汇总表示完整合同认证。本轮执行status=completed与registeredCasesAgree分开，并保具体case和合同依据。

## 根因修复

- 产品共享规则：值跨接口时先辨认角色和每一侧合同权威；字符串/数值类型相同不表示允许域相同；只有合同一致才能共用校验器。合法性分类也独立于作者validator和所选样例。新增限制不能来自作者实现习惯，不把目标约束导入源。
- 完成模型说明：接受/拒绝分类要回到原字段合同，不能只比较输出值。没有增加schema字段、强制工作流或host业务判定。
- 测量：由本机Path生成source表示，保ZIP target不变；实际读取源字节证明输入身份，再消费真实归档。HTTP用独立固定wire路径及真实GET/响应/文件，温度用原始单位、换算、校准和阈值的明确业务事实。结果不是源码关键词断言。
- 工具有效性：旧R04原pyz在新消费者仍原三项0、新native-source项1；旧正确witness四项0。没有补旧程序或倒改旧结果。HTTP/温度正确完整programme均通过、真实错误prototype均被拒收。

## 不同领域的同类机制

| 场景 | 原值语义 | 目标/下一阶段语义 | 实际证据 |
| --- | --- | --- | --- |
| 归档 | 本机相对源路径 | ZIP成员路径 | Path实际文件字节、最终ZIP payload/index |
| HTTP下载 | 字面业务文档ID | 一个UTF-8 URL路径段，再转成本机输出 | 实际GET wire path、HTTP响应、文件字节与receipt |
| 温度报告 | C/F/K原单位值 | Celsius→校准→Celsius阈值 | 等温输入、独立数值/状态、明确绝对零度错误 |

同一字符/数值在不同角色中的允许性不同；改文件数量、换一批随机值或复用作者“非法输入”分类都不能自动覆盖该区别。本轮不声称表中的有限场景覆盖所有接口。

## 因果和覆盖限制

实际新R06自然写出分角色的`validate_path(value, target=False)`：source用本机`Path(value).parts`，仅target用`split('/')`及正斜杠限制；不是主方补程序。原发布snapshot/attachment与封存pyz字节一致，独立四项消费含本机source均相符。但新作者自测仍只有正斜杠source，没有直接的本机分隔符正向见证；该维度由独立消费者覆盖。故“这份新产品允许该输入”有证，“自验习惯已经根治”仍无充分证据。

新R07将原业务ID以`quote(id,safe='')`编码为一个路径段，保API prefix及字面百分号；实际HTTP GET、解码后文件及receipt全相符。R08先按原单位判断物理下界，再转换Celsius、校准、比较阈值；等温和阈值结果及正确错误返回均相符。两题证明已测不同语义边界可执行，没有修前配对数据，不能归作提示收益。

### 相同语义审计发现的检查器漏洞

Python的bool是int子类。模型前温度正确programme使用合法JSON true/false，暴露原`same_value`先走数值分支而误拒boolean；唯一helper改为先处理真实bool，数值比较仍保原1e-8容差。模型后审计发现workflow的index/report还用直接Python `==`，没有经过该helper，又会将0与false混同。

按事先落盘的同语义审计登记，生成两份完整错误witness：归档空文件bytes写false、库存错误success写0。冻结初版消费者均误收（native0），当前workflow统一调用同一helper后，分别在空文件索引和错误报告检出。原输入/预期/容差/模型源码不改，R06先封原pyz再经当前消费者四项仍相符；初次与修后原收据均保。这是评估侧真实修复，不算两项模型缺陷、第二次模型试验或额外能力增益。当前仍允许合同数值的int/float数值表示，不宣称所有JSON字段有通用schema认证。

详细证据：`typed-json-comparison.json`、`typed-wrong-programmes/`、`bundle-final-consumer/`及两版消费者。独立预期必须同时核值、角色和合同要求的类型；宿主语言的相等关系也不能替代业务语义。

共享不表示强制同一数值容差。最终复核为同一helper传递明确容差，workflow保原精确0、其他数值任务保原1e-8。完整bytes多1e-9错误programme被精确消费者检出，原R06仍相符；见`precision-recheck/`。前次修后消费仍保，模型执行没有重复。

旧错误的程序/测试/fixture链可以直接证明。新规则对具体新任务的效果须以真实自然交付为准；新Task身份、标题、时间、模型随机性等也不同，不能把一次前后差异归为唯一提示因果或总体故障率下降。新两题只有修后数据，不作修前修后收益。原模型/Provider服务全部退休，不重旧候选或补作者答案。

权威：[Python本机路径语义](https://docs.python.org/3/library/pathlib.html)、[URL quoting的默认safe语义](https://docs.python.org/3/library/urllib.parse.html#urllib.parse.quote)。输出对错仍依据本轮原输入、实际调用及独立消费者。
