# UTC 多系列原始材料（材料/解码资格，未冻结）

[完整原始档案](full-archive.zip)只供评估侧；[公开开发包](../../public/development-materials.zip)只含注册开发截止前已发布资料。两包都是实际生成的8个CSV/JSON文件，不是预填预测输出。完整有1096业务日、4leaf/2aggregate、13152观测版本、37632协变量版本；当前开发有6823/21934条（截止2024-08-01T09Z）。行数只是材料描述，不是难度或小时证明。

[唯一注册合同](../../public/material-contract.json)定义clock/cutoff/单位/grid/固定日程，输入声明不得改变授权。全部完整UTC日、开发标签公开/outer标签私有和13/14天气可知性的具体规则在[材料合同草案](../../public/MATERIALS.md)。6月outer为20日，其14日窗口实际覆盖站点计划生效前后；合法快照中的A2.open为10个1及4个0，不强迫任何预测算法输出预设动作。

当前唯一入口：

```text
python evaluator/current-source/build_materials.py --contract evaluator/material-contract.json --out <全新目录>/materials
python evaluator/current-source/decode_materials.py --contract evaluator/material-contract.json --role archive --input <全新目录>/materials/full-private --out <全新目录>/decoded
python evaluator/current-source/decode_materials.py --contract evaluator/material-contract.json --role development --input <全新目录>/materials/development-public --out <全新目录>/decoded-development
```

生成器是私有作者事实建设工具，不能交给执行候选。decoder只精确转换CSV/UTC/单位，投影仍只由现有asof_input完成；完整canonical档案不得挂入预测worker。旧整数OLS仅证明原解析小例，不能用于这套每日目标grid的全研究成绩。

[主方原件](../qualification/full-material-main/README.md)保留全部首失败、反例和当前真实执行；[独立审查](../qualification/full-material-independent-review/REVIEW.md)按原CSV/精确量/实际发布核验。[实施前计划审查](../full-material-plan-review/REVIEW.md)保留两个原合同矛盾。当前仍缺正式预测/内外选模接口、点/区间质量与决策交付、完整参考/坏对照/rubric和冻结，不计候选小时。


当前公开探索origin改为2023Jun–Nov15，全部36inner晚于公开截止，避免公开开发标签污染内层。新材料真实build/两role decode及6新探索origin的唯一asof/独立SQL通过；完整数值事实和48inner/outer grid保持原身份，旧材料与失败保留在此前资格和本次[边界原件](../qualification/study-material-boundary-main/README.md)。2023固定尺度仅评分侧/2024+selector可读，不给早期预测worker。[指标/选择协议草案](../../public/STUDY-CONTRACT.md)和[独立局部审查](../qualification/study-protocol-independent-review/REVIEW.md)不替代完整worker/研究。
