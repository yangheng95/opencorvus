# L10 完整能源设计、因果运行、计费与恢复：实施前Recall

用户原要求十题全链重型benchmark、可执行rubric、单层独立审查、真实OC/Codex且两good另版；已纠偏先完整成品/真实正错programme，不继续组件框架资格。当前六开发合同/有效小时未证；L02唯一Codex私有121沿原owner接续，不重开。已读当前AGENTS、long/L02最新Recall、cases矩阵和H10整题升级审查；限定全仓搜索没有L10当前实现，旧H10只是确定性2160点概念题，不能当新闭环。

现象是缺原材料/信息边界/实际状态/完整计费，根因不是算法太快。新题限定原创合成两站、跨月连续计量片段、固定候选0/非零容量、PV/需求与逐条forecast发布时间、不同dt、非单位充放效率、进口限额/历史峰、当前揭示故障与持续SOC/账单。原始混合单位/更正/缺失历史和供应/计费原文需复原；未来真值只评估侧。模型为明确常系数/无自放电的受控模拟，不授现实工程/并网/安全认证。

完整链：原资料解读/账单复核→公共历史训练和设备/成本复原→首未来动作前封programme与公开派生模型→控制器真实独立Docker(stdin JSON)仅programme/model/公共物理合同和逐步许可packet→host唯一物理/现金事实逐步推进→实际SQLite事务commit后进程退出73/原状态恢复→所有容量/场景真实动作和账→固定概率/寿命NPV推荐/敏感性/实际图/运维交接。模拟回放之后才做容量研究报告，不能谎称当时已决定投资；每次控制器不拿前次路径结果或报告。

信息：当前间隔负载/PV/电网状态与降额在动作前已测知（合成piecewise-constant完美当前遥测），未来只有release<=now的最高forecast revision；不暗称能预知间隔内随机值。固定合同/原历史峰/全部已确认动作和状态公开；完整未来路径/路径ID不经argv/env/mount/错误/receipt入controller。独立raw/packet身份和同前缀控制验证信息边界，不把自报as-of当证明。动作仅AC端有符号充/放功率；独立物理器核SOC+=eta_c*c*dt-d*dt/eta_d、功率/容量/电网/零售电、分级未供与PV弃电；能量与需量费/历史峰/吞吐/关键与普通未供罚分别记账，月切换和末期SOC明确。

全部0容量和非零容量必须真实运行，允许零投资获优；NPV按原投资/O&M/替换/残值/贴现和明确代表片段年权重计算，不能漏资本或将模拟业务日当agent小时。只与事前声明同信息因果MPC参照比较，完全信息不作可达门。先固定质量政策（注册因果参照成本2%及关键未供边界、物理和账不可补偿），完整可达/低质量programme/三原料变化验证后一次整审；不按候选结果倒填门槛，未知输入不能套旧参照。

影响面：只新增cases/L10及共享目录索引/long Recall，不改产品运行时、数据库、UI、Provider、调度或通用评估框架。新本题SQLite自schema1声明且不演进；checkpoint/receipt只本题新输出。用既有科学镜像与成熟SciPy HiGHS做短因果规划，物理/账独立于优化器。未知：新增机制是否活跃/完整质量可达/机器人评边界，在真实完整运行及错误programme前均未取得，不能标freeze。

参考方法资料：已查NREL SAM原始电池模型/round-trip定义及SciPy linprog官方文档，实际模型按本题明确常效率合同而非猜现实设备曲线。完整原档/参考产品/源与native/真实图/checker/原子rubric和可执行错误对照齐后仅一次集中benchmark_review，禁再委托；主方修实质问题且仅必要复验，最后范围commit/正常fetch merge审待推/hook/push。


## 当前实现/完整实跑自查补充

首轮18episode/真实73与恢复/原source-report均自然完成；发现输出链仍直接使用host给bill，不能冒充候选独立计费。原source/产物/指令保留，正式接口改为只给telemetry+actual ledger而不授最终bill；current report从原合同/实际q逐步重建SOC/峰/账并交reconciliation和原历史发票。final-submission在其三正式新输入前整体封存，原初轮不追称执行后来report。全部三输入真实final约74/72/76秒自然0：诊所基例S8、报价变高转S4、价变收益不同，办公室ZERO。下游错误programme各有实际假设，不用重复/线程CPU凑小时。

checker输入身份用已解析有限JSON数的精确数值/严格bool类型递归比较，不以误差容忍接受注册来源漂移。最初每数值转Fraction(str)在完整历史prefix上无必要；改为同解析数的直接精确比较以免评估侧人为耗时，保原正在运行的只读grade不中断/不热改。最终真实grade仍验证当前直接比较，标清旧grade执行字节；不是共享调度/数据库或通用框架修改。native物理允许明示绝对/相对数值容差，源身份与结果计算精度不混用。


## 真实错误programme的财务边界修复前分析

bad_shape完整18episode/报告native0，原cash=True进入当前真实CLI后exit1/TypeError bool不可迭代。原source/native/报告/命令和trace都保；不是候选工具退出、不是设施数据未知或业务应被免评。直接触发indexed()把候选cash当可信list，根因是financial expected对象与候选输出边界未区分；同定义调用面仅本题facts中的study expected_costs/summaries/cash/choices，不能只捕获整个grade异常并假称设施。下一集中修只在候选财务JSON/字段/身份索引处给明确M07/M08错误；缺整个原financial对象时真实依赖M08 blocked，其它已读物理/CSV继续真实评，不用空默认对象伪pass。未知私有authority/ref仍facility。

不改原programme、原raw/cases、阈值、SQL/schema、matrix或共享产品API；修后只重同一原checker（零新Docker/模型/预测）验证known error，并最终带独评聚合验证完整正确成品。其它未实跑的manifest/多次恢复/任意二进制边界不扩成通用平台，也不声称全覆盖。


## 单次整题独审的集中修复分析

独审从原CSV/Fraction/SQL重算三输入一致（最大差约3.73e-12），唯一自有base冷跑88.959秒自然0；不是调用作者core作oracle。真实P1-override：原bad_shape native0/cash=True已有M07真失败，私有review包添加M07:pass却被当前grade任意覆盖机器，CLI实际100/goodtrue。直接触发rv.ratings无命名空间校验，根因是原机器primitive与外部独立判断权限未按rubric声明分离；修复须按唯一rubric assessment=machine/independent声明仅准全部H01–H05，pass/fail完整且有evidence，未知/机器键具名facility，先验绑定原run，绝不覆盖机器/依赖。原source/输入/trace/初错全留，不把这类私有review错误扣候选。

真实P1-export：独审原冷跑输出副本只删dispatch.csv step列，实际CLI exit3/facility KeyError step；副本保原episode/source引用，属于局部协议控制且另有mount定位告警，不冒充新native/候选全成绩。根因是候选CSV的表头/行身份在可信expected对象路径直接索引；与cash bool同属候选输出边界，但必须在CSV读取/字段处归M13明确candidate错误，私有SQLite/native/authority未知仍facility，不全局catch混归。调用面只本题check_l10的dispatch/campaign/cashflow/historical-invoice导出，统一一个实际CSV schema primitive；不扩共享平台。

改动影响仅本题私有grader/rubric权限metadata及明确输出说明；原权重/critical/90线/质量阈值/raw/cases/方法/SQLite schema/native不改。修后用原override输入/原缺列副本CLI必要复验、正确全成品最终同rubric聚合，不重复18episode/旧矩阵。其余不适用产品Task/Mission/Session调度/Provider/UI，无新路由/队列/数据库迁移。
