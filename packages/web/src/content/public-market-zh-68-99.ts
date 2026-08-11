import type { PublicSquadZhTranslationMap } from "./public-market-zh-types"

export const publicMarketZhTranslations68To99 = {
  "builtin/patent-landscape-prior-art": {
    label: "专利格局与现有技术",
    description:
      "对发明特征、检索、专利族、著录信息和段落证据开展可复现审查，不提供可专利性、自由实施、侵权或法律权威判断。",
    selectorSummary: "适用于边界明确的专利检索、专利族规范化、专利格局及现有技术段落证据整理。",
    agents: {
      "invention-claim-concept-decomposer": {
        label: "发明权利要求概念拆解员",
        description: "构建经授权的技术特征与检索概念表，不进行权利要求解释或法律结论判断。",
      },
      "patent-search-family-bibliography-analyst": {
        label: "专利检索、专利族与著录信息分析员",
        description: "执行可复现的检索计划，并区分文献、专利族、优先权、公开及登记事件证据。",
      },
      "prior-art-claim-evidence-landscape-analyst": {
        label: "现有技术权利要求证据与格局分析员",
        description: "将技术要素映射到准确段落，并形成边界明确的描述性格局摘要。",
      },
      "patent-landscape-prior-art-owner": {
        label: "专利格局与现有技术负责人",
        description: "整合特征、检索、专利族和段落证据，形成可供律师审查的技术资料包。",
      },
    },
    workflows: {
      "patent-landscape-prior-art-review": {
        label: "专利格局与现有技术审查",
        description: "三条独立的专利技术证据分支汇聚成一份供合格人员审查的资料包。",
        nodes: {
          "invention-claim-concept-decomposer": "将经授权的披露内容拆解为中性的技术特征和检索概念。",
          "patent-search-family-bibliography-analyst": "记录检索过程，并规范化专利族、优先权、公开及著录信息证据。",
          "prior-art-claim-evidence-landscape-analyst": "将要素映射到原文段落，并形成边界明确的描述性格局证据。",
          "patent-landscape-prior-art-owner":
            "整合所有分支，但不提供可专利性、自由实施、侵权、撰写、申请或法律权威判断。",
        },
      },
    },
  },
  "builtin/payments-fraud-risk-operations": {
    label: "支付欺诈风险运营",
    description: "将交易、认证、商户群组、欺诈信号、争议、拒付和控制证据汇总成边界明确的支付风险审查资料包。",
    selectorSummary: "适用于有来源依据的支付欺诈与争议证据整理，不具备交易、账户、商户、反洗钱或裁决权限。",
    agents: {
      "payment-transaction-authentication-analyst": {
        label: "支付交易与认证分析员",
        description: "重建支付事件生命周期及交易、认证、设备、账户和模型证据。",
      },
      "payment-merchant-monitoring-analyst": {
        label: "商户欺诈监控分析员",
        description: "构建可比商户群组，并整理基于正确分母的欺诈、争议、退款、拒绝和关联证据。",
      },
      "payment-dispute-evidence-analyst": {
        label: "支付争议证据分析员",
        description: "核对争议与拒付原因、规则版本、期限、交易、认证、交付、退款和沟通证据。",
      },
      "payments-fraud-risk-review-owner": {
        label: "支付欺诈风险审查负责人",
        description: "整合独立的交易、商户和争议证据，同时保留人工决策关口。",
      },
    },
    workflows: {
      "payments-fraud-risk-review": {
        label: "支付欺诈风险审查",
        description: "三条独立的支付证据分支汇聚成一份边界明确的欺诈风险审查资料包。",
        nodes: {
          "payment-transaction-authentication-analyst": "重建交易生命周期及认证、信号、标签和模型证据。",
          "payment-merchant-monitoring-analyst": "构建可比商户群组、比率、趋势、关联证据和未知项。",
          "payment-dispute-evidence-analyst": "构建带规则版本的争议与拒付证据时间线，不进行裁决。",
          "payments-fraud-risk-review-owner": "整合所有分支，保留冲突，并将每项操作交由获授权人员处理。",
        },
      },
    },
  },
  "builtin/petroleum-well-integrity-operations": {
    label: "油气井完整性运营",
    description: "汇总井设计依据、屏障、钻完井验证、生产监测和干预证据，供合格人员审查。",
    selectorSummary: "适用于边界明确的油气井完整性运营证据整理。",
    agents: {
      "well-basis-design-envelope-analyst": {
        label: "井基础与设计包络分析员",
        description: "冻结井标识、生命周期状态、示意图、地层、压力与温度依据、载荷、流体、材料及获授权运行包络。",
      },
      "drilling-completion-barrier-verification-analyst": {
        label: "钻完井屏障验证分析员",
        description: "将钻完井作业证据追溯至主次屏障包络和井屏障单元。",
      },
      "production-well-integrity-surveillance-analyst": {
        label: "生产井完整性监测分析员",
        description: "整理运行包络、环空压力、腐蚀、泄漏、阀门和完整性监测证据。",
      },
      "well-intervention-change-anomaly-analyst": {
        label: "井干预、变更与异常分析员",
        description: "追踪贯穿井全生命周期的干预、修复、配置变更、异常和补救证据。",
      },
      "petroleum-well-integrity-evidence-owner": {
        label: "油气井完整性证据负责人",
        description: "整合设计依据、屏障、监测和干预证据，供合格的井完整性审查。",
      },
    },
    workflows: {
      "petroleum-well-integrity-review": {
        label: "油气井完整性审查",
        description: "四条独立证据分支汇聚至一名明确的井完整性证据负责人。",
        nodes: {
          "well-basis-design-envelope-analyst":
            "冻结井标识、生命周期状态、示意图、地层、压力与温度依据、载荷、流体、材料及获授权运行包络。",
          "drilling-completion-barrier-verification-analyst": "将钻完井作业证据追溯至主次屏障包络和井屏障单元。",
          "production-well-integrity-surveillance-analyst":
            "整理运行包络、环空压力、腐蚀、泄漏、阀门和完整性监测证据。",
          "well-intervention-change-anomaly-analyst": "追踪贯穿井全生命周期的干预、修复、配置变更、异常和补救证据。",
          "petroleum-well-integrity-evidence-owner": "整合设计依据、屏障、监测和干预证据，供合格的井完整性审查。",
        },
      },
    },
  },
  "builtin/pharmacovigilance-drug-safety": {
    label: "药物警戒与用药安全",
    description:
      "汇总有证据边界的个例质量、汇总信号和风险计划追踪审查，供合格的药物警戒评估，不具备医疗、报告或监管权限。",
    selectorSummary: "适用于边界明确的药物警戒个例、汇总信号和风险管理证据审查。",
    agents: {
      "pv-case-intake-quality-analyst": {
        label: "药物警戒个例受理质量分析员",
        description: "建立受来源约束的个例、随访、重复和数据质量台账，不作个例判断。",
      },
      "pv-aggregate-signal-analyst": {
        label: "药物警戒汇总信号分析员",
        description: "计算可审计的描述性不成比例分析并记录局限，不宣告信号或发生率。",
      },
      "pv-risk-management-compliance-trace-analyst": {
        label: "药物警戒风险管理合规追踪分析员",
        description: "追踪参考安全信息、风险计划、信号阶段、行动和负责审查的证据。",
      },
      "pharmacovigilance-safety-review-owner": {
        label: "药物警戒安全审查负责人",
        description: "将个例、汇总和风险追踪分支整合成合格审查资料包，同时保留未决事项。",
      },
    },
    workflows: {
      "pharmacovigilance-drug-safety-review": {
        label: "药物警戒与用药安全审查",
        description: "三条独立证据分支汇聚成一份受控的安全审查资料包。",
        nodes: {
          "pv-case-intake-quality-analyst": "审计个例来源、版本、随访、重复和完整性证据。",
          "pv-aggregate-signal-analyst": "生成描述性汇总信号指标及其局限。",
          "pv-risk-management-compliance-trace-analyst": "追踪参考安全信息、风险计划、信号阶段、行动和合格负责人。",
          "pharmacovigilance-safety-review-owner": "整合所有分支，不具备医疗、个例处理、提交或监管权限。",
        },
      },
    },
  },
  "builtin/pipeline-integrity-management": {
    label: "管道完整性管理",
    description:
      "整理受来源约束的受监管管段、威胁、评估、异常、开挖、修复和变更证据，供合格人员审查，不具备运营或监管权限。",
    selectorSummary: "适用于受监管管道的完整性证据整理和合格审查准备。",
    agents: {
      "pipeline-segment-configuration-regulatory-basis-analyst": {
        label: "管段配置与监管依据分析员",
        description: "冻结管段标识、线路与里程、配置、后果区与类别指定，以及适用的监管与运营方依据。",
      },
      "pipeline-threat-data-integration-analyst": {
        label: "管道威胁数据整合分析员",
        description: "整合运营方定义的威胁与状态证据，以及覆盖范围、质量、缺口、反证和相互作用。",
      },
      "pipeline-assessment-anomaly-remediation-analyst": {
        label: "管道评估、异常与补救分析员",
        description: "追踪评估作业、指示与异常、对齐、开挖、修复、补救和变更管理证据。",
      },
      "pipeline-integrity-management-review-owner": {
        label: "管道完整性管理审查负责人",
        description: "整合管段、威胁、评估、异常、补救和变更证据，同时保留工程与监管决策。",
      },
    },
    workflows: {
      "pipeline-integrity-management-review": {
        label: "管道完整性管理审查",
        description: "三条独立的受监管管道证据分支汇聚成一项受控的完整性审查。",
        nodes: {
          "pipeline-segment-configuration-regulatory-basis-analyst": "冻结管段、配置、空间参考和适用依据。",
          "pipeline-threat-data-integration-analyst": "整合受来源约束的运营方威胁与状态证据。",
          "pipeline-assessment-anomaly-remediation-analyst": "追踪评估、异常关联、开挖、修复和变更。",
          "pipeline-integrity-management-review-owner": "整合所有分支，不具备运营、工程、应急、现场作业或监管权限。",
        },
      },
    },
  },
  "builtin/privacy-data-protection-operations": {
    label: "隐私与数据保护运营",
    description: "开展有证据边界的数据清单、隐私影响、数据主体请求、保留与删除以及事件审查，不具备法律或生产系统权限。",
    selectorSummary: "适用于受来源约束的隐私与数据保护运营证据。",
    agents: {
      "personal-data-inventory-flow-analyst": {
        label: "个人数据清单与流转分析员",
        description: "映射受来源约束的处理活动、系统、数据类别、接收方、传输、角色和保留来源，不决定合法性依据。",
      },
      "privacy-impact-assessment-analyst": {
        label: "隐私影响评估分析员",
        description: "梳理处理活动、必要性、比例原则、权利与自由风险、措施和剩余不确定性证据，不接受风险。",
      },
      "data-subject-request-retention-analyst": {
        label: "数据主体请求与保留分析员",
        description: "追踪获授权的请求受理、证据检索、保留与删除规则、保全冲突和审查问题，不执行生产操作或答复。",
      },
      "personal-data-incident-evidence-analyst": {
        label: "个人数据事件证据分析员",
        description: "重建个人数据事件事实、时间线、受影响数据范围、影响和补救证据，不判断是否构成泄露或是否通知。",
      },
      "privacy-data-protection-review-owner": {
        label: "隐私与数据保护审查负责人",
        description: "将清单、评估、请求与保留以及事件分支整合成合格审查资料包，不作法律或运营决策。",
      },
    },
    workflows: {
      "privacy-data-protection-operations-review": {
        label: "隐私与数据保护运营审查",
        description: "四条独立的隐私证据分支汇聚成一份合格审查资料包。",
        nodes: {
          "personal-data-inventory-flow-analyst": "映射获授权的处理清单与数据流。",
          "privacy-impact-assessment-analyst": "梳理隐私影响与风险措施证据。",
          "data-subject-request-retention-analyst": "追踪请求、来源检索、保留、删除和保全冲突。",
          "personal-data-incident-evidence-analyst": "重建个人数据事件事实和证据。",
          "privacy-data-protection-review-owner": "整合所有分支，不具备法律、生产、披露、删除、遏制或通知权限。",
        },
      },
    },
  },
  "builtin/procurement-vendor": {
    label: "采购与供应商决策",
    description: "并行开展商业比较、有来源依据的供应商尽调和审批证据审查，形成由人员负责的采购决策资料包。",
    selectorSummary: "适用于比较供应商、调查供应商风险并准备可审查的审批记录，不执行采购或审批。",
    agents: {
      "procurement-commercial-analyst": {
        label: "采购商业分析员",
        description: "构建客观、规范化的商业与能力比较，并进行敏感性分析。",
      },
      "procurement-diligence-analyst": {
        label: "供应商尽调分析员",
        description: "调查供应商身份、韧性、安全、财务、法律和集中度证据，不把声明当作核实结果。",
      },
      "procurement-governance-reviewer": {
        label: "采购治理审查员",
        description: "映射证据、冲突、例外和具名审批权限，不伪造审批。",
      },
      "procurement-decision-integrator": {
        label: "采购决策整合员",
        description: "将商业、尽调和治理证据整合成有条件、可审查的决策资料包。",
      },
    },
    workflows: {
      "vendor-decision-pack": {
        label: "供应商决策资料包",
        description: "并行开展独立的商业、尽调和审批证据审查，再汇总成由人员负责的供应商决策资料包。",
        nodes: {
          "procurement-commercial-analyst": "发布规范化的商业与能力比较。",
          "procurement-diligence-analyst": "发布有来源依据的供应商尽调档案。",
          "procurement-governance-reviewer": "发布审批证据与权限矩阵。",
          "procurement-decision-integrator": "将三项独立审查整合成最终决策资料包。",
        },
      },
    },
  },
  "builtin/product-management": {
    label: "产品管理",
    description: "界定产品决策，并行调查客户证据和解决方案选项，再将两者整合成有负责人且可验证的决策简报。",
    selectorSummary: "适用于需要明确证据和验证的产品发现、优先级、需求、路线图选择、实验和决策简报。",
    agents: {
      "product-problem-framer": {
        label: "产品问题界定员",
        description: "定义决策负责人、目标用户、问题、成果、约束、指标、非目标和待解问题。",
      },
      "product-customer-evidence-analyst": {
        label: "产品客户证据分析员",
        description: "建立带日期和来源链接的用户需求、频率、严重程度、覆盖范围与证据缺口记录。",
      },
      "product-solution-strategist": {
        label: "产品解决方案策略师",
        description: "制定不同选项，并比较价值、可行性、依赖关系、可逆性、学习周期和机会成本。",
      },
      "product-decision-owner": {
        label: "产品决策负责人",
        description: "将客户证据和解决方案分析整合为采纳、拒绝或延期的决策，并附执行与验证约定。",
      },
    },
    workflows: {
      "evidence-backed-product-decision": {
        label: "有证据支持的产品决策",
        description: "界定产品问题，并行调查客户证据和解决方案选项，再将其整合成有负责人决策和验证计划。",
        nodes: {
          "product-problem-framer": "发布边界明确的产品决策章程。",
          "product-customer-evidence-analyst": "发布带日期的客户证据与缺口图。",
          "product-solution-strategist": "发布具有取舍分析的不同解决方案和交付选项。",
          "product-decision-owner": "发布整合后的决策、范围、责任、指标、风险和验证计划。",
        },
      },
    },
  },
  "builtin/product-video": {
    label: "产品视频制作",
    description:
      "基于来源制作产品视频简报，并行规划叙事与视觉，再独立审查制作交接；不会假称已完成当前能力无法生成的媒体。",
    selectorSummary: "适用于有证据支持的产品视频简报、脚本、故事板、镜头计划和制作验收交接。",
    agents: {
      "product-video-brief-strategist": {
        label: "产品视频简报策略师",
        description: "冻结产品事实、受众、渠道、时长、声明、约束和可衡量的验收边界。",
      },
      "product-video-narrative-producer": {
        label: "产品视频叙事制作人",
        description: "将已批准简报转化为定时旁白、屏幕文案、声明依据和备选开场。",
      },
      "product-video-visual-planner": {
        label: "产品视频视觉规划师",
        description: "依据同一简报制定故事板、镜头清单、素材台账、可访问性计划和制作约束。",
      },
      "product-video-delivery-reviewer": {
        label: "产品视频交付审查员",
        description: "整合叙事与视觉计划、解决矛盾，并发布规范的制作与验收交接。",
      },
    },
    workflows: {
      "product-video-production-handoff": {
        label: "产品视频制作交接",
        description: "冻结有来源依据的简报，并行制定叙事与视觉计划，再整合并独立审查规范的制作交接。",
        nodes: {
          "product-video-brief-strategist": "发布边界明确的简报和声明台账。",
          "product-video-narrative-producer": "依据简报发布定时旁白和屏幕文案。",
          "product-video-visual-planner": "依据简报发布故事板、镜头、素材和可访问性计划。",
          "product-video-delivery-reviewer": "整合两个分支并发布经审查的制作与验收交接。",
        },
      },
    },
  },
  "builtin/public-health-surveillance": {
    label: "公共卫生监测",
    description:
      "开展有证据边界的监测系统、病例定义、数据质量、流行病学趋势和多指标审查，不具备病例分类或公共卫生行动权限。",
    selectorSummary: "适用于受来源约束的公共卫生监测证据和合格审查准备。",
    agents: {
      "surveillance-system-case-definition-data-quality-analyst": {
        label: "监测系统、病例定义与数据质量分析员",
        description: "追踪监测范围、人群、病例定义版本、记录沿袭、完整性、及时性和代表性证据。",
      },
      "surveillance-measure-trend-signal-analyst": {
        label: "监测指标、趋势与信号分析员",
        description: "生成可复现的描述性指标、趋势、基线和分析信号问题，不宣告聚集性事件或暴发。",
      },
      "laboratory-genomic-indicator-integration-analyst": {
        label: "实验室、基因组与指标整合分析员",
        description: "通过兼容的定义、分母和报告滞后，关联实验室、基因组、症候群、死亡及其他指标。",
      },
      "public-health-surveillance-review-owner": {
        label: "公共卫生监测审查负责人",
        description: "将系统质量、趋势和指标分支整合成合格审查资料包，同时保留未决的公共卫生决策。",
      },
    },
    workflows: {
      "public-health-surveillance-review": {
        label: "公共卫生监测审查",
        description: "三条独立的监测证据分支汇聚成一项受控审查。",
        nodes: {
          "surveillance-system-case-definition-data-quality-analyst":
            "追踪系统范围、定义、记录沿袭、完整性、及时性和代表性。",
          "surveillance-measure-trend-signal-analyst": "构建描述性指标、趋势比较和分析信号问题。",
          "laboratory-genomic-indicator-integration-analyst": "关联受来源约束的实验室、基因组、症候群及其他指标。",
          "public-health-surveillance-review-owner": "整合所有分支，不具备病例、暴发、预警、报告或干预权限。",
        },
      },
    },
  },
  "builtin/public-sector-service-delivery": {
    label: "公共部门服务交付",
    description: "将居民需求、流程与可访问性证据以及政策交付风险整合成权责明确的公共服务成果登记册。",
    selectorSummary: "适用于边界明确的公共服务交付设计与审查。",
    agents: {
      "public-resident-needs-analyst": {
        label: "居民需求分析员",
        description: "映射居民需求、旅程、渠道、障碍和证据缺口。",
      },
      "public-process-accessibility-analyst": {
        label: "流程与可访问性分析员",
        description: "映射服务步骤、交接、等待、可访问性和排斥风险。",
      },
      "public-policy-delivery-risk-analyst": {
        label: "政策交付风险分析员",
        description: "映射既定成果、依赖关系、指标、治理和交付风险。",
      },
      "public-service-plan-owner": {
        label: "公共服务计划负责人",
        description: "将各分支整合成权责明确的服务交付成果登记册。",
      },
    },
    workflows: {
      "public-service-delivery-pack": {
        label: "公共服务交付资料包",
        description: "三条独立证据分支汇聚成一份权责明确的审查资料包。",
        nodes: {
          "public-resident-needs-analyst": "映射居民需求、旅程、渠道、障碍和证据缺口。",
          "public-process-accessibility-analyst": "映射服务步骤、交接、等待、可访问性和排斥风险。",
          "public-policy-delivery-risk-analyst": "映射既定成果、依赖关系、指标、治理和交付风险。",
          "public-service-plan-owner": "将各分支整合成权责明确的服务交付成果登记册。",
        },
      },
    },
  },
  "builtin/railway-operations-safety": {
    label: "铁路运营安全",
    description: "将时刻表、线路容量、信号限制、服务事件和保障证据整合成边界明确的铁路运营审查资料包。",
    selectorSummary: "适用于有来源依据的铁路运营计划与安全保障审查，不具备列车控制权限。",
    agents: {
      "railway-timetable-capacity-analyst": {
        label: "铁路时刻表与容量分析员",
        description: "核对列车径路、站台、线路占用、恢复时间和已批准的间隔证据。",
      },
      "railway-signalling-infrastructure-risk-analyst": {
        label: "铁路信号与基础设施风险分析员",
        description: "追踪信号、联锁、进路、封锁、临时限速和控制证据。",
      },
      "railway-service-occurrence-assurance-analyst": {
        label: "铁路服务事件与保障分析员",
        description: "核对服务表现、中断、事件、候选归因、控制和保障行动。",
      },
      "railway-operations-safety-review-owner": {
        label: "铁路运营安全审查负责人",
        description: "整合三条独立铁路证据分支，并分派合格决策关口。",
      },
    },
    workflows: {
      "railway-operations-safety-review": {
        label: "铁路运营安全审查",
        description: "三条独立运营证据分支汇聚成一份边界明确的铁路保障资料包。",
        nodes: {
          "railway-timetable-capacity-analyst": "核对径路、站台、线路占用、停站、恢复和已批准的间隔证据。",
          "railway-signalling-infrastructure-risk-analyst": "追踪信号、基础设施、封锁、限制、危害、控制和证据。",
          "railway-service-occurrence-assurance-analyst": "核对服务事件、事故、候选归因、行动和保障状态。",
          "railway-operations-safety-review-owner": "整合所有分支，揭示冲突与未知项，并分派合格决策。",
        },
      },
    },
  },
  "builtin/real-estate-due-diligence": {
    label: "房地产尽职调查",
    description: "将房产文件、市场与财务证据以及实物和监管风险整合成供专业人员审查的尽调资料包。",
    selectorSummary: "适用于边界明确且带来源链接的房地产尽调。",
    agents: {
      "property-document-analyst": {
        label: "房产文件分析员",
        description: "构建带来源链接的文件清单和冲突矩阵。",
      },
      "property-market-financial-analyst": {
        label: "市场与财务分析员",
        description: "检验已提供的市场、收入、成本、可比案例和敏感性假设。",
      },
      "property-physical-regulatory-risk-analyst": {
        label: "实物与监管风险分析员",
        description: "映射状况、环境、区划、许可、公用设施和保险证据。",
      },
      "property-diligence-pack-owner": {
        label: "房产尽调资料包负责人",
        description: "将所有分支整合成供专业人员审查的尽调登记册。",
      },
    },
    workflows: {
      "property-due-diligence-pack": {
        label: "房地产尽调资料包",
        description: "三条独立尽调分支汇聚成一份登记册。",
        nodes: {
          "property-document-analyst": "映射房产文件。",
          "property-market-financial-analyst": "检验市场与财务假设。",
          "property-physical-regulatory-risk-analyst": "映射实物与监管风险。",
          "property-diligence-pack-owner": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/research-studio": {
    label: "研究工作室",
    description: "一支负责研究规划、持久证据收集、可复现分析、计算后事实核查和模板驱动报告交付的 Squad。",
    selectorSummary: "适用于有来源支持的检索、可复现分析、综合和证据驱动的报告交付，不包含软件交付规划工作流。",
    agents: {
      "research-studio-planner": {
        label: "研究工作室规划员",
        description: "界定问题边界、研究方法、来源层级、比较维度、时效规则和停止条件。",
      },
      "research-studio-researcher": {
        label: "研究工作室深度研究员",
        description: "依据已批准研究计划收集持久的多来源证据、引文映射、矛盾和待解问题。",
      },
      "research-studio-analyst": {
        label: "研究工作室证据分析员",
        description: "构建主张与证据矩阵，负责可复现计算、规范结果资源、算法验证和事实核查前的分析综合。",
      },
      "research-studio-fact-checker": {
        label: "研究工作室事实核查员",
        description: "依据持久来源核验分析员计算后起关键支撑作用的主张和方法证据，并记录更正、不确定性和逐项结论。",
      },
      "research-studio-writer": {
        label: "研究工作室报告撰写员",
        description: "将已接受的证据、分析和事实核查结论转化为模板驱动的综合报告、归档及真实渲染页面审查证据。",
      },
    },
    workflows: {
      "direct-writing": {
        label: "直接撰写研究报告",
        description: "依据充分且边界明确的用户材料生成已保存及内联报告，不虚构新的研究主张。",
        nodes: {
          "research-studio-writer": "依据充分且边界明确的既有材料忠实撰写并交付报告。",
        },
      },
      "evidence-synthesis": {
        label: "经核验的证据综合",
        description: "分析充分的既有证据，核查关键结论，再撰写已接受的报告。",
        nodes: {
          "research-studio-analyst": "从既有证据中形成明确主张、必要时的可复现计算、规范证据资源、比较和局限。",
          "research-studio-fact-checker": "核验分析员计算后起关键支撑作用的主张和方法证据，并记录更正或未决事项。",
          "research-studio-writer": "根据已接受的分析与事实核查结论渲染并交付模板驱动的报告，不重新计算相关主张。",
        },
      },
      "full-research": {
        label: "完整的来源支持型研究",
        description: "规划调查、收集持久证据、开展分析、核验结论并交付已接受的报告。",
        nodes: {
          "research-studio-planner": "定义边界明确的研究章程、来源策略、比较方法和停止条件。",
          "research-studio-researcher": "依据已接受的研究章程收集持久的多来源证据。",
          "research-studio-analyst": "从所收集证据中形成明确主张、可复现计算、规范证据资源、比较和局限。",
          "research-studio-fact-checker": "核验分析员计算后起关键支撑作用的主张和方法证据，并记录更正或未决事项。",
          "research-studio-writer":
            "根据已接受的证据、分析与事实核查结论渲染并交付模板驱动的报告，不重新计算相关主张。",
        },
      },
    },
  },
  "builtin/review-debug": {
    label: "审查与调试",
    description:
      "通过持久的目录事实和可见的叙事型 Turn 摘要，完成有证据支持的产品审查、根因调试、产品源码修复和独立修复验证。",
    selectorSummary: "适用于现有产品变更审查、可复现缺陷调查、根因调试、产品修复和修复验证。",
    agents: {
      "review-debug-evidence-investigator": {
        label: "审查与调试证据调查员",
        description: "复现已观察症状，盘点运行时和代码仓库证据，并界定受影响的产品范围。",
      },
      "review-debug-code-reviewer": {
        label: "审查与调试代码审查员",
        description: "审查变更及完整调用图中的正确性、回归、架构违规和因果线索。",
      },
      "review-debug-root-cause-investigator": {
        label: "审查与调试根因调查员",
        description: "证明从可观察症状经触发条件和数据流到根本设计或实现故障的因果链。",
      },
      "review-debug-repair-implementer": {
        label: "审查与调试修复实施员",
        description: "修复已证明的产品根因，移除被取代路径，添加回归测试并验证变更范围。",
      },
      "review-debug-integrity-reviewer": {
        label: "审查与调试完整性审查员",
        description: "独立审查修复差异，并重新运行原始复现和聚焦回归检查。",
      },
      "review-debug-visual-investigator": {
        label: "审查与调试视觉调查员",
        description: "在真实、Task 范围内的预览中复现图形缺陷，并捕获受影响状态、交互、截图和诊断信息。",
      },
      "review-debug-visual-reviewer": {
        label: "审查与调试视觉审查员",
        description: "使用全新的浏览器截图、交互、焦点路径和诊断信息，独立验证修复后的图形状态。",
      },
    },
    workflows: {
      "review-only": {
        label: "有证据支持的审查",
        description: "确立确切需求、审查目标、差异和调用图证据，再给出有证据支持的代码审查，不暗示已修复产品。",
        nodes: {
          "review-debug-evidence-investigator": "确立确切需求、审查目标、差异、检查和受影响的调用图。",
          "review-debug-code-reviewer": "依据已确立证据审查变更及周边调用图。",
        },
      },
      "debug-repair": {
        label: "产品调试与修复",
        description: "复现缺陷、独立审查代码并证明根因、修复产品，再独立验证修复。",
        nodes: {
          "review-debug-evidence-investigator": "复现缺陷并确立准确证据和受影响范围。",
          "review-debug-code-reviewer": "审查受影响调用图及现有变更的正确性和回归风险。",
          "review-debug-root-cause-investigator": "证明因果链，并说明先前路径为何未能消除缺陷。",
          "review-debug-repair-implementer": "修复已证明的根因并添加聚焦回归覆盖。",
          "review-debug-integrity-reviewer": "独立审查差异并重新运行复现和回归检查。",
        },
      },
      "visual-debug-repair": {
        label: "图形产品调试与修复",
        description: "复现图形缺陷、证明代码与视觉成因、完成修复，并独立核验新的浏览器和代码仓库证据。",
        nodes: {
          "review-debug-evidence-investigator": "确立所报告的症状、产品边界、代码仓库证据和预览目标。",
          "review-debug-code-reviewer": "审查图形实现调用图和回归风险。",
          "review-debug-root-cause-investigator": "证明产品数据、事件、渲染或样式的因果链。",
          "review-debug-visual-investigator": "在真实、Task 范围内的预览中捕获损坏的图形状态和交互证据。",
          "review-debug-repair-implementer": "修复已证明的图形产品根因并添加回归覆盖。",
          "review-debug-integrity-reviewer": "独立审查修复差异和代码仓库回归证据。",
          "review-debug-visual-reviewer": "使用新截图、交互、焦点路径和诊断信息验证修复后的状态。",
        },
      },
    },
  },
  "builtin/robotics-safety-validation": {
    label: "机器人安全验证",
    description: "整合机器人应用需求、危害、安全功能和确定性验证证据，供合格的安全审查。",
    selectorSummary: "适用于边界明确的集成机器人应用安全证据。",
    agents: {
      "robot-system-requirement-interface-analyst": {
        label: "机器人系统需求与接口分析员",
        description:
          "冻结集成机器人应用边界，追踪机器人、控制器、末端执行器、传感器、能源、通信、工作空间、人员和外部设备的需求。",
      },
      "robot-task-hazard-risk-reduction-analyst": {
        label: "机器人任务危害与风险降低分析员",
        description: "分析任务、模式和生命周期危害以及所提供的风险降低证据，不接受剩余风险。",
      },
      "robot-safety-function-control-validation-analyst": {
        label: "机器人安全功能与控制验证分析员",
        description: "将安全功能及控制系统安全相关部件追溯到配置、分析和测试证据。",
      },
      "robot-application-test-evidence-analyst": {
        label: "机器人应用测试证据分析员",
        description: "整理从单元、集成、仿真、硬件在环到边界明确的现场层级的确定性验证证据。",
      },
      "robotics-safety-validation-case-owner": {
        label: "机器人安全验证案例负责人",
        description: "将四条独立分支整合成保留矛盾的证据案例，供合格的安全审查。",
      },
    },
    workflows: {
      "robotics-safety-validation-review": {
        label: "机器人安全验证审查",
        description: "四条独立证据分支汇聚至一名明确的合格审查案例负责人。",
        nodes: {
          "robot-system-requirement-interface-analyst":
            "冻结集成机器人应用边界，追踪机器人、控制器、末端执行器、传感器、能源、通信、工作空间、人员和外部设备的需求。",
          "robot-task-hazard-risk-reduction-analyst":
            "分析任务、模式和生命周期危害以及所提供的风险降低证据，不接受剩余风险。",
          "robot-safety-function-control-validation-analyst":
            "将安全功能及控制系统安全相关部件追溯到配置、分析和测试证据。",
          "robot-application-test-evidence-analyst":
            "整理从单元、集成、仿真、硬件在环到边界明确的现场层级的确定性验证证据。",
          "robotics-safety-validation-case-owner": "将四条独立分支整合成保留矛盾的证据案例，供合格的安全审查。",
        },
      },
    },
  },
  "builtin/sales-strategy": {
    label: "销售策略与客户研究",
    description: "构建可归因的客户档案、并行的机会与定位分析、经审计的销售策略和实用销售手册。",
    selectorSummary: "适用于需要客户研究、机会优先级、定位和经审计销售手册的边界明确的产品、市场或客户集合。",
    agents: {
      "sales-strategy-planner": {
        label: "销售策略规划员",
        description: "定义销售问题、证据边界、细分市场、决策标准和停止条件。",
      },
      "sales-customer-researcher": {
        label: "销售客户研究员",
        description: "构建可归因的客户、采购者、市场和竞争者证据档案。",
      },
      "sales-opportunity-analyst": {
        label: "销售机会分析员",
        description: "依据契合度、需求、时机、价值、触达能力和交付约束确定细分市场与机会优先级。",
      },
      "sales-positioning-analyst": {
        label: "销售定位分析员",
        description: "制定有证据支持的定位、采购者信息、证明、异议回应和竞争差异化。",
      },
      "sales-strategy-synthesizer": {
        label: "销售策略综合员",
        description: "将机会与定位证据协调成一套有先后顺序的销售策略。",
      },
      "sales-strategy-fact-checker": {
        label: "销售策略事实核查员",
        description: "独立审计策略简报中的来源归属、算术、无依据主张和伦理边界。",
      },
      "sales-playbook-writer": {
        label: "销售手册撰写员",
        description: "解决审计问题并发布规范的销售策略手册。",
      },
    },
    workflows: {
      "sales-strategy-playbook": {
        label: "有证据支持的销售策略手册",
        description:
          "当 Task 已明确产品或服务以及目标市场或客户集合时使用：定义研究章程、构建客户档案，并行分析机会与定位，综合和审计策略，再发布手册。",
        nodes: {
          "sales-strategy-planner": "发布 sales-strategy/research-charter。",
          "sales-customer-researcher": "发布 sales-strategy/customer-dossier。",
          "sales-opportunity-analyst": "发布 sales-strategy/opportunity-analysis。",
          "sales-positioning-analyst": "发布 sales-strategy/positioning-analysis。",
          "sales-strategy-synthesizer": "发布 sales-strategy/strategy-brief。",
          "sales-strategy-fact-checker": "发布 sales-strategy/audit。",
          "sales-playbook-writer": "发布 sales-strategy/playbook。",
        },
      },
    },
  },
  "builtin/satellite-mission-operations": {
    label: "卫星任务运行",
    description:
      "整合有证据边界的航天器遥测、卫星任务计划、地面联络和遥控指令就绪性审查，不具备实时飞行或地面系统权限。",
    selectorSummary: "适用于受来源约束的卫星任务运行证据和合格审查准备。",
    agents: {
      "spacecraft-telemetry-health-state-analyst": {
        label: "航天器遥测健康状态分析员",
        description: "重建受来源约束的遥测、模式、限值集和事件证据，不发布警报或运营诊断。",
      },
      "mission-planning-ground-contact-resource-analyst": {
        label: "任务规划、地面联络与资源分析员",
        description: "检查受来源约束的联络窗口、数据生成、下行容量和资源冲突，不预订过站。",
      },
      "telecommand-procedure-anomaly-readiness-analyst": {
        label: "遥控指令程序与异常就绪性分析员",
        description: "追踪遥控指令程序、授权、演练、抑制、验证和异常证据，不创建或发送指令。",
      },
      "satellite-mission-operations-review-owner": {
        label: "卫星任务运行审查负责人",
        description: "将遥测、计划与联络以及程序与异常分支整合成合格审查资料包，同时保留未决运营决策。",
      },
    },
    workflows: {
      "satellite-mission-operations-review": {
        label: "卫星任务运行审查",
        description: "三条独立的任务运行证据分支汇聚成一项受控审查。",
        nodes: {
          "spacecraft-telemetry-health-state-analyst": "重建遥测、健康、模式和事件证据。",
          "mission-planning-ground-contact-resource-analyst": "检查联络、任务计划、缓冲区和资源证据。",
          "telecommand-procedure-anomaly-readiness-analyst": "追踪程序、授权、验证和异常就绪性证据。",
          "satellite-mission-operations-review-owner": "整合所有分支，不具备飞行、地面或安全权限。",
        },
      },
    },
  },
  "builtin/scientific-research-design": {
    label: "科学研究设计",
    description: "将证据格局、竞争假设以及严谨性或伦理分析整合成可复现的研究决策登记册。",
    selectorSummary: "适用于具备证据意识的科学构思和研究设计决策。",
    agents: {
      "research-evidence-landscape-analyst": {
        label: "研究证据格局分析员",
        description: "映射边界明确的文献，以及支持和反对候选方向的证据。",
      },
      "research-hypothesis-alternatives-analyst": {
        label: "假设备选方案分析员",
        description: "生成可检验的备选假设、预测和否证性观察。",
      },
      "research-rigor-ethics-analyst": {
        label: "研究严谨性与伦理分析员",
        description: "映射偏倚、可行性、安全、隐私、伦理和监管关口。",
      },
      "research-decision-integrator": {
        label: "研究决策整合员",
        description: "将证据、备选假设和关口整合成可复现的研究登记册。",
      },
    },
    workflows: {
      "research-design-decision-register": {
        label: "研究设计决策登记册",
        description: "独立的证据、假设和严谨性分支汇聚成一份决策登记册。",
        nodes: {
          "research-evidence-landscape-analyst": "映射当前证据和检索边界。",
          "research-hypothesis-alternatives-analyst": "生成可检验的竞争性解释。",
          "research-rigor-ethics-analyst": "映射严谨性、安全和审查关口。",
          "research-decision-integrator": "将所有分支整合进研究登记册。",
        },
      },
    },
  },
  "builtin/securities-post-trade-operations": {
    label: "证券交易后运营",
    description: "整合交易捕获、清算、托管、结算和差异证据，供合格的交易后审查。",
    selectorSummary: "适用于边界明确的证券交易后证据，不执行交易或转移资产。",
    agents: {
      "trade-capture-allocation-confirmation-analyst": {
        label: "交易捕获、分配与确认分析员",
        description: "核对交易捕获、分配、确认和肯定证据。",
      },
      "clearing-netting-obligation-analyst": {
        label: "清算、轧差与义务分析员",
        description: "追踪清算资格、匹配、轧差和由此产生的义务。",
      },
      "custody-dvp-settlement-analyst": {
        label: "托管、券款对付与结算分析员",
        description: "追踪托管指令、证券与现金腿和结算证据。",
      },
      "settlement-fail-break-control-analyst": {
        label: "结算失败与差异控制分析员",
        description: "审查结算失败、证券与现金差异、账龄、例外和控制证据。",
      },
      "securities-post-trade-operations-review-owner": {
        label: "证券交易后运营审查负责人",
        description: "整合生命周期证据，不下达指令、执行结算或转移证券与现金。",
      },
    },
    workflows: {
      "securities-post-trade-operations-review": {
        label: "证券交易后运营审查",
        description: "四条独立专业证据分支汇聚至证券交易后运营审查负责人。",
        nodes: {
          "trade-capture-allocation-confirmation-analyst": "核对交易捕获、分配、确认和肯定证据。",
          "clearing-netting-obligation-analyst": "追踪清算资格、匹配、轧差和由此产生的义务。",
          "custody-dvp-settlement-analyst": "追踪托管指令、证券与现金腿和结算证据。",
          "settlement-fail-break-control-analyst": "审查结算失败、证券与现金差异、账龄、例外和控制证据。",
          "securities-post-trade-operations-review-owner": "整合生命周期证据，不下达指令、执行结算或转移证券与现金。",
        },
      },
    },
  },
  "builtin/semiconductor-yield-engineering": {
    label: "半导体良率工程",
    description: "将批次、晶圆与裸片谱系、空间良率和 SPC 证据整合成受控的异常审查资料包，不具备工艺或处置权限。",
    selectorSummary: "适用于边界明确的半导体良率、SPC 和异常证据审查。",
    agents: {
      "yield-genealogy-data-quality-analyst": {
        label: "良率谱系与数据质量分析员",
        description: "核对产品、批次、晶圆、裸片、工艺和测试谱系以及合格分母。",
      },
      "wafer-spatial-bin-parametric-analyst": {
        label: "晶圆空间、Bin 与参数分析员",
        description: "分析良率分母、Bin 核对、晶圆特征和参数证据。",
      },
      "process-spc-excursion-analyst": {
        label: "工艺 SPC 与异常分析员",
        description: "评估合格控制基线、能力证据、设备相关性和异常假设。",
      },
      "semiconductor-yield-excursion-owner": {
        label: "半导体良率异常负责人",
        description: "将谱系、空间良率和 SPC 证据整合成合格的处置审查资料包。",
      },
    },
    workflows: {
      "semiconductor-yield-excursion-review": {
        label: "半导体良率异常审查",
        description: "三条独立良率工程分支汇聚成一份证据与合格审查资料包。",
        nodes: {
          "yield-genealogy-data-quality-analyst": "核对谱系、revision、复测状态和良率分母。",
          "wafer-spatial-bin-parametric-analyst": "分析 Bin、晶圆空间和参数证据。",
          "process-spc-excursion-analyst": "评估 SPC 基线、能力、设备比较和假设。",
          "semiconductor-yield-excursion-owner": "整合三个分支，不作暂停、放行、报废、返工或工艺变更决定。",
        },
      },
    },
  },
  "builtin/seo-geo": {
    label: "SEO 与生成式引擎优化",
    description: "开展证据驱动的搜索与生成式发现研究、技术与内容分析以及有优先级的优化规划。",
    selectorSummary: "使用带日期的证据诊断和改善搜索引擎与生成式引擎的可发现性。",
    agents: {
      "seo-geo-planner": {
        label: "SEO 与 GEO 规划员",
        description: "定义发现范围、目标、问题、证据和验收指标。",
      },
      "seo-geo-source-researcher": {
        label: "发现来源研究员",
        description: "根据第一方页面、搜索指南、观察结果和权威来源构建当前档案。",
      },
      "seo-geo-search-analyst": {
        label: "搜索优化分析员",
        description: "通过可复现观察分析技术和内容的搜索可发现性。",
      },
      "seo-geo-generative-analyst": {
        label: "生成式发现分析员",
        description: "分析实体清晰度、答案可提取性、来源佐证和当前生成式发现证据。",
      },
      "seo-geo-strategist": {
        label: "可发现性策略综合员",
        description: "将搜索与生成式证据整合成一套有优先级的实施和衡量策略。",
      },
      "seo-geo-fact-checker": {
        label: "SEO 与 GEO 事实核查员",
        description: "审计证据、观察、建议机制、日期、范围和无依据的排名主张。",
      },
      "seo-geo-plan-writer": {
        label: "SEO 与 GEO 优化计划撰写员",
        description: "负责经修正的规范优化计划和交互式交付。",
      },
    },
    workflows: {
      "search-generative-discovery-plan": {
        label: "搜索与生成式发现计划",
        description:
          "具有约束力的 SEO 与生成式引擎优化工作流。每个节点恰好运行一次；独立分支并发启动，汇合节点等待全部前置节点。",
        nodes: {
          "seo-geo-planner": "定义发现范围、目标、问题、证据和验收指标。",
          "seo-geo-source-researcher": "根据第一方页面、搜索指南、观察结果和权威来源构建当前档案。",
          "seo-geo-search-analyst": "通过可复现观察分析技术和内容的搜索可发现性。",
          "seo-geo-generative-analyst": "分析实体清晰度、答案可提取性、来源佐证和当前生成式发现证据。",
          "seo-geo-strategist": "将搜索与生成式证据整合成一套有优先级的实施和衡量策略。",
          "seo-geo-fact-checker": "审计证据、观察、建议机制、日期、范围和无依据的排名主张。",
          "seo-geo-plan-writer": "负责经修正的规范优化计划和交互式交付。",
        },
      },
    },
  },
  "builtin/service-reliability-incident-operations": {
    label: "服务可靠性与事件运营",
    description:
      "将服务级别、可观测性、告警质量、事件协同、交接、事件后学习和行动证据整合成边界明确的可靠性审查资料包。",
    selectorSummary: "适用于有来源依据的服务可靠性与事件证据，不执行生产缓解、严重级别宣告、呼叫或对外沟通。",
    agents: {
      "reliability-sli-slo-error-budget-analyst": {
        label: "可靠性 SLI、SLO 与错误预算分析员",
        description: "核对服务边界、服务级别指标与目标定义、测量、窗口、排除项和错误预算证据。",
      },
      "reliability-observability-alert-quality-analyst": {
        label: "可靠性可观测性与告警质量分析员",
        description: "映射遥测、埋点、查询、告警状态、路由证据、盲区和信号质量。",
      },
      "reliability-incident-coordination-handoff-analyst": {
        label: "可靠性事件协同与交接分析员",
        description: "构建有证据来源的事件时间线、影响记录、角色台账、决策日志和交接上下文，不具备指挥权限。",
      },
      "reliability-postincident-learning-action-analyst": {
        label: "可靠性事件后学习与行动分析员",
        description: "区分观察、促成因素、假设、反证、经验和有负责人的行动证据。",
      },
      "service-reliability-incident-review-owner": {
        label: "服务可靠性事件审查负责人",
        description: "整合 SLO、可观测性、事件、交接、学习和行动证据，同时保留人工运营权限。",
      },
    },
    workflows: {
      "service-reliability-incident-review": {
        label: "服务可靠性事件审查",
        description: "四条独立的可靠性与事件证据分支汇聚成一份边界明确的合格审查资料包。",
        nodes: {
          "reliability-sli-slo-error-budget-analyst": "核对服务边界、SLI/SLO 定义、窗口、排除项和错误预算证据。",
          "reliability-observability-alert-quality-analyst": "映射遥测、查询、告警、路由、盲区和信号质量。",
          "reliability-incident-coordination-handoff-analyst":
            "构建事件时间线、影响、角色、决策和交接证据，不具备运营指挥权。",
          "reliability-postincident-learning-action-analyst": "构建无责的促成因素、反证、学习和行动记录。",
          "service-reliability-incident-review-owner":
            "整合所有四条分支，保留冲突和未知项，并将每项生产决策交由获授权响应人员处理。",
        },
      },
    },
  },
  "builtin/sports-performance-analysis": {
    label: "运动表现分析",
    description: "将训练暴露与负荷、表现测试与可靠性，以及可用性与身心状态证据整合成结合个人情境的表现审查。",
    selectorSummary: "适用于边界明确的运动员表现证据分析，不具备医疗或教练权限。",
    agents: {
      "training-exposure-load-analyst": {
        label: "训练暴露与负荷分析员",
        description: "核对训练和比赛暴露以及带版本的内部与外部负荷指标。",
      },
      "performance-testing-analyst": {
        label: "表现测试与可靠性分析员",
        description: "检查方案可比性、测量误差、可靠性和有依据的个体变化。",
      },
      "availability-wellbeing-analyst": {
        label: "可用性与身心状态分析员",
        description: "映射可用性、自报身心状态、症状、旅行和恢复情境，不作诊断。",
      },
      "sports-performance-review-owner": {
        label: "运动表现审查负责人",
        description: "将暴露、测试和身心状态证据整合成边界明确的假设和合格决策关口。",
      },
    },
    workflows: {
      "sports-performance-review": {
        label: "运动表现审查",
        description: "三条独立运动员表现证据分支汇聚成一份审查资料包。",
        nodes: {
          "training-exposure-load-analyst": "结合数据质量证据核对暴露以及内部与外部负荷。",
          "performance-testing-analyst": "检查测试方案的可比性、可靠性、误差和个体变化。",
          "availability-wellbeing-analyst": "映射可用性以及自报的身心状态、症状、旅行和恢复情境。",
          "sports-performance-review-owner": "将所有分支整合成情境化的表现证据和审查关口。",
        },
      },
    },
  },
  "builtin/squad-sdk": {
    label: "生成 Agent Squad",
    description: "以证据为依据导入异构算法，并通过独立契约审查，规范生成项目自有、可追溯的 OpenCorvus Agent Squad。",
    selectorSummary: "适用于导入外部异构 Agent 算法，或通过规范 SDK 设计、验证并安装新的 OpenCorvus Expert Squad。",
    agents: {
      "squad-sdk-source-analyst": {
        label: "生成 Agent Squad 来源分析员",
        description: "提取源算法、领域边界、参与者、证据流、资源、可移植性约束和验收契约。",
      },
      "squad-sdk-package-architect": {
        label: "生成 Agent Squad 包架构师",
        description: "将已接受的来源证据转化为最小而完整的 SDK 蓝图和具有约束力的工作流拓扑。",
      },
      "squad-sdk-import-analyst": {
        label: "生成 Agent Squad 导入分析员",
        description: "检查外部 Squad 的成员、指令、Skill 闭包、MCP 能力、映射证据和可移植性阻塞项。",
      },
      "squad-sdk-contract-reviewer": {
        label: "生成 Agent Squad 契约审查员",
        description: "依据来源证据和包不变量，独立验证完整的创作蓝图或导入映射。",
      },
    },
    workflows: {
      "sdk-authoring": {
        label: "生成 Agent Squad 创作",
        description: "提取领域算法，设计一份规范的包蓝图，独立验证，再通过 SDK 创作工具将其具体化。",
        nodes: {
          "source-analysis": "发布源算法和包边界证据。",
          "package-architecture": "发布完整的 SDK 创作蓝图。",
          "contract-review": "发布对准确蓝图的独立正向验证。",
        },
      },
      "heterogeneous-import": {
        label: "异构 Squad 导入",
        description: "检查外部 Squad 和预览证据，修复映射，独立验证准确 digest，再执行一次导入。",
        nodes: {
          "import-analysis": "发布所选外部 Squad 的来源、可移植性和映射分析。",
          "contract-review": "发布对无阻塞预览和准确映射的独立正向验证。",
        },
      },
    },
  },
  "builtin/student-financial-aid-administration": {
    label: "学生资助管理",
    description:
      "整理带来源版本的学生资助申请、核验、学业、就读成本、资助组合、授予、发放、对账和例外证据，不作资格裁定，也不具备资金划转权限。",
    selectorSummary: "适用于为获授权院校审查准备受控的学生资助管理证据。",
    agents: {
      "aid-applicant-isir-verification-analyst": {
        label: "学生资助申请人 ISIR 核验分析员",
        description: "冻结申请人 token、资助年度、FAFSA/ISIR 交易以及所提供的核验与信息冲突证据。",
      },
      "aid-academic-cost-packaging-analyst": {
        label: "学生资助学业、就读成本与资助组合分析员",
        description: "追踪所提供的项目、校历、注册、就读成本、资助需求输入、政策和资助组合计算。",
      },
      "aid-award-disbursement-reconciliation-analyst": {
        label: "学生资助授予、发放与对账分析员",
        description: "核对所提供的资助授予、发起、发放、学生账户和项目资金记录，不划转资金。",
      },
      "aid-sap-return-overaward-exception-analyst": {
        label: "学生资助 SAP、退还、超额资助与例外分析员",
        description: "为 SAP、退学与资金退还、超额资助和信息冲突问题建立受来源约束的时间线。",
      },
      "student-financial-aid-administration-review-owner": {
        label: "学生资助管理审查负责人",
        description: "将申请、学业与资助组合、发放和例外证据整合成获授权的学生资助管理审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "学生资助管理合格审查",
        description: "各条独立的专业证据分支汇聚成一项受控的学生资助管理审查。",
        nodes: {
          "aid-applicant-isir-verification-analyst":
            "冻结申请人 token、资助年度、FAFSA/ISIR 交易以及所提供的核验与信息冲突证据。",
          "aid-academic-cost-packaging-analyst":
            "追踪所提供的项目、校历、注册、就读成本、资助需求输入、政策和资助组合计算。",
          "aid-award-disbursement-reconciliation-analyst":
            "核对所提供的资助授予、发起、发放、学生账户和项目资金记录，不划转资金。",
          "aid-sap-return-overaward-exception-analyst":
            "为 SAP、退学与资金退还、超额资助和信息冲突问题建立受来源约束的时间线。",
          "student-financial-aid-administration-review-owner":
            "将申请、学业与资助组合、发放和例外证据整合成获授权的学生资助管理审查资料包。",
        },
      },
    },
  },
  "builtin/supply-chain-logistics": {
    label: "供应链物流",
    description: "将需求、库存、运输和中断证据整合成权责明确的物流控制塔计划。",
    selectorSummary: "适用于有证据支持的物流情景规划。",
    agents: {
      "logistics-demand-inventory-analyst": {
        label: "需求与库存分析员",
        description: "检验需求、预测、库存、服务和交付周期假设。",
      },
      "logistics-transport-constraints-analyst": {
        label: "运输约束分析员",
        description: "映射线路、运输方式、容量、交接、成本假设和海关依赖。",
      },
      "logistics-disruption-risk-analyst": {
        label: "中断风险分析员",
        description: "构建有证据支持的中断情景、触发条件和应急方案。",
      },
      "logistics-plan-owner": {
        label: "物流计划负责人",
        description: "将所有分支整合成权责明确的控制塔计划。",
      },
    },
    workflows: {
      "logistics-control-tower-plan": {
        label: "物流控制塔计划",
        description: "三条独立物流分支汇聚成一份计划。",
        nodes: {
          "logistics-demand-inventory-analyst": "映射需求与库存证据。",
          "logistics-transport-constraints-analyst": "映射运输约束。",
          "logistics-disruption-risk-analyst": "映射中断情景。",
          "logistics-plan-owner": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/tax-compliance": {
    label: "税务合规",
    description: "开展带日期的官方权威研究，并行分析会计控制与税务义务，制定补救计划，独立审查并发布规范合规报告。",
    selectorSummary: "适用于需要官方权威依据、可复现计算、补救措施和可供决策报告的边界明确的会计与税务合规评估。",
    agents: {
      "tax-compliance-engagement-planner": {
        label: "税务合规项目规划员",
        description: "定义实体、司法辖区、期间、报告框架、交易、税种、重要性、数据截止时间和问题。",
      },
      "tax-compliance-authority-researcher": {
        label: "税务合规权威依据研究员",
        description: "为边界明确的项目构建带日期的官方权威依据和会计记录证据档案。",
      },
      "tax-compliance-accounting-controls-analyst": {
        label: "税务合规会计控制分析员",
        description: "分析会计处理、分录逻辑、账税差异、对账、文件链和控制。",
      },
      "tax-compliance-tax-obligation-analyst": {
        label: "税务合规纳税义务分析员",
        description: "确定受事实约束的纳税义务、税率或处理方式、期限、计算、申报立场和证据需求。",
      },
      "tax-compliance-remediation-analyst": {
        label: "税务合规补救分析员",
        description: "将会计与税务发现综合成有优先级的合规计划、对账表、日历和证据保留方案。",
      },
      "tax-compliance-fact-checker": {
        label: "税务合规事实核查员",
        description: "独立审计单一综合合规计划的权威依据、期间、税率、算术、对账、覆盖范围和审慎结论。",
      },
      "tax-compliance-report-writer": {
        label: "税务合规报告撰写员",
        description: "解决审计问题并发布规范的税务合规报告及匹配的交互式文档。",
      },
    },
    workflows: {
      "tax-compliance-assessment": {
        label: "税务合规评估",
        description:
          "当 Task 提供可识别的实体、司法辖区、报告期间、交易、报告框架、会计或申报记录，或明确的数据缺口时使用；每个节点均为必需。",
        nodes: {
          "tax-compliance-engagement-planner": "发布边界明确的项目章程。",
          "tax-compliance-authority-researcher": "发布官方权威依据与会计记录档案。",
          "tax-compliance-accounting-controls-analyst": "发布会计、对账、文件链和控制分析。",
          "tax-compliance-tax-obligation-analyst": "发布纳税义务、申报和计算分析。",
          "tax-compliance-remediation-analyst": "发布综合的合规与补救计划。",
          "tax-compliance-fact-checker": "独立审计单一综合合规计划。",
          "tax-compliance-report-writer": "发布规范的 Markdown、类型化报告和匹配的交互式文档。",
        },
      },
    },
  },
  "builtin/telecom-network-assurance": {
    label: "电信网络保障",
    description: "将需求、拓扑、服务级别、容量和变更风险证据整合成非运营型网络保障计划。",
    selectorSummary: "适用于边界明确的电信服务保障与容量分析。",
    agents: {
      "telecom-demand-topology-analyst": {
        label: "需求与拓扑分析员",
        description: "映射服务需求、拓扑、依赖关系、流量边界和证据缺口。",
      },
      "telecom-service-level-analyst": {
        label: "服务级别分析员",
        description: "定义有来源依据的服务指标、目标、错误预算和事件证据。",
      },
      "telecom-capacity-change-risk-analyst": {
        label: "容量与变更风险分析员",
        description: "映射容量约束、维护窗口、上线依赖和变更风险。",
      },
      "network-assurance-owner": {
        label: "网络保障负责人",
        description: "将各分支整合成可审查的非运营型保障计划。",
      },
    },
    workflows: {
      "network-assurance-plan": {
        label: "网络保障计划",
        description: "三条独立证据分支汇聚成一份权责明确的审查资料包。",
        nodes: {
          "telecom-demand-topology-analyst": "映射服务需求、拓扑、依赖关系、流量边界和证据缺口。",
          "telecom-service-level-analyst": "定义有来源依据的服务指标、目标、错误预算和事件证据。",
          "telecom-capacity-change-risk-analyst": "映射容量约束、维护窗口、上线依赖和变更风险。",
          "network-assurance-owner": "将各分支整合成可审查的非运营型保障计划。",
        },
      },
    },
  },
  "builtin/transfusion-medicine-blood-component-assurance": {
    label: "输血医学与血液成分保障",
    description:
      "保持患者、医嘱、样本、血液成分、相容性、发放、输注、反应和血库质量记录的证据连续性，不具备血液成分选择或临床权限。",
    selectorSummary: "适用于合格审查前核对受来源约束的输血与血液成分证据。",
    agents: {
      "transfusion-patient-order-specimen-identity-analyst": {
        label: "患者、医嘱与样本身份分析员",
        description: "冻结经授权的患者、医嘱、样本、采集、标记和保管链证据。",
      },
      "blood-component-inventory-compatibility-evidence-analyst": {
        label: "血液成分库存与相容性证据分析员",
        description: "按所提供材料追踪血液成分标识、属性、储存、检测和相容性证据。",
      },
      "component-issue-transfusion-trace-analyst": {
        label: "血液成分发放与输注追踪分析员",
        description: "核对预留、发放、运输、床旁接收、输注、退回和处置事件。",
      },
      "transfusion-reaction-quality-reconciliation-analyst": {
        label: "输血反应与质量核对分析员",
        description: "汇总反应时间线、所提供的检查结果、通知和质量事件关联，不作诊断。",
      },
      "transfusion-medicine-blood-component-assurance-owner": {
        label: "输血医学与血液成分保障负责人",
        description: "将身份、血液成分、发放与输注以及反应与质量证据整合成合格审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "输血医学与血液成分保障合格审查",
        description: "各条独立的专业证据分支汇聚成一项受控的输血医学与血液成分保障审查。",
        nodes: {
          "transfusion-patient-order-specimen-identity-analyst":
            "冻结经授权的患者、医嘱、样本、采集、标记和保管链证据。",
          "blood-component-inventory-compatibility-evidence-analyst":
            "按所提供材料追踪血液成分标识、属性、储存、检测和相容性证据。",
          "component-issue-transfusion-trace-analyst": "核对预留、发放、运输、床旁接收、输注、退回和处置事件。",
          "transfusion-reaction-quality-reconciliation-analyst":
            "汇总反应时间线、所提供的检查结果、通知和质量事件关联，不作诊断。",
          "transfusion-medicine-blood-component-assurance-owner":
            "将身份、血液成分、发放与输注以及反应与质量证据整合成合格审查资料包。",
        },
      },
    },
  },
  "builtin/urban-mobility-transport-planning": {
    label: "城市出行与交通规划",
    description: "将多模式基线、需求、可达性、选项、公平、安全和参与证据整合起来，供公共规划审查。",
    selectorSummary: "适用于边界明确的城市多模式出行规划证据。",
    agents: {
      "urban-mobility-baseline-network-analyst": {
        label: "出行基线、网络与数据分析员",
        description: "冻结规划地理范围、时间跨度、多模式网络与服务基线以及源数据来源。",
      },
      "travel-demand-accessibility-analyst": {
        label: "出行需求与可达性模型分析员",
        description: "评估所提供的需求模型、校准、情景和可达性证据，不虚构参数或预测结果。",
      },
      "multimodal-options-performance-analyst": {
        label: "多模式选项与表现分析员",
        description: "依据定义一致的既有指标和实施依赖，比较多模式选项组合。",
      },
      "mobility-equity-safety-engagement-analyst": {
        label: "出行公平、安全与参与证据分析员",
        description: "追踪分配性负担与收益、安全证据、可访问性需求和公众参与，不作法律或公平认定。",
      },
      "urban-mobility-transport-plan-owner": {
        label: "城市出行与交通规划负责人",
        description: "将基线、需求与可达性、选项表现以及公平、安全与参与证据整合成可供决策的规划资料包。",
      },
    },
    workflows: {
      "urban-mobility-transport-planning-review": {
        label: "城市出行与交通规划审查",
        description: "四条独立规划证据分支汇聚至一名明确的规划负责人。",
        nodes: {
          "urban-mobility-baseline-network-analyst": "冻结规划地理范围、时间跨度、多模式网络与服务基线以及源数据来源。",
          "travel-demand-accessibility-analyst": "评估所提供的需求模型、校准、情景和可达性证据，不虚构参数或预测结果。",
          "multimodal-options-performance-analyst": "依据定义一致的既有指标和实施依赖，比较多模式选项组合。",
          "mobility-equity-safety-engagement-analyst":
            "追踪分配性负担与收益、安全证据、可访问性需求和公众参与，不作法律或公平认定。",
          "urban-mobility-transport-plan-owner":
            "将基线、需求与可达性、选项表现以及公平、安全与参与证据整合成可供决策的规划资料包。",
        },
      },
    },
  },
  "builtin/veterinary-care-operations": {
    label: "兽医照护运营",
    description:
      "开展有证据边界的兽医诊疗、医嘱、用药、程序、麻醉、恢复、库存、生物安全和客户随访审查，不具备临床权限。",
    selectorSummary: "适用于受来源约束的兽医照护运营证据和合格审查。",
    agents: {
      "veterinary-patient-intake-care-pathway-analyst": {
        label: "兽医患者接诊与照护路径分析员",
        description: "核对动物、客户授权、诊疗过程、观察、兽医提供的路径、交接和处置证据。",
      },
      "veterinary-order-medication-procedure-trace-analyst": {
        label: "兽医医嘱、用药与程序追踪分析员",
        description: "追踪已签署的诊断、用药、配药、给药、程序、样本、结果和偏差证据。",
      },
      "veterinary-anesthesia-monitoring-recovery-analyst": {
        label: "兽医麻醉、监测与恢复分析员",
        description: "追踪已批准计划、同意、设备、监测、干预记录、恢复和交接证据。",
      },
      "veterinary-inventory-biosecurity-client-followup-analyst": {
        label: "兽医库存、生物安全与客户随访分析员",
        description: "核对库存、冷链、生物安全和依据已签署说明开展的客户随访证据。",
      },
      "veterinary-care-operations-review-owner": {
        label: "兽医照护运营审查负责人",
        description: "将四条分支整合成合格审查资料包，同时保留所有兽医及权限决策。",
      },
    },
    workflows: {
      "veterinary-care-operations-review": {
        label: "兽医照护运营审查",
        description: "四条独立的兽医运营证据分支汇聚成一项受控审查。",
        nodes: {
          "veterinary-patient-intake-care-pathway-analyst": "追踪患者、诊疗过程、接诊和所提供照护路径的证据。",
          "veterinary-order-medication-procedure-trace-analyst": "追踪医嘱、用药、诊断和程序。",
          "veterinary-anesthesia-monitoring-recovery-analyst": "追踪麻醉、监测、恢复和交接。",
          "veterinary-inventory-biosecurity-client-followup-analyst": "追踪库存、冷链、生物安全和客户随访。",
          "veterinary-care-operations-review-owner": "整合所有证据，不作诊断、治疗、照护、权限、库存或沟通决策。",
        },
      },
    },
  },
  "builtin/viral-content": {
    label: "传播型内容",
    description:
      "开展有证据支持的受众与趋势研究，形成可检验的传播概念和完整的文字主导型活动文案，经独立审查后规范交付，但不承诺互动效果。",
    selectorSummary: "适用于有证据支持、以文字为主导的传播活动概念与文案变体。",
    agents: {
      "viral-brief-strategist": {
        label: "传播型内容活动简报策略师",
        description: "定义边界明确的传播活动、证据问题和可证伪的成功假设。",
      },
      "viral-audience-researcher": {
        label: "传播型内容受众研究员",
        description: "构建可归因的受众需求和语言档案。",
      },
      "viral-trend-researcher": {
        label: "传播型内容趋势研究员",
        description: "构建带日期的内容模式与生命周期档案。",
      },
      "viral-concept-strategist": {
        label: "病毒式传播概念策略师",
        description: "将受众与趋势证据整合成不同且可检验的概念。",
      },
      "viral-copy-producer": {
        label: "传播型内容文案制作人",
        description: "创作完整的长篇和短篇文字，并确保声明可追溯。",
      },
      "viral-content-reviewer": {
        label: "传播型内容审查员",
        description: "独立审查唯一的文案包前置产物并发布更正。",
      },
      "viral-delivery-owner": {
        label: "传播型内容活动交付负责人",
        description: "解决审查发现并发布规范的传播活动资源。",
      },
    },
    workflows: {
      "evidence-backed-content-campaign": {
        label: "有证据支持的传播型内容活动",
        description:
          "当 Task 提供真实产品或服务、目标受众、所需渠道以及研究当前公开证据的权限时使用；生成经审查、以文字为主导且不向外部发布的传播活动组合。",
        nodes: {
          "viral-brief-strategist": "发布边界明确的传播活动简报。",
          "viral-audience-researcher": "发布可归因的受众证据。",
          "viral-trend-researcher": "发布带日期的趋势证据。",
          "viral-concept-strategist": "将两条研究分支整合成选定的传播概念。",
          "viral-copy-producer": "发布完整的传播活动文案。",
          "viral-content-reviewer": "独立审查唯一的文案包前置产物。",
          "viral-delivery-owner": "发布规范的传播活动资源和匹配的交互式 Artifact。",
        },
      },
    },
  },
  "builtin/water-wastewater-operations": {
    label: "给水与污水运营",
    description: "将处理工艺、流量与水质平衡、收集与分配、资产可靠性、采样和许可证据整合成边界明确的运营审查资料包。",
    selectorSummary: "适用于有来源依据的给水与污水运营证据，不具备过程控制、公共卫生或合规权限。",
    agents: {
      "drinking-water-treatment-quality-analyst": {
        label: "饮用水处理与水质分析员",
        description: "核对原水、处理阶段、配水、监测和实验室质量证据。",
      },
      "wastewater-collection-treatment-analyst": {
        label: "污水收集与处理分析员",
        description: "核对收集、进水、单元工艺、出水、残余物、溢流和许可监测证据。",
      },
      "water-asset-compliance-reliability-analyst": {
        label: "水务资产、监测与可靠性分析员",
        description: "核对资产、告警、工单、冗余、监测义务和响应责任。",
      },
      "water-wastewater-operations-review-owner": {
        label: "给水与污水运营审查负责人",
        description: "整合工艺、收集与分配、资产、监测和许可证据，并分派合格决策。",
      },
    },
    workflows: {
      "water-wastewater-operations-review": {
        label: "给水与污水运营审查",
        description: "三条独立的处理、收集与分配、资产及监测分支汇聚成一份边界明确的审查资料包。",
        nodes: {
          "drinking-water-treatment-quality-analyst": "核对饮用水工艺、流量、水质、采样和实验室证据。",
          "wastewater-collection-treatment-analyst": "核对污水收集、处理、出水、残余物和溢流证据。",
          "water-asset-compliance-reliability-analyst": "核对资产、告警、工单、冗余、监测和许可追踪证据。",
          "water-wastewater-operations-review-owner": "整合所有分支，揭示矛盾和未知项，并分派合格决策。",
        },
      },
    },
  },
} satisfies PublicSquadZhTranslationMap
