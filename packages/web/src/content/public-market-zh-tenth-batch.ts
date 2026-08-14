import type { PublicSquadZhTranslationMap } from "./public-market-zh-types"

export const publicMarketZhTranslationsTenthBatch = {
  "builtin/radiation-therapy-physics-quality-assurance": {
    label: "放射治疗物理质量保障",
    description:
      "核对放射治疗设备配置、调试、参考剂量学、机器质控、治疗计划系统、患者特异性质控、变更、事件与独立审计证据，不具备临床治疗或设备放行权限。",
    selectorSummary: "适用于合格医学物理审查前整合放射治疗物理质量证据。",
    agents: {
      "radiotherapy-equipment-configuration-commissioning-analyst": {
        label: "设备配置与调试分析员",
        description: "冻结设备、软件、束流模型、配置基线与调试证据，不批准临床使用。",
      },
      "radiotherapy-reference-dosimetry-machine-qa-analyst": {
        label: "参考剂量学与机器质控分析员",
        description: "核对参考剂量学、机器质控、测量溯源和偏差证据，不设定临床阈值。",
      },
      "radiotherapy-treatment-planning-patient-specific-qa-analyst": {
        label: "治疗计划系统与患者特异性质控分析员",
        description: "追踪治疗计划系统版本、模型、计算与患者特异性质控证据，不创建或批准治疗计划。",
      },
      "radiotherapy-incident-change-independent-audit-analyst": {
        label: "事件、变更与独立审计分析员",
        description: "核对事件、变更控制、独立审计、纠正措施和复验链路。",
      },
      "radiation-therapy-physics-quality-review-owner": {
        label: "放射治疗物理质量审查负责人",
        description: "整合四条物理质量证据分支并路由至合格医学物理与临床负责人。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "放射治疗物理质量合格审查",
        description: "四条独立的放射治疗物理证据分支汇聚成一份受控的合格审查资料包。",
        nodes: {
          "radiotherapy-equipment-configuration-commissioning-analyst":
            "冻结设备、软件、配置、调试和批准来源的证据基线。",
          "radiotherapy-reference-dosimetry-machine-qa-analyst": "核对参考剂量学、机器质控、测量与偏差证据。",
          "radiotherapy-treatment-planning-patient-specific-qa-analyst":
            "核对治疗计划系统、束流模型与患者特异性质控证据。",
          "radiotherapy-incident-change-independent-audit-analyst": "核对事件、变更、独立审计、措施与复验证据。",
          "radiation-therapy-physics-quality-review-owner": "整合全部证据，同时保留医学物理、临床和设备放行权限。",
        },
      },
    },
  },
  "builtin/medical-device-postmarket-surveillance": {
    label: "医疗器械上市后监督",
    description:
      "整合装机基数、投诉、不良事件、警戒、趋势、上市后临床随访、真实世界证据、现场行动、纠正和预防措施及风险文件追踪，不作报告、召回或合规决定。",
    selectorSummary: "适用于医疗器械上市后证据的来源约束审查与专业移交。",
    agents: {
      "device-installed-base-complaint-intake-quality-analyst": {
        label: "装机基数与投诉接收质量分析员",
        description: "核对器械身份、装机基数、投诉版本、重复项、来源质量和缺失信息。",
      },
      "device-adverse-event-vigilance-reportability-evidence-analyst": {
        label: "不良事件与警戒证据分析员",
        description: "组织不良事件、警戒和报告适用性证据，不作因果性、严重性或可报告性判断。",
      },
      "device-trend-benefit-risk-pmcf-rwe-analyst": {
        label: "趋势、获益风险、上市后临床随访与真实世界证据分析员",
        description: "核对分母、趋势、获益风险、上市后临床随访和真实世界证据及其不确定性。",
      },
      "device-field-action-capa-effectiveness-analyst": {
        label: "现场行动、纠正预防措施与有效性分析员",
        description: "追踪现场行动、纠正和预防措施、风险文件、执行与有效性复验证据。",
      },
      "medical-device-postmarket-surveillance-review-owner": {
        label: "医疗器械上市后监督审查负责人",
        description: "整合投诉、事件、趋势和措施证据并路由至合格安全、质量和监管负责人。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "医疗器械上市后监督合格审查",
        description: "四条独立的上市后监督证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "device-installed-base-complaint-intake-quality-analyst": "核对器械、装机基数、投诉、重复项和来源质量。",
          "device-adverse-event-vigilance-reportability-evidence-analyst":
            "组织不良事件、警戒和报告适用性证据，不作专业判定。",
          "device-trend-benefit-risk-pmcf-rwe-analyst": "核对趋势、获益风险、上市后临床随访和真实世界证据。",
          "device-field-action-capa-effectiveness-analyst": "追踪现场行动、纠正预防措施、风险文件和有效性证据。",
          "medical-device-postmarket-surveillance-review-owner":
            "整合全部证据，同时保留安全、质量、监管和召回决定权限。",
        },
      },
    },
  },
  "builtin/clinical-biostatistics-data-monitoring": {
    label: "临床生物统计与数据监查",
    description:
      "核对估计目标、统计分析计划、分析人群、源数据与标准数据集派生、模型、缺失数据、多重性、敏感性、期中分析、盲态和独立监查证据，不作揭盲或停止继续决定。",
    selectorSummary: "适用于临床生物统计与数据监查证据的可追溯合格审查。",
    agents: {
      "clinical-estimand-sap-population-analyst": {
        label: "估计目标、统计分析计划与人群分析员",
        description: "冻结估计目标、终点、干预事件、统计分析计划版本和分析人群规则。",
      },
      "clinical-analysis-dataset-traceability-analyst": {
        label: "临床分析数据集追溯分析员",
        description: "核对源数据、标准数据模型、分析数据模型、派生、版本和记录级追溯。",
      },
      "clinical-model-missing-data-multiplicity-analyst": {
        label: "模型、缺失数据与多重性分析员",
        description: "组织预设模型、缺失数据、多重性、敏感性和假设检验证据。",
      },
      "clinical-interim-data-monitoring-evidence-analyst": {
        label: "期中分析、盲态与监查证据分析员",
        description: "核对期中数据锁、盲态分离、独立监查资料和决定来源，不揭盲。",
      },
      "clinical-biostatistics-data-monitoring-review-owner": {
        label: "临床生物统计与数据监查审查负责人",
        description: "整合四条统计与监查分支并路由至合格统计、数据和独立监查负责人。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "临床生物统计与数据监查合格审查",
        description: "四条独立的临床统计与数据监查证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "clinical-estimand-sap-population-analyst": "冻结估计目标、统计分析计划、终点和分析人群证据。",
          "clinical-analysis-dataset-traceability-analyst": "核对源数据、标准数据集、分析数据集和派生追溯。",
          "clinical-model-missing-data-multiplicity-analyst": "核对模型、缺失数据、多重性、敏感性和假设证据。",
          "clinical-interim-data-monitoring-evidence-analyst": "核对期中分析、盲态与独立数据监查证据。",
          "clinical-biostatistics-data-monitoring-review-owner":
            "整合全部证据，同时保留统计签署、揭盲及停止继续决定权限。",
        },
      },
    },
  },
  "builtin/internal-audit-control-assurance": {
    label: "内部审计与控制保障",
    description:
      "将审计章程、审计宇宙、风险排序、控制目标、设计、穿行测试、总体与样本、运行有效性、例外、发现、根因和整改证据整合成受控审查资料包。",
    selectorSummary: "适用于内部审计控制设计与运行有效性证据的独立审查。",
    agents: {
      "audit-universe-risk-prioritization-analyst": {
        label: "审计宇宙与风险排序分析员",
        description: "核对审计授权、独立性、审计宇宙、风险因素、覆盖范围与排序来源。",
      },
      "control-design-walkthrough-analyst": {
        label: "控制设计与穿行测试分析员",
        description: "追踪风险、控制目标、控制设计、责任人、频率、系统和穿行测试证据。",
      },
      "control-operating-effectiveness-testing-analyst": {
        label: "控制运行有效性测试分析员",
        description: "核对总体、样本、测试程序、原始证据、例外和外推限制。",
      },
      "finding-root-cause-remediation-analyst": {
        label: "发现、根因与整改分析员",
        description: "组织例外、影响、根因、整改、责任人、到期日和有效性复验证据。",
      },
      "internal-audit-control-assurance-review-owner": {
        label: "内部审计与控制保障审查负责人",
        description: "整合四条审计证据分支并保留审计意见、评级和风险接受权限。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "内部审计与控制保障合格审查",
        description: "四条独立的内部审计证据分支汇聚成一份受控的审计审查资料包。",
        nodes: {
          "audit-universe-risk-prioritization-analyst": "核对授权、独立性、审计宇宙、风险和覆盖排序证据。",
          "control-design-walkthrough-analyst": "核对控制目标、设计、责任、频率、系统和穿行测试证据。",
          "control-operating-effectiveness-testing-analyst": "核对总体、样本、测试、例外和外推限制。",
          "finding-root-cause-remediation-analyst": "核对发现、根因、整改、责任和有效性复验证据。",
          "internal-audit-control-assurance-review-owner":
            "整合全部证据，同时保留审计意见、评级、风险接受和整改关闭权限。",
        },
      },
    },
  },
  "builtin/mergers-acquisitions-due-diligence": {
    label: "并购尽职调查",
    description:
      "在授权交易边界内核对虚拟数据室完整性、商业与客户、财务质量、营运资本、净债务、法律、监管、技术和人员证据，不作估值、谈判或交易决策。",
    selectorSummary: "适用于来源可追溯、跨职能的并购尽职调查证据整合。",
    agents: {
      "commercial-customer-market-operations-analyst": {
        label: "商业、客户、市场与运营分析员",
        description: "核对收入来源、客户集中、留存、市场、销售、运营和反证。",
      },
      "deal-scope-vdr-completeness-analyst": {
        label: "交易范围与虚拟数据室完整性分析员",
        description: "冻结授权范围、重要性规则、请求清单、文档身份、缺口与版本。",
      },
      "financial-quality-working-capital-analyst": {
        label: "财务质量、营运资本与净债务分析员",
        description: "核对财务质量、营运资本、净债务、现金、债务和调整证据。",
      },
      "legal-regulatory-technology-people-analyst": {
        label: "法律、监管、技术与人员分析员",
        description: "提取合同、监管、知识产权、技术、网络安全、隐私和人员证据供专业审查。",
      },
      "mergers-acquisitions-due-diligence-review-owner": {
        label: "并购尽职调查审查负责人",
        description: "整合四条尽调分支、冲突、缺口和待办事项，不建议交易决定。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "并购尽职调查合格审查",
        description: "四条独立的并购尽调证据分支汇聚成一份受控的跨职能审查资料包。",
        nodes: {
          "commercial-customer-market-operations-analyst": "核对商业、客户、市场、收入和运营证据及反证。",
          "deal-scope-vdr-completeness-analyst": "冻结交易边界并核对虚拟数据室请求、文档、版本和缺口。",
          "financial-quality-working-capital-analyst": "核对财务质量、营运资本、净债务和调整证据。",
          "legal-regulatory-technology-people-analyst": "提取法律、监管、技术和人员证据供专业审查。",
          "mergers-acquisitions-due-diligence-review-owner": "整合全部证据，同时保留估值、法律、谈判和交易决定权限。",
        },
      },
    },
  },
  "builtin/advertising-measurement-brand-safety": {
    label: "广告衡量与品牌安全",
    description:
      "核对活动分类、指标契约、事件谱系、投放、可视性、无效流量、品牌安全与适宜性、归因、增量和实验证据，不修改广告平台或作合规结论。",
    selectorSummary: "适用于广告投放衡量、品牌安全和效果声明的证据保障。",
    agents: {
      "brand-safety-suitability-verification-analyst": {
        label: "品牌安全与适宜性验证分析员",
        description: "核对属性、内容、语境、分类、供应链与所提供品牌适宜性规则的证据。",
      },
      "campaign-taxonomy-metric-contract-analyst": {
        label: "活动分类与指标契约分析员",
        description: "冻结活动、渠道、创意、受众、事件、指标、分母、窗口和版本定义。",
      },
      "delivery-reconciliation-data-quality-analyst": {
        label: "投放核对与数据质量分析员",
        description: "核对请求、展示、可视、点击、成本、无效流量、重复和平台差异。",
      },
      "outcome-attribution-experiment-analyst": {
        label: "结果归因与实验分析员",
        description: "核对转化、归因窗口、对照、增量、实验设计、偏差和不确定性。",
      },
      "advertising-measurement-brand-safety-review-owner": {
        label: "广告衡量与品牌安全审查负责人",
        description: "整合四条广告证据分支并保留投放、声明、合规和风险接受权限。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "广告衡量与品牌安全合格审查",
        description: "四条独立的广告衡量与品牌安全证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "brand-safety-suitability-verification-analyst": "核对属性、内容、分类、供应链和品牌适宜性证据。",
          "campaign-taxonomy-metric-contract-analyst": "冻结活动分类、事件、指标、分母、窗口和版本契约。",
          "delivery-reconciliation-data-quality-analyst": "核对投放、可视性、无效流量、成本和跨平台数据质量。",
          "outcome-attribution-experiment-analyst": "核对结果、归因、增量、实验、偏差和不确定性。",
          "advertising-measurement-brand-safety-review-owner":
            "整合全部证据，同时保留平台修改、媒体购买、声明和合规权限。",
        },
      },
    },
  },
  "builtin/records-ediscovery-operations": {
    label: "记录与电子取证运营",
    description:
      "核对事项授权、保留与法律保全、保管人和系统、采集来源、处理、去重、文档家族、检索、审阅、特权标记、生产映射和处置问题，不执行采集、删除或法律判断。",
    selectorSummary: "适用于记录治理与电子取证运营证据的受控整合。",
    agents: {
      "custodian-source-collection-provenance-analyst": {
        label: "保管人、来源与采集溯源分析员",
        description: "核对保管人、系统、位置、时间范围、保存、采集批次、哈希与保管链证据。",
      },
      "processing-dedup-search-review-analyst": {
        label: "处理、去重、检索与审阅分析员",
        description: "核对处理配置、异常、去重、文档家族、检索式、命中和审阅过程。",
      },
      "production-privilege-disposition-analyst": {
        label: "生产、特权与处置分析员",
        description: "组织特权标记、遮盖、生产集合、编号、例外和处置证据，不作法律认定。",
      },
      "records-authority-retention-hold-analyst": {
        label: "记录授权、保留与法律保全分析员",
        description: "冻结事项、记录类别、保留来源、法律保全范围、冲突和批准证据。",
      },
      "records-ediscovery-operations-review-owner": {
        label: "记录与电子取证运营审查负责人",
        description: "整合四条记录与电子取证分支并路由至记录、法务、隐私和安全负责人。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "记录与电子取证运营合格审查",
        description: "四条独立的记录与电子取证证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "custodian-source-collection-provenance-analyst": "核对保管人、系统、保存、采集、哈希和保管链证据。",
          "processing-dedup-search-review-analyst": "核对处理、异常、去重、文档家族、检索和审阅证据。",
          "production-privilege-disposition-analyst": "组织特权标记、遮盖、生产和处置证据，不作法律认定。",
          "records-authority-retention-hold-analyst": "冻结事项授权、记录类别、保留来源、法律保全和冲突证据。",
          "records-ediscovery-operations-review-owner": "整合全部证据，同时保留采集、删除、特权、生产和法律决定权限。",
        },
      },
    },
  },
  "builtin/fire-protection-engineering-assurance": {
    label: "消防工程保障",
    description:
      "核对设施用途与危险、采用依据、被动防火、探测报警、灭火与供水、排烟与疏散接口、模型、检查和停用证据，不作设计、符合性或应急决定。",
    selectorSummary: "适用于消防工程系统与生命安全证据的合格审查。",
    agents: {
      "fire-protection-basis-occupancy-hazard-analyst": {
        label: "消防依据、用途与危险分析员",
        description: "冻结设施、区域、用途、危险、主管机关、采用依据和设计竣工版本。",
      },
      "passive-fire-compartmentation-egress-evidence-analyst": {
        label: "被动防火、分区与疏散证据分析员",
        description: "核对防火分区、烟区、构件、贯穿件、门、封堵和疏散路径证据。",
      },
      "active-fire-detection-suppression-water-supply-analyst": {
        label: "主动消防、探测、灭火与供水分析员",
        description: "核对探测报警、通知、灭火、消防供水、排烟、应急电源和联动测试。",
      },
      "fire-modeling-inspection-impairment-evidence-analyst": {
        label: "消防建模、检查与停用证据分析员",
        description: "核对所提供模型、检查、测试、缺陷、停用、恢复和工程复核证据。",
      },
      "fire-protection-engineering-assurance-review-owner": {
        label: "消防工程保障审查负责人",
        description: "整合四条消防证据分支并路由至注册工程师、设施负责人和主管机关。",
      },
    },
    workflows: {
      "fire-protection-engineering-assurance-review": {
        label: "消防工程保障审查",
        description: "四条独立的消防工程证据分支汇聚成一份受控的合格审查资料包。",
        nodes: {
          "fire-protection-basis-occupancy-hazard-analyst": "冻结设施、用途、危险、主管机关、采用依据和版本证据。",
          "passive-fire-compartmentation-egress-evidence-analyst": "核对被动防火、分区、贯穿件、门和疏散证据。",
          "active-fire-detection-suppression-water-supply-analyst":
            "核对探测、报警、灭火、供水、排烟、电源和联动证据。",
          "fire-modeling-inspection-impairment-evidence-analyst": "核对模型、检查、测试、缺陷、停用和恢复证据。",
          "fire-protection-engineering-assurance-review-owner": "整合全部证据，同时保留设计、符合性、验收和应急权限。",
        },
      },
    },
  },
  "builtin/power-grid-protection-reliability-assurance": {
    label: "电网保护与可靠性保障",
    description:
      "核对网络拓扑、保护分区、装置与整定、故障研究、继电保护协调、跳闸链路、扰动、误动、停电和可靠性口径证据，不修改电网或批准运行决定。",
    selectorSummary: "适用于电网保护、扰动事件和可靠性证据的工程审查。",
    agents: {
      "power-grid-protection-zone-device-configuration-analyst": {
        label: "电网保护分区、装置与配置分析员",
        description: "冻结网络、保护分区、互感器、断路器、继电器、固件、整定组和配置身份。",
      },
      "power-grid-fault-study-relay-coordination-analyst": {
        label: "电网故障研究与继电保护协调分析员",
        description: "核对故障研究、基准、单位、工况、整定、清除时间、延迟和协调证据。",
      },
      "power-grid-disturbance-misoperation-event-analyst": {
        label: "电网扰动、误动与事件分析员",
        description: "对齐时源、录波、继电器目标、断路器、通信和事件序列，不认定根因。",
      },
      "power-grid-reliability-outage-data-analyst": {
        label: "电网可靠性与停电数据分析员",
        description: "核对停电事件、客户或电量分母、分类规则、排除项和可靠性指标来源。",
      },
      "power-grid-protection-reliability-assurance-review-owner": {
        label: "电网保护与可靠性保障审查负责人",
        description: "整合四条保护与可靠性证据分支并路由至保护、运行和监管负责人。",
      },
    },
    workflows: {
      "power-grid-protection-reliability-assurance-review": {
        label: "电网保护与可靠性保障审查",
        description: "四条独立的电网保护与可靠性证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "power-grid-protection-zone-device-configuration-analyst":
            "冻结网络、保护分区、装置、固件、整定组和配置证据。",
          "power-grid-fault-study-relay-coordination-analyst": "核对故障研究、整定、断路器清除、通信延迟和协调证据。",
          "power-grid-disturbance-misoperation-event-analyst": "对齐扰动、录波、继电器、断路器、通信和事件证据。",
          "power-grid-reliability-outage-data-analyst": "核对停电、分母、分类、排除规则和可靠性指标证据。",
          "power-grid-protection-reliability-assurance-review-owner":
            "整合全部证据，同时保留整定、切换、误动认定和运行权限。",
        },
      },
    },
  },
  "builtin/oceanographic-observation-data-assurance": {
    label: "海洋观测数据保障",
    description:
      "核对海洋观测平台、仪器、部署、剖面与时间序列、校准、质量标志、坐标、变量、格式、元数据和跨平台验证证据，不发布数据、预报或航行结论。",
    selectorSummary: "适用于海洋观测数据质量、格式与验证证据的受控审查。",
    agents: {
      "ocean-observing-platform-instrument-metadata-analyst": {
        label: "海洋观测平台、仪器与元数据分析员",
        description: "冻结任务、平台、站点、航次、部署、仪器、校准、参数和采样身份。",
      },
      "oceanographic-profile-timeseries-quality-control-analyst": {
        label: "海洋剖面与时间序列质量控制分析员",
        description: "核对原始、调整和派生层、剖面方向、采样、缺测及项目批准的质量测试。",
      },
      "ocean-data-coordinate-format-provenance-analyst": {
        label: "海洋数据坐标、格式与溯源分析员",
        description: "核对时间、经纬度、压力深度、变量、单位、维度、坐标和数据格式元数据。",
      },
      "oceanographic-cross-platform-validation-analyst": {
        label: "海洋观测跨平台验证分析员",
        description: "核对时空垂向配对、插值、分母、不确定性和代表性误差，不指定真值。",
      },
      "oceanographic-observation-data-assurance-review-owner": {
        label: "海洋观测数据保障审查负责人",
        description: "整合四条观测数据证据分支并路由至海洋学、计量和数据管理负责人。",
      },
    },
    workflows: {
      "oceanographic-observation-data-assurance-review": {
        label: "海洋观测数据保障审查",
        description: "四条独立的海洋观测数据证据分支汇聚成一份受控审查资料包。",
        nodes: {
          "ocean-observing-platform-instrument-metadata-analyst": "冻结任务、平台、部署、仪器、校准、参数和采样身份。",
          "oceanographic-profile-timeseries-quality-control-analyst":
            "核对原始、调整和派生数据、剖面、时间序列和质量标志。",
          "ocean-data-coordinate-format-provenance-analyst":
            "核对时间、空间、压力深度、变量、维度、坐标、格式与元数据。",
          "oceanographic-cross-platform-validation-analyst": "核对跨平台配对、插值、分母、不确定性和代表性误差。",
          "oceanographic-observation-data-assurance-review-owner":
            "整合全部证据，同时保留标志覆盖、数据发布、预报和安全权限。",
        },
      },
    },
  },
} satisfies PublicSquadZhTranslationMap
