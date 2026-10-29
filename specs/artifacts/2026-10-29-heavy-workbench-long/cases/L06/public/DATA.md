# 业务资料字典

本包是合成规划实例的一次固定投影，不是实际企业合同。`inputs/`是此公开稿唯一的业务输入；私有资格阶段的normalized JSON不交给候选。全局金额为模拟最小单位，数量/容量/工时为表内整数单位，不执行现实采购或转账。

| 文件 | 唯一业务对象与字段 |
| --- | --- |
| raw_materials.csv | raw_index/raw_id，单位体积、每单位每周期末持有费、初始数量 |
| products.csv | product_index/product_id，体积、持有费、初始数量、单件工时、销售单价 |
| plants.csv | plant_index/plant_id，产线身份 |
| supplier_terms.csv | supplier_index/supplier_id，提前期、每次合单运费、最低装运体积 |
| supplier_quotes.csv | supplier_id/raw_id联合身份；pack_units为每包件数，unit_price_minor为每件价格 |
| routes.csv | plant_id/product_id联合身份；allowed=0/1，production_cost_minor为每件生产费 |
| bom.csv | product_id/raw_id联合身份；units为每件产品的耗料数，0也是明确事实 |
| scenarios.csv | scenario_index/scenario_id，严格正的probability_numerator |
| demand.csv | scenario_id/week/product_id联合身份；该周必须交付的产品件数 |
| supplier_capacity.csv | scenario_id/week/supplier_id联合身份；不同原料合计的供应体积上限 |
| plant_capacity.csv | scenario_id/week/plant_id联合身份；不同产品共享的产线工时上限 |
| facility.json | weeks、共同前缀长度、概率共同分母、两类仓容、初始现金、信用及回款滞后 |

所有显式index从0连续递增，plan数组按这些index排列。week从0到weeks−1；所有情景和维度的条目应完整，不能把缺记录当成0。重复联合身份不能静默覆盖。概率为各情景分子除facility中的共同分母，严格正且和1。

原料/产品目录中的全部属性都是必需业务事实，包括体积、持有费、初始数量、产品工时和销售单价，不能只保留ID/index。facility的receipt_lag_weeks为正整数；其余非负数量/金额和严格正体积/包装/工时按各表定义读取。

`allowed=0`表示不能在该产线生产该产品；容量0表示本周不可使用，不能当缺值。前common_weeks周各场景的已知需求/供应容量/产能相同。提前期从下单周计算，原料于周t+lead_weeks进入到货阶段。变价、停供、停产的业务含义不通过文件名猜测，实际以各行数字和公开时序为准。

输出normalized格式为`l06-feasibility-instance/2`：实体数组raw_materials/products/plants按index，suppliers按supplier_index，scenarios按scenario_index；列名到字段的映射为volume→raw_volume/product_volume、holding_minor→raw_holding_minor/product_holding_minor、initial_units→initial_raw/initial_products、hours→production_hours、unit_price_minor→suppliers[].price_minor。suppliers另外含id/lead_weeks/pack_units/freight_minor/minimum_volume；二维allowed/production_cost_minor/bom按上述索引；scenarios包含id/probability_numerator及逐周demand/supplier_capacity_volume/plant_capacity_hours。facility同名数值字段直接保留。提供人读的来源映射，不以JSON键序或文件字节摘要计分。
