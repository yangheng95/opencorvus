# 干净复建
Linux owner容器，Python3/SQLite标准库、Matplotlib离线依赖；networknone/1CPU。完整public挂/raw只读，本submission挂/source只读，新/results可写。执行python /source/reproduce.py --input /raw --output /results/run。仅使用公开exercise.py和本source，无私有checker/权重/参考/旧答案依赖；actor UID10001只可写自己的本地库，report UID65534只读事实副本，原对象owner700在report终态后导出。
输出包括完整原请求/native/故障/两事务域真实SQLite、阶段原事实、监测/告警与delivery。逻辑表/列由logical-map.json映射到实际SQLite对象；其它正确schema/资金策略可以不同。先核原owner自然终态，保失败而非重跑覆盖旧目录。所有接口及本次故障类别在public合同中，不需访问其它项目。
