# L06 单一变价参考独立审查

结论：仅认可C/R0单价45→46的精确单调变体参考与本轮修后reader。基例唯一L47380保持；没有新solver、Docker、Provider、GPU或委托。此结论不是候选评分/整题冻结/小时级验证。

## 原材料与数学

独立从11CSV+facility投影的基例与原注册ZIP输入相同；变体只有`suppliers[2].price_minor[0]`从45变46，联合身份C/R0，其他全部事实相同。自己按CSV联合身份生成变价raw，投影等于price-control.zip捕获。

对任一合法非负采购动作，累计额外成本恰为已下单C/R0件数乘1。物理/信息/交付/终期约束相同，销售回款不变，因此任一周新现金不高于旧现金。新业务可行集是原可行集子集，且新目标不小于旧目标，故原trusted-native L仍有效；不把这个推导称作新的精确整数最优或有理dual/search证明。该论证只覆盖此正向单价变化，不授权任意报价/容量变化。

现成同一完整控制计划旧C=238731/5=47746.2，新C=238818/5=47763.6，增量87/5=17.4；三场景最后累计受影响件数15/21/18。48个周前缀逐项核对现金差与不变的物理库存/到货/耗料/回款/应收，全部通过；原business48行也逐字段一致。最低现金仍−5369。固定L的gap=959/118450≈0.8096243141%，因此有达标可行见证，允许动作不变。

## 真实CLI及实际缺陷

初源`source-initial/`与初次12条命令/原始输出`executions/`保留：正常基例、注册变价、真实反转行序均30pass/17unassessed；旧normalized指向A02错误；旧费用/现金账指向C01/C07/C09/D05/D06错误，C06仍按真实新动作独立计算。未知47报价、delta0/bool、未知供应商、捕获变换漂移均具名run_invalid，没有候选分。

第12条实际发现P2：base reference_id空字符串仍exit0并C06pass，身份元数据不合法却被接纳。它不否定当前正确L或单调证明。修后`source-repaired/`统一要求基例ID、derived ID与bound_source.kind为strip后非空字符串；原空ID、kind坏类型、两类空白ID与正常变价共5条必要CLI全部按预期（正常30pass/17unassessed，其余reference_config_invalid/run_invalid、无总分）。原反例与失败原件未被覆盖改写。

## 边界与证据

精确命令/exit/stdout/stderr在executions/、repair-executions/及review-execution.json；输入/注册/两个原始ZIP在case-initial/，独立数学在independent-monotone-check.json，48原行数在archive-row-counts.json，源码与审查脚本均保留。source-initial对应修前，source-repaired对应修后，不以当前漂移源码替换历史。

此处证明了一个有公开类别的私有数值控制能可靠评价与反缓存；未运行候选源码实际变价完整重建，不能据此自动给D02满分。17叶聚合器、真实多质量审查、专业匿名校准、最终冻结和十题小时级资格仍另行未完成。
