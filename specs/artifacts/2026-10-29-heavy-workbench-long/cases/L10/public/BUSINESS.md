# 唯一物理与经济合同
时间UTC，144个连续区间通常0.5h，35号0.25h/36号0.75h；当前遥测在动作前已测得且在本区间恒定，这是合成假设。未来只允许当时已发布forecast最高版本；包含明示缺失的最高观测不能退回旧valid。历史原CSV支持W、kW、kWh，后者除以真实duration_hours。
动作power_kw为AC端有符号电池功率，正充、负放；soc_next=soc+eta_c*max(q,0)*dt-max(-q,0)*dt/eta_d。容量/功率/实际降额为硬约束，无出口；PV可弃。电网不够时先普通负载后关键负载未供，两项有原罚价，不能把卸载说成服务完成。峰值按进口kW、能量按kW*dt计，月切换不等于程序重启。每path/quote初SOC0末SOC0。
January原峰不可逆，February新月从0起；原prior_energy只复核历史账，不额外加入增量NPV。 campaign operating=新增能量费+两月含历史峰的需量费+双边AC吞吐磨损+各类未供罚；six repeats per stipulated synthetic year, five years, original escalation/OM/replacement/residual/discount全部入cash。每site只选一个quote使固定概率预期NPV最大，同分字典序，ZERO可最优。禁止按未来path切换设备选择。完整forecast current/confirmed_history、device、commission/site_terms是控制时可知；未来真实path不授予。
