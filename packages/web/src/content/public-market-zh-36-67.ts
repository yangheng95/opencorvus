import type { PublicSquadZhTranslationMap } from "./public-market-zh-types"

export const publicMarketZhTranslations36To67 = {
  "builtin/finance-operations": {
    label: "财务运营",
    description:
      "基于来源证据开展财务运营核对、控制审查、结账规划和独立复核，并明确不提供咨询意见且须由人工批准的边界。",
    selectorSummary: "核对财务运营证据，并产出经人工复核的结账或控制计划。",
    agents: {
      "finance-operations-record-analyst": {
        label: "财务记录分析师",
        description: "将所提供的分类账、报表、明细表、定义、期间和差异核对为可追溯的证据表。",
      },
      "finance-operations-controls-analyst": {
        label: "财务控制分析师",
        description: "梳理流程责任、审批、职责分离、证据留存、异常处理和控制缺口。",
      },
      "finance-operations-close-planner": {
        label: "财务结账与运营规划师",
        description: "将已核对的记录和控制分析整合为一份有序的结账或整改计划，供责任人批准。",
      },
      "finance-operations-reviewer": {
        label: "财务运营复核员",
        description: "独立检查核对结果、控制措施、来源沿袭、未解决异常和人工批准要求。",
      },
    },
    workflows: {
      "finance-operations-close-plan": {
        label: "财务运营结账计划",
        description: "并行开展记录核对和控制分析，将二者整合为一份责任明确的计划，再于人工批准前进行独立复核。",
        nodes: {
          "finance-operations-record-analyst": "产出受来源约束的核对与差异表。",
          "finance-operations-controls-analyst": "产出责任、审批、证据和控制缺口图谱。",
          "finance-operations-close-planner": "将两项分析整合为一份结账或整改计划。",
          "finance-operations-reviewer": "独立复核整合后的计划，并记录未解决异常和所需人工批准。",
        },
      },
    },
  },
  "builtin/food-safety-quality": {
    label: "食品安全质量",
    description:
      "在不具备安全、放行、召回或监管决定权的前提下，整合有明确证据边界的食品危害、控制监测、可追溯性和召回准备度审查。",
    selectorSummary: "用于基于来源的食品安全体系与可追溯性证据准备。",
    agents: {
      "food-process-hazard-haccp-analyst": {
        label: "食品流程危害与 HACCP 分析师",
        description: "构建产品、流程和危害控制证据，但不判定重大危害、关键控制点或关键限值。",
      },
      "food-control-monitoring-verification-analyst": {
        label: "食品控制监测与验证分析师",
        description: "追踪监测、校准、偏差、纠正措施、核查和验证证据，但不决定产品处置。",
      },
      "food-traceability-recall-readiness-analyst": {
        label: "食品可追溯性与召回准备度分析师",
        description: "重建批次谱系、数量核对、分销范围和模拟召回准备度，但不发起召回。",
      },
      "food-safety-quality-review-owner": {
        label: "食品安全质量审查负责人",
        description: "将危害、控制和可追溯性分支整合为合格人员审查资料包，但不作食品安全或处置决定。",
      },
    },
    workflows: {
      "food-safety-quality-review": {
        label: "食品安全质量审查",
        description: "三个独立的食品安全证据分支汇聚为合格人员审查资料包。",
        nodes: {
          "food-process-hazard-haccp-analyst": "构建流程、危害和控制点证据。",
          "food-control-monitoring-verification-analyst": "追踪监测、校准、偏差、纠正措施、核查和验证证据。",
          "food-traceability-recall-readiness-analyst": "重建批次谱系、数量核对和模拟召回准备度。",
          "food-safety-quality-review-owner": "在不具备安全、处置、召回或监管决定权的前提下整合所有分支。",
        },
      },
    },
  },
  "builtin/forensic-accounting-investigations": {
    label: "法务会计调查",
    description: "在不作欺诈或法律判定的前提下，整合经授权的交易证据、异常、资金流和佐证。",
    selectorSummary: "用于边界明确的法务会计调查证据工作。",
    agents: {
      "investigation-scope-evidence-custody-analyst": {
        label: "调查范围、授权与证据保管分析师",
        description: "固化业务授权、指控事项、期间、系统、访问限制、保全义务和证据保管要求。",
      },
      "transaction-anomaly-population-analyst": {
        label: "交易总体与异常分析师",
        description: "核对经授权的交易总体，并将可复现的异常作为线索而非证明进行评估。",
      },
      "funds-flow-entity-relationship-analyst": {
        label: "资金流与实体关系分析师",
        description: "根据授权记录重建有来源依据的资金用途、交易对手、受益人和实体关系。",
      },
      "control-interview-corroboration-analyst": {
        label: "控制、访谈与佐证分析师",
        description: "将控制设计与运行情况同交易证据、访谈记录、佐证和矛盾信息进行比对。",
      },
      "forensic-accounting-investigation-evidence-owner": {
        label: "法务会计调查证据负责人",
        description: "将保管、总体、资金流和佐证分支整合为可审查的调查资料包。",
      },
    },
    workflows: {
      "forensic-accounting-investigation-review": {
        label: "法务会计调查审查",
        description: "四个独立证据分支汇聚至明确的调查证据负责人。",
        nodes: {
          "investigation-scope-evidence-custody-analyst":
            "固化业务授权、指控事项、期间、系统、访问限制、保全义务和证据保管要求。",
          "transaction-anomaly-population-analyst": "核对经授权的交易总体，并将可复现的异常作为线索而非证明进行评估。",
          "funds-flow-entity-relationship-analyst":
            "根据授权记录重建有来源依据的资金用途、交易对手、受益人和实体关系。",
          "control-interview-corroboration-analyst":
            "将控制设计与运行情况同交易证据、访谈记录、佐证和矛盾信息进行比对。",
          "forensic-accounting-investigation-evidence-owner":
            "将保管、总体、资金流和佐证分支整合为可审查的调查资料包。",
        },
      },
    },
  },
  "builtin/forestry-wildfire-resource-management": {
    label: "林业野火资源管理",
    description: "整合森林清查、可燃物与野火风险、处置情景和火后资源证据，供合格人员审查。",
    selectorSummary: "用于边界明确的林业与野火资源管理证据工作。",
    agents: {
      "forest-inventory-condition-trend-analyst": {
        label: "森林清查、状况与趋势分析师",
        description: "核对森林规划单元、样地或林分、树种、结构、健康状况和变化证据。",
      },
      "wildfire-hazard-exposure-fuels-analyst": {
        label: "野火危险、暴露与可燃物分析师",
        description: "将所提供的植被、可燃物、地形、天气或气候及暴露数据集追溯至边界明确的危险证据。",
      },
      "forest-treatment-scenario-tradeoff-analyst": {
        label: "森林处置情景与权衡分析师",
        description: "从生态、社会、运营和成本目标比较所提供的森林或可燃物处置情景。",
      },
      "wildfire-monitoring-burn-severity-recovery-analyst": {
        label: "野火监测、烧毁严重度与恢复分析师",
        description: "整理非战术性火情观测、边界或烧毁严重度产品和火后资源监测资料。",
      },
      "forestry-wildfire-resource-management-review-owner": {
        label: "林业野火资源管理审查负责人",
        description: "整合清查、危险与暴露、处置和火后证据，供合格的资源管理决策使用。",
      },
    },
    workflows: {
      "forestry-wildfire-resource-management-review": {
        label: "林业野火资源管理审查",
        description: "四个独立资源证据分支汇聚至明确的审查负责人。",
        nodes: {
          "forest-inventory-condition-trend-analyst": "核对森林规划单元、样地或林分、树种、结构、健康状况和变化证据。",
          "wildfire-hazard-exposure-fuels-analyst":
            "将所提供的植被、可燃物、地形、天气或气候及暴露数据集追溯至边界明确的危险证据。",
          "forest-treatment-scenario-tradeoff-analyst":
            "从生态、社会、运营和成本目标比较所提供的森林或可燃物处置情景。",
          "wildfire-monitoring-burn-severity-recovery-analyst":
            "整理非战术性火情观测、边界或烧毁严重度产品和火后资源监测资料。",
          "forestry-wildfire-resource-management-review-owner":
            "整合清查、危险与暴露、处置和火后证据，供合格的资源管理决策使用。",
        },
      },
    },
  },
  "builtin/frontend-innovate": {
    label: "前端创新",
    description:
      "通过持久的目录事实和可见的叙事式 Turn 摘要，开展有证据支持的产品重设计、视觉方向制定、实现与渲染证明。",
    selectorSummary: "用于需要渲染设计证明、由证据支持的前端重设计与产品创新。",
    agents: {
      "frontend-innovate-explorer": {
        label: "前端创新探索员",
        description: "定位当前产品界面、可复用资产和实现约束。",
      },
      "frontend-innovate-intent-analyst": {
        label: "前端创新意图分析师",
        description: "归类产品意图、设计追求、证据需求和约束。",
      },
      "frontend-innovate-requirements-analyst": {
        label: "前端创新需求分析师",
        description: "定义可观察的产品、组件、数据、交互和验证要求。",
      },
      "frontend-innovate-solution-architect": {
        label: "前端创新解决方案架构师",
        description: "将选定方向分解为一致的产品与实现契约。",
      },
      "frontend-innovate-experience-designer": {
        label: "前端创新体验设计师",
        description: "产出有证据支持的设计方向和可渲染、可编辑源文件的设计草稿。",
      },
      "frontend-innovate-source-researcher": {
        label: "前端创新来源研究员",
        description: "调查源页面、交互状态、信息架构和视觉证据。",
      },
      "frontend-innovate-implementer": {
        label: "前端创新实现工程师",
        description: "实现选定的渲染设计方向，不另造平行结构。",
      },
      "frontend-innovate-visual-reviewer": {
        label: "前端创新视觉审查员",
        description: "依据选定的设计草稿和证据审查渲染后的产品。",
      },
      "frontend-innovate-deep-researcher": {
        label: "前端创新研究员",
        description: "收集竞品、行业和设计参考证据。",
      },
      "frontend-innovate-fact-checker": {
        label: "前端创新事实核查员",
        description: "依据证据核验参考资料和产品主张。",
      },
      "frontend-innovate-workload-analyst": {
        label: "前端创新工作量分析师",
        description: "估算设计、实现、证据和验证工作量。",
      },
      "frontend-innovate-integrity-reviewer": {
        label: "前端创新完整性审查员",
        description: "拒绝泛化、缺乏证据或结构偏离的设计交付。",
      },
    },
    workflows: {
      delivery: {
        label: "前端创新交付",
        description: "从调查到交付和独立审查、由证据引导的前端创新协作。",
        nodes: {
          "frontend-innovate-explorer": "定位当前产品界面、可复用资产和实现约束。",
          "frontend-innovate-intent-analyst": "归类产品意图、设计追求、证据需求和约束。",
          "frontend-innovate-requirements-analyst": "定义可观察的产品、组件、数据、交互和验证要求。",
          "frontend-innovate-solution-architect": "将选定方向分解为一致的产品与实现契约。",
          "frontend-innovate-experience-designer": "产出有证据支持的设计方向和可渲染、可编辑源文件的设计草稿。",
          "frontend-innovate-source-researcher": "调查源页面、交互状态、信息架构和视觉证据。",
          "frontend-innovate-implementer": "实现选定的渲染设计方向，不另造平行结构。",
          "frontend-innovate-visual-reviewer": "依据选定的设计草稿和证据审查渲染后的产品。",
          "frontend-innovate-deep-researcher": "收集竞品、行业和设计参考证据。",
          "frontend-innovate-fact-checker": "依据证据核验参考资料和产品主张。",
          "frontend-innovate-workload-analyst": "估算设计、实现、证据和验证工作量。",
          "frontend-innovate-integrity-reviewer": "拒绝泛化、缺乏证据或结构偏离的设计交付。",
        },
      },
    },
  },
  "builtin/frontend-replica": {
    label: "前端复刻",
    description:
      "基于源 URL 和参考截图完成复刻，提供桌面端界面清单、渲染证明、持久的目录事实和可见的叙事式 Turn 摘要。",
    selectorSummary: "用于需要证据支持一致性的源 URL 或参考截图桌面端复刻工作。",
    agents: {
      "frontend-replica-explorer": {
        label: "前端复刻探索员",
        description: "定位目标实现界面、资产、基础组件和集成约束。",
      },
      "frontend-replica-intent-analyst": {
        label: "前端复刻意图分析师",
        description: "归类来源、目标、桌面端范围、证据缺口和一致性义务。",
      },
      "frontend-replica-requirements-analyst": {
        label: "前端复刻需求分析师",
        description: "定义受来源约束的界面、交互、内容、资产和渲染一致性要求。",
      },
      "frontend-replica-solution-architect": {
        label: "前端复刻解决方案架构师",
        description: "将来源证据映射至目标组件、契约和验证区域。",
      },
      "frontend-replica-interface-modeler": {
        label: "前端复刻界面建模师",
        description: "生成唯一的 Task 级受来源约束界面模型与实现契约。",
      },
      "frontend-replica-source-researcher": {
        label: "前端复刻来源研究员",
        description: "采集源页面结构、状态、内容、交互和截图证据。",
      },
      "frontend-replica-workload-analyst": {
        label: "前端复刻工作量分析师",
        description: "估算来源证据、界面实现、交互和视觉验证工作量。",
      },
      "frontend-replica-implementer": {
        label: "前端复刻实现工程师",
        description: "在目标项目中实现同一个受来源约束的界面。",
      },
      "frontend-replica-visual-reviewer": {
        label: "前端复刻视觉审查员",
        description: "将目标渲染证据与来源区域和交互状态进行比较。",
      },
      "frontend-replica-integrity-reviewer": {
        label: "前端复刻完整性审查员",
        description: "拒绝区域缺失、交互故障、无依据的差异和薄弱证据。",
      },
    },
    workflows: {
      "interface-modeling": {
        label: "显式界面建模",
        description: "聚焦界面建模的协作，与源复刻交付使用同一位唯一的源项目生成负责人。",
        nodes: {
          "frontend-replica-intent-analyst": "归类来源、目标、桌面端范围、证据缺口和一致性义务。",
          "frontend-replica-source-researcher": "采集源页面结构、状态、内容、交互和截图证据。",
          "frontend-replica-requirements-analyst": "定义受来源约束的界面、交互、内容、资产和渲染一致性要求。",
          "frontend-replica-solution-architect": "将来源证据映射至目标组件、契约和验证区域。",
          "frontend-replica-interface-modeler": "生成唯一的受来源约束项目模型与实现契约，供 Delivery Slice 对象使用。",
        },
      },
      "source-replica": {
        label: "来源复刻交付",
        description:
          "桌面端来源复刻协作；各节点在每个 Task 中仅运行一次，从来源证据推进到 Delivery Slice revision 对象及独立渲染审查。",
        nodes: {
          "frontend-replica-explorer": "定位目标实现界面、资产、基础组件和集成约束。",
          "frontend-replica-intent-analyst": "归类来源、目标、桌面端范围、证据缺口和一致性义务。",
          "frontend-replica-source-researcher": "采集源页面结构、状态、内容、交互和截图证据。",
          "frontend-replica-requirements-analyst": "定义受来源约束的界面、交互、内容、资产和渲染一致性要求。",
          "frontend-replica-solution-architect": "将来源证据映射至目标组件、契约和验证区域。",
          "frontend-replica-interface-modeler": "生成唯一的受来源约束项目模型与实现契约，供 Delivery Slice 对象使用。",
          "frontend-replica-workload-analyst": "估算来源证据、界面实现、交互和视觉验证工作量。",
          "frontend-replica-implementer": "在目标项目中实现同一个受来源约束的界面。",
          "frontend-replica-integrity-reviewer": "拒绝区域缺失、交互故障、无依据的差异和薄弱证据。",
          "frontend-replica-visual-reviewer": "将目标渲染证据与来源区域和交互状态进行比较。",
        },
      },
    },
  },
  "builtin/geospatial-analysis-cartography": {
    label: "地理空间分析与制图",
    description:
      "将空间数据完整性、栅格与矢量分析及无障碍制图证据整合为出版审查资料包，但不具备测量、法定边界、导航或发布权限。",
    selectorSummary: "用于边界明确的地理空间分析、数据完整性与制图审查。",
    agents: {
      "spatial-data-crs-integrity-analyst": {
        label: "空间数据与 CRS 完整性分析师",
        description: "审计来源身份、许可、CRS、基准面、历元、坐标轴、单位、几何有效性、精度和拓扑。",
      },
      "spatial-analysis-raster-vector-analyst": {
        label: "空间分析栅格与矢量分析师",
        description: "规划并核对投影、连接、叠加、测量、栅格对齐、重采样、无数据值和空间不确定性。",
      },
      "cartographic-design-accessibility-analyst": {
        label: "制图设计与无障碍分析师",
        description: "规定以目的为导向的层级、分级、符号、标注、图例、多语言行为、不确定性和无障碍要求。",
      },
      "geospatial-cartography-owner": {
        label: "地理空间与制图负责人",
        description: "将空间完整性、分析溯源和制图规范整合为受控的出版审查资料包。",
      },
    },
    workflows: {
      "geospatial-analysis-cartography-review": {
        label: "地理空间分析与制图审查",
        description: "三个独立空间分析分支汇聚为一个出版审查资料包。",
        nodes: {
          "spatial-data-crs-integrity-analyst": "审计来源、CRS、基准面、几何、拓扑、精度和许可证据。",
          "spatial-analysis-raster-vector-analyst": "规划并核对空间运算、测量、栅格对齐和不确定性。",
          "cartographic-design-accessibility-analyst": "规定视觉层级、标注、图例、不确定性、多语言行为和无障碍要求。",
          "geospatial-cartography-owner":
            "在不具备测量、地籍、导航、敏感位置披露、外部写入或发布权限的前提下整合三个分支。",
        },
      },
    },
  },
  "builtin/hazardous-waste-compliance-operations": {
    label: "危险废物合规运营",
    description:
      "开展受来源约束的废物流判定、产生者与暂存证据审查以及联单到最终处置的核对，但不具备法律、操作、运输或处置权限。",
    selectorSummary: "用于证据受控的危险废物合规运营。",
    agents: {
      "hazardous-waste-stream-determination-analyst": {
        label: "危险废物流判定分析师",
        description: "追踪产生流程、物质身份、采样、分析、流程知识和受来源约束的判定证据。",
      },
      "generator-accumulation-compliance-analyst": {
        label: "产生者与暂存合规分析师",
        description: "核对场址与月份产生量、类别证据、暂存单元身份、检查、培训和应急记录。",
      },
      "hazardous-waste-manifest-disposition-analyst": {
        label: "危险废物联单与处置分析师",
        description: "核对联单行、相关方、签名、修订、差异、异常证据、接收和最终处置记录。",
      },
      "hazardous-waste-compliance-operations-review-owner": {
        label: "危险废物合规运营审查负责人",
        description: "整合判定、产生者与暂存以及联单与处置证据，同时保留合格人员和监管机构的权限。",
      },
    },
    workflows: {
      "hazardous-waste-compliance-operations-review": {
        label: "危险废物合规运营审查",
        description: "三个独立危险废物证据分支汇聚为一次受控审查。",
        nodes: {
          "hazardous-waste-stream-determination-analyst": "追踪流程、物质、采样、分析和判定证据。",
          "generator-accumulation-compliance-analyst": "核对场址或月份数量、类别依据和暂存控制。",
          "hazardous-waste-manifest-disposition-analyst": "核对联单与处置链证据。",
          "hazardous-waste-compliance-operations-review-owner":
            "在不具备法律、签字、操作、运输、处理或处置权限的前提下整合所有分支。",
        },
      },
    },
  },
  "builtin/healthcare-operations": {
    label: "医疗服务运营",
    description: "将去标识化的服务流程、容量、可及性、安全与隐私分析整合为责任明确的运营改进资料包。",
    selectorSummary: "用于边界明确的医疗服务运营改进分析。",
    agents: {
      "healthcare-service-flow-analyst": {
        label: "服务流程分析师",
        description: "梳理去标识化的服务流程、交接、队列和瓶颈。",
      },
      "healthcare-capacity-access-analyst": {
        label: "容量与可及性分析师",
        description: "检验需求、容量、可及性和公平性假设。",
      },
      "healthcare-safety-privacy-analyst": {
        label: "安全与隐私分析师",
        description: "梳理运营安全与隐私证据及缺口。",
      },
      "healthcare-operations-improvement-owner": {
        label: "运营改进负责人",
        description: "将证据整合为责任明确的改进登记册。",
      },
    },
    workflows: {
      "healthcare-operations-improvement-pack": {
        label: "医疗服务运营改进资料包",
        description: "三个独立运营分支汇聚为一份责任明确的登记册。",
        nodes: {
          "healthcare-service-flow-analyst": "梳理服务流程证据。",
          "healthcare-capacity-access-analyst": "梳理容量与可及性证据。",
          "healthcare-safety-privacy-analyst": "梳理安全与隐私证据。",
          "healthcare-operations-improvement-owner": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/hospitality-service-operations": {
    label: "酒店与接待服务运营",
    description: "将宾客旅程、收益与容量、人员、安全和服务补救证据整合为边界明确的酒店与接待运营计划。",
    selectorSummary: "用于有证据支持的酒店与接待服务运营规划。",
    agents: {
      "hospitality-guest-journey-analyst": {
        label: "宾客旅程分析师",
        description: "梳理从预订到离店的旅程、服务触点、投诉和补救证据。",
      },
      "hospitality-revenue-capacity-analyst": {
        label: "收益与容量分析师",
        description: "梳理需求、入住率、房价、库存、渠道和容量证据。",
      },
      "hospitality-workforce-safety-analyst": {
        label: "人员与安全分析师",
        description: "梳理人员配置、客房清洁、餐饮服务、维护、无障碍和安全约束。",
      },
      "hospitality-plan-owner": {
        label: "酒店与接待计划负责人",
        description: "将各分支整合为可回退的宾客服务运营计划。",
      },
    },
    workflows: {
      "hospitality-operations-plan": {
        label: "酒店与接待运营计划",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "hospitality-guest-journey-analyst": "梳理从预订到离店的旅程、服务触点、投诉和补救证据。",
          "hospitality-revenue-capacity-analyst": "梳理需求、入住率、房价、库存、渠道和容量证据。",
          "hospitality-workforce-safety-analyst": "梳理人员配置、客房清洁、餐饮服务、维护、无障碍和安全约束。",
          "hospitality-plan-owner": "将各分支整合为可回退的宾客服务运营计划。",
        },
      },
    },
  },
  "builtin/hr-operations": {
    label: "人力资源与组织运营",
    description:
      "将汇总的人员与人才流程证据转化为并行的人员分析和流程分析、经独立审计的运营计划，以及规范的人力资源交付物。",
    selectorSummary: "用于需要证据整理、并行组织分析、独立审查与运营计划的汇总人员和人才流程规划。",
    agents: {
      "human-resources-operations-planner": {
        label: "人力资源运营规划师",
        description: "定义组织问题、汇总数据边界、司法辖区、流程范围和停止条件。",
      },
      "human-resources-evidence-curator": {
        label: "人力资源证据整理员",
        description: "构建汇总的人员、政策、流程、基准和权限资料集。",
      },
      "workforce-analyst": {
        label: "人员分析师",
        description: "分析汇总的容量、结构、流动、管理跨度、招聘流程和人员风险。",
      },
      "people-process-analyst": {
        label: "人才流程分析师",
        description: "分析招聘、入职、绩效赋能、学习、政策和运营节奏。",
      },
      "organization-operations-synthesizer": {
        label: "组织运营综合分析师",
        description: "将人员与流程发现核对并整合为有序的汇总运营计划草稿。",
      },
      "human-resources-fact-checker": {
        label: "人力资源事实核查员",
        description: "独立审计运营计划草稿中的证据、隐私、权限、计算和法律边界。",
      },
      "human-resources-operating-plan-writer": {
        label: "人力资源运营计划撰写员",
        description: "解决审计问题并发布规范的人力资源与组织运营计划。",
      },
    },
    workflows: {
      "people-operations-plan": {
        label: "经审计的人才运营计划",
        description:
          "当 Task 提供带有司法辖区和时间边界的汇总人员与人才流程证据时使用：定义章程、整理资料集、并行分析人员和流程、综合并审计运营计划，然后发布。",
        nodes: {
          "human-resources-operations-planner": "发布 hr-operations/operating-charter。",
          "human-resources-evidence-curator": "发布 hr-operations/evidence-dossier。",
          "workforce-analyst": "发布 hr-operations/workforce-analysis。",
          "people-process-analyst": "发布 hr-operations/process-analysis。",
          "organization-operations-synthesizer": "发布 hr-operations/operating-plan-draft。",
          "human-resources-fact-checker": "发布 hr-operations/audit。",
          "human-resources-operating-plan-writer": "发布 hr-operations/operating-plan。",
        },
      },
    },
  },
  "builtin/identity-access-governance": {
    label: "身份与访问治理",
    description: "整合身份生命周期、账户与权限、访问控制和认证审查证据，供合格人员开展治理审查。",
    selectorSummary: "用于不执行配置或访问决定、边界明确的身份治理证据工作。",
    agents: {
      "authoritative-identity-lifecycle-analyst": {
        label: "权威身份生命周期分析师",
        description: "核对权威身份总体和入职、调动、离职事件。",
      },
      "account-entitlement-correlation-analyst": {
        label: "账户与权限关联分析师",
        description: "关联身份、账户、组、角色和有效权限。",
      },
      "access-request-role-sod-control-analyst": {
        label: "访问申请、角色与职责分离控制分析师",
        description: "检验访问申请、角色和职责分离证据。",
      },
      "access-certification-orphan-review-analyst": {
        label: "访问认证与孤立账户审查分析师",
        description: "审查认证总体、休眠账户和孤立账户证据。",
      },
      "identity-access-governance-review-owner": {
        label: "身份与访问治理审查负责人",
        description: "整合生命周期、权限、控制和认证证据，但不作访问决定。",
      },
    },
    workflows: {
      "identity-access-governance-review": {
        label: "身份与访问治理审查",
        description: "四个独立专业证据分支汇聚至身份与访问治理审查负责人。",
        nodes: {
          "authoritative-identity-lifecycle-analyst": "核对权威身份总体和入职、调动、离职事件。",
          "account-entitlement-correlation-analyst": "关联身份、账户、组、角色和有效权限。",
          "access-request-role-sod-control-analyst": "检验访问申请、角色和职责分离证据。",
          "access-certification-orphan-review-analyst": "审查认证总体、休眠账户和孤立账户证据。",
          "identity-access-governance-review-owner": "整合生命周期、权限、控制和认证证据，但不作访问决定。",
        },
      },
    },
  },
  "builtin/industrial-hygiene-exposure-assessment": {
    label: "工业卫生暴露评估",
    description: "整合作业人员、危害因素、相似暴露组、采样、分析质量、暴露限值和控制证据，供合格的工业卫生审查。",
    selectorSummary: "用于不具备现场、医疗、个人防护装备选择、合规或报告权限的边界明确的工作场所暴露评估证据工作。",
    agents: {
      "industrial-hygiene-scope-exposure-group-analyst": {
        label: "工业卫生范围与暴露组分析师",
        description: "构建作业人员、Task、危害因素、途径、班次和相似暴露组证据主线。",
      },
      "industrial-hygiene-sampling-analytical-qa-analyst": {
        label: "工业卫生采样与分析质量保证分析师",
        description: "核对样品身份、方法、校准、空白样、实验室结果、单位、删失处理和不确定性。",
      },
      "industrial-hygiene-exposure-control-evidence-analyst": {
        label: "工业卫生暴露与控制证据分析师",
        description: "计算可兼容的暴露度量，并梳理工程、作业实践、行政和呼吸防护计划证据。",
      },
      "industrial-hygiene-exposure-assessment-review-owner": {
        label: "工业卫生暴露评估审查负责人",
        description: "整合三个独立证据分支，并将所有暴露、控制、医疗和合规决定交由合格人员处理。",
      },
    },
    workflows: {
      "industrial-hygiene-exposure-assessment-review": {
        label: "工业卫生暴露评估审查",
        description: "三个独立的范围、测量和暴露控制分支汇聚为边界明确的合格人员审查资料包。",
        nodes: {
          "industrial-hygiene-scope-exposure-group-analyst":
            "构建危害因素、Task、作业人员、途径、班次和相似暴露组证据主线。",
          "industrial-hygiene-sampling-analytical-qa-analyst":
            "核对采样设计、保管、校准、实验室 QA、单位、检出限和不确定性。",
          "industrial-hygiene-exposure-control-evidence-analyst":
            "仅计算可兼容的暴露度量，并梳理所提供的控制和呼吸防护计划证据。",
          "industrial-hygiene-exposure-assessment-review-owner": "整合三个分支，保留矛盾和未知项，并转交专业决定。",
        },
      },
    },
  },
  "builtin/insurance-claims-operations": {
    label: "保险理赔运营",
    description: "将理赔证据、保单可追溯性和控制分析整合为可审查的理赔证据资料包，但不具备裁定权限。",
    selectorSummary: "用于边界明确的保险理赔证据与流程分析。",
    agents: {
      "claims-evidence-analyst": {
        label: "理赔证据分析师",
        description: "梳理理赔时间线、文件、相关方、损失证据和缺失事实。",
      },
      "claims-policy-traceability-analyst": {
        label: "保单可追溯性分析师",
        description: "梳理所提供的保单条款、批单、除外责任和未解决的解释问题。",
      },
      "claims-control-risk-analyst": {
        label: "理赔控制与风险分析师",
        description: "审查交接、欺诈指标、准备金治理、隐私和流程控制。",
      },
      "claims-evidence-pack-owner": {
        label: "理赔证据资料包负责人",
        description: "将三个分支整合为证据与审查登记册。",
      },
    },
    workflows: {
      "claims-evidence-pack": {
        label: "理赔证据资料包",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "claims-evidence-analyst": "梳理理赔时间线、文件、相关方、损失证据和缺失事实。",
          "claims-policy-traceability-analyst": "梳理所提供的保单条款、批单、除外责任和未解决的解释问题。",
          "claims-control-risk-analyst": "审查交接、欺诈指标、准备金治理、隐私和流程控制。",
          "claims-evidence-pack-owner": "将三个分支整合为证据与审查登记册。",
        },
      },
    },
  },
  "builtin/knowledge-base-operations": {
    label: "知识库运营",
    description: "将并行的来源映射、变更编辑和生命周期治理工作整合为可追溯的知识发布记录。",
    selectorSummary: "用于凭借精确的来源、目标位置、生命周期和发布证据，添加、更新、弃用或替换受治理的知识。",
    agents: {
      "knowledge-source-curator": {
        label: "知识来源整理员",
        description: "将权威来源主张映射至精确的知识目标位置，并记录冲突和时效性证据。",
      },
      "knowledge-change-editor": {
        label: "知识变更编辑员",
        description: "使用稳定键、重大差异和依赖影响准备规范的新增或修订内容。",
      },
      "knowledge-lifecycle-governor": {
        label: "知识生命周期治理员",
        description: "定义责任、审查、批准、弃用、替换、保留和纠正控制。",
      },
      "knowledge-publication-integrator": {
        label: "知识发布整合员",
        description: "将来源、变更和生命周期证据整合为规范的待发布记录。",
      },
    },
    workflows: {
      "grounded-knowledge-release": {
        label: "基于来源的知识发布",
        description: "独立开展来源映射、变更编辑和生命周期治理，再整合为可追溯的发布记录。",
        nodes: {
          "knowledge-source-curator": "发布来源、主张和目标位置映射。",
          "knowledge-change-editor": "发布规范的知识更新提案和重大差异。",
          "knowledge-lifecycle-governor": "发布责任、审查、弃用、替换和发布控制。",
          "knowledge-publication-integrator": "将来源、变更和生命周期证据整合为最终发布记录。",
        },
      },
    },
  },
  "builtin/laboratory-quality-assurance": {
    label: "实验室质量保证",
    description: "整合方法性能、计量和样品质量证据供合格实验室保证审查，但不具备结果放行、临床解释或认可权限。",
    selectorSummary: "用于边界明确的实验室方法、计量、样品、QC、能力验证和 CAPA 证据审查。",
    agents: {
      "laboratory-method-validation-analyst": {
        label: "实验室方法验证分析师",
        description: "整理预期用途、被测量、基质、范围、性能和验证证据，但不批准方法。",
      },
      "laboratory-metrology-equipment-analyst": {
        label: "实验室计量与设备分析师",
        description: "追踪设备状态、校准、参考标准、计量溯源和不确定性证据。",
      },
      "laboratory-sample-qc-proficiency-analyst": {
        label: "实验室样品 QC 与能力验证分析师",
        description: "审计保管、质量控制、能力验证、不符合项和 CAPA 证据。",
      },
      "laboratory-quality-review-owner": {
        label: "实验室质量审查负责人",
        description: "将三个实验室证据分支整合为受控的合格人员审查资料包。",
      },
    },
    workflows: {
      "laboratory-quality-assurance-review": {
        label: "实验室质量保证审查",
        description: "三个独立实验室保证分支汇聚为一份合格人员审查资料包。",
        nodes: {
          "laboratory-method-validation-analyst": "评估预期用途和方法性能证据。",
          "laboratory-metrology-equipment-analyst": "追踪设备、校准、标准、不确定性和计量证据。",
          "laboratory-sample-qc-proficiency-analyst": "审计保管、QC、PT、不符合项和 CAPA 证据。",
          "laboratory-quality-review-owner": "在不具备方法批准、结果放行、认可或运营权限的前提下整合所有分支。",
        },
      },
    },
  },
  "builtin/life-sciences-regulatory": {
    label: "生命科学监管准备",
    description: "将产品、证据、路径、市场、质量和风险输入整合为监管准备度登记册草稿，供合格人员审查。",
    selectorSummary: "用于边界明确的生命科学监管准备度分析。",
    agents: {
      "regulatory-product-evidence-analyst": {
        label: "产品与证据分析师",
        description: "梳理预期用途、产品主张、证据、版本和未解决的临床或技术缺口。",
      },
      "regulatory-pathway-market-analyst": {
        label: "路径与市场分析师",
        description: "梳理候选司法辖区、路径、分类、要求和权限问题。",
      },
      "regulatory-quality-risk-analyst": {
        label: "质量与风险分析师",
        description: "梳理质量体系、风险文件、可追溯性、上市后和控制证据。",
      },
      "regulatory-readiness-owner": {
        label: "监管准备负责人",
        description: "将各分支整合为带有合格人员决策门槛的准备度登记册草稿。",
      },
    },
    workflows: {
      "regulatory-readiness-pack": {
        label: "监管准备资料包",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "regulatory-product-evidence-analyst": "梳理预期用途、产品主张、证据、版本和未解决的临床或技术缺口。",
          "regulatory-pathway-market-analyst": "梳理候选司法辖区、路径、分类、要求和权限问题。",
          "regulatory-quality-risk-analyst": "梳理质量体系、风险文件、可追溯性、上市后和控制证据。",
          "regulatory-readiness-owner": "将各分支整合为带有合格人员决策门槛的准备度登记册草稿。",
        },
      },
    },
  },
  "builtin/localization-adaptation": {
    label: "本地化与适配",
    description: "将并行的术语、区域适配和语言质量工作整合为受源文件控制的区域版本发布资料包。",
    selectorSummary: "用于面向指定语言与区域组合、受术语控制且具备明确语言质量证据的适配工作。",
    agents: {
      "localization-terminology-steward": {
        label: "本地化术语管理员",
        description: "构建上下文术语登记册、受保护 token 清单和源文歧义记录。",
      },
      "localization-locale-adapter": {
        label: "区域适配专家",
        description: "针对指定区域、受众、渠道和格式约束适配稳定的源内容。",
      },
      "localization-linguistic-qa": {
        label: "语言质量审查员",
        description: "独立检查准确性、流畅度、术语、区域惯例、token 和审查覆盖。",
      },
      "localization-release-integrator": {
        label: "本地化发布整合员",
        description: "将术语、适配和语言质量证据整合为区域版本发布资料包。",
      },
    },
    workflows: {
      "locale-release-pack": {
        label: "区域版本发布资料包",
        description: "独立开展术语、区域适配和语言质量工作，再将其整合为一份发布资料包。",
        nodes: {
          "localization-terminology-steward": "发布上下文术语与受保护 token 登记册。",
          "localization-locale-adapter": "发布区域适配内容和适配日志。",
          "localization-linguistic-qa": "发布独立语言质量审查或预检矩阵。",
          "localization-release-integrator": "将术语、适配和质量证据整合为最终区域版本发布资料包。",
        },
      },
    },
  },
  "builtin/manufacturing-quality": {
    label: "制造质量",
    description: "将流程证据、缺陷分析和控制验证整合为可追溯的不符合项处置资料包。",
    selectorSummary: "用于有证据支持的制造质量分析。",
    agents: {
      "quality-process-evidence-analyst": {
        label: "流程证据分析师",
        description: "梳理受影响流程、记录、变更、批次和缺失证据。",
      },
      "quality-defect-analysis-specialist": {
        label: "缺陷分析专家",
        description: "检验缺陷模式和相互竞争的因果假设。",
      },
      "quality-control-verification-analyst": {
        label: "控制验证分析师",
        description: "评估检查、测量、采样、校准和控制证据。",
      },
      "quality-disposition-owner": {
        label: "质量处置负责人",
        description: "将所有分支整合为可追溯的处置资料包。",
      },
    },
    workflows: {
      "manufacturing-quality-disposition-pack": {
        label: "制造质量处置资料包",
        description: "三个独立质量分支汇聚为一份处置资料包。",
        nodes: {
          "quality-process-evidence-analyst": "梳理流程证据。",
          "quality-defect-analysis-specialist": "检验缺陷假设。",
          "quality-control-verification-analyst": "梳理控制验证证据。",
          "quality-disposition-owner": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/maritime-port-operations": {
    label: "海事港口运营",
    description: "将船舶挂靠、泊位、航海服务、码头流转、货物单证和保管证据整合为边界明确的港口运营审查资料包。",
    selectorSummary: "用于不具备船舶、码头、海关或安全权限、基于来源的海事港口运营审查。",
    agents: {
      "vessel-call-berth-nautical-analyst": {
        label: "船舶挂靠、泊位与航海分析师",
        description: "核对船舶挂靠里程碑、泊位窗口、尺度兼容性和航海服务依赖。",
      },
      "terminal-yard-gate-flow-analyst": {
        label: "码头堆场与闸口流转分析师",
        description: "核对货物搬运、设备与人力容量、堆场占用、滞留、倒箱和多式联运接口。",
      },
      "cargo-document-safety-custody-analyst": {
        label: "货物单证、安全与保管分析师",
        description: "核对货物身份、舱单、VGM、申报、放行状态和保管证据，但不具备放行权限。",
      },
      "maritime-port-operations-review-owner": {
        label: "海事港口运营审查负责人",
        description: "整合船舶挂靠、码头流转和货物保管证据，并转交合格人员决定。",
      },
    },
    workflows: {
      "maritime-port-operations-review": {
        label: "海事港口运营审查",
        description: "三个独立港口证据分支汇聚为一份边界明确的运营审查资料包。",
        nodes: {
          "vessel-call-berth-nautical-analyst": "核对船舶挂靠里程碑、泊位兼容性、冲突和航海依赖。",
          "terminal-yard-gate-flow-analyst": "核对码头容量、搬运、占用、滞留、倒箱和多式联运接口。",
          "cargo-document-safety-custody-analyst": "核对货物身份、单证、申报状态、放行状态和保管交接。",
          "maritime-port-operations-review-owner": "整合所有分支，揭示矛盾与未知项，并转交人工决定。",
        },
      },
    },
  },
  "builtin/marketing-growth": {
    label: "营销与增长战略",
    description: "以证据引导受众、渠道、实验、衡量和营销活动规划，不承诺增长结果。",
    selectorSummary: "规划一项有证据支持、明确实验与衡量方法的营销和增长活动。",
    agents: {
      "marketing-growth-planner": {
        label: "营销增长规划师",
        description: "定义范围、决策、输入、基线、约束和衡量契约。",
      },
      "marketing-growth-evidence-researcher": {
        label: "营销证据研究员",
        description: "构建注明日期的市场、受众、竞品、渠道和基准证据资料集。",
      },
      "marketing-growth-audience-analyst": {
        label: "受众与产品主张分析师",
        description: "分析受众问题、购买情境、产品契合度、定位和信息假设。",
      },
      "marketing-growth-channel-analyst": {
        label: "渠道与漏斗分析师",
        description: "分析渠道契合度、漏斗机制、经济性、衡量方式和候选实验。",
      },
      "marketing-growth-strategist": {
        label: "增长战略综合分析师",
        description: "将两项分析整合为按优先级排序的营销活动与实验战略。",
      },
      "marketing-growth-fact-checker": {
        label: "营销增长事实核查员",
        description: "审计战略中的主张、计算、来源、实验定义和交付闭环。",
      },
      "marketing-growth-campaign-writer": {
        label: "营销活动计划撰写员",
        description: "负责修正后的规范营销活动计划和交互式交付。",
      },
    },
    workflows: {
      "marketing-growth-campaign": {
        label: "营销增长活动",
        description:
          "具有约束力的营销与增长战略 workflow。每个节点恰好运行一次；独立分支并发启动，汇合节点等待所有前序节点。",
        nodes: {
          "marketing-growth-planner": "定义范围、决策、输入、基线、约束和衡量契约。",
          "marketing-growth-evidence-researcher": "构建注明日期的市场、受众、竞品、渠道和基准证据资料集。",
          "marketing-growth-audience-analyst": "分析受众问题、购买情境、产品契合度、定位和信息假设。",
          "marketing-growth-channel-analyst": "分析渠道契合度、漏斗机制、经济性、衡量方式和候选实验。",
          "marketing-growth-strategist": "将两项分析整合为按优先级排序的营销活动与实验战略。",
          "marketing-growth-fact-checker": "审计战略中的主张、计算、来源、实验定义和交付闭环。",
          "marketing-growth-campaign-writer": "负责修正后的规范营销活动计划和交互式交付。",
        },
      },
    },
  },
  "builtin/materials-failure-analysis": {
    label: "材料失效分析",
    description: "整合实体部件保管、服役历史、断口表面、材料表征、载荷、环境、力学和竞争假设证据，供合格人员审查。",
    selectorSummary:
      "用于边界明确的实体材料失效证据工作，不具备接触证据、破坏性试验、根因、责任、适用性、处置、召回或恢复使用的权限。",
    agents: {
      "materials-failure-evidence-custody-history-analyst": {
        label: "材料失效证据、保管与历史分析师",
        description: "固化失效部件身份、接收时状态、证据保管、设计与制造以及服役时间线。",
      },
      "materials-fractography-characterization-analyst": {
        label: "材料断口与表征分析师",
        description: "梳理所提供的断裂起源与形貌、金相、成分、硬度和力学试验证据及其不确定性。",
      },
      "materials-load-environment-mechanics-analyst": {
        label: "材料载荷、环境与力学分析师",
        description: "将服役载荷、几何、环境和边界明确的力学计算核对为相互竞争的失效假设。",
      },
      "materials-failure-analysis-review-owner": {
        label: "材料失效分析审查负责人",
        description: "整合保管与历史、表征和力学证据，同时保留竞争假设与专业权限。",
      },
    },
    workflows: {
      "materials-failure-analysis-review": {
        label: "材料失效分析审查",
        description: "三个独立的保管与历史、表征和力学分支汇聚为边界明确的失效证据资料包。",
        nodes: {
          "materials-failure-evidence-custody-history-analyst":
            "固化失效部件身份、接收时证据、保管以及服役、设计与制造历史。",
          "materials-fractography-characterization-analyst": "梳理断口表面和材料表征证据及其方法与不确定性。",
          "materials-load-environment-mechanics-analyst":
            "将载荷、几何、环境和边界明确的力学计算核对为相互竞争的假设。",
          "materials-failure-analysis-review-owner": "整合所有分支，保留矛盾和替代假设，并转交专业决定。",
        },
      },
    },
  },
  "builtin/marine-vessel-survey-maintenance-assurance": {
    label: "船舶检验与维修保障",
    description:
      "对船舶身份、法定与船级社资料来源、船体检验、机械与电气维修、缺陷、修理、不符合项和验证证据进行保障审查，但不具备适航认定或开航批准权限。",
    selectorSummary: "用于为船旗国、船级社和船东审查准备的受控船舶检验与维修证据。",
    agents: {
      "vessel-identity-statutory-class-authority-analyst": {
        label: "船舶身份、法定与船级权限分析师",
        description: "固化船舶及其配置身份，并区分船旗国、法定、船级社、港口国监督和公司记录。",
      },
      "vessel-hull-structure-condition-survey-analyst": {
        label: "船体结构状况检验分析师",
        description: "梳理船体、舱柜、甲板、构件、涂层、腐蚀、裂纹、变形和厚度证据。",
      },
      "vessel-machinery-electrical-maintenance-analyst": {
        label: "船舶机械与电气维修分析师",
        description: "追踪关键设备、冗余、维修、测试、故障、延期项目、备件和验证证据。",
      },
      "vessel-defect-repair-nonconformity-analyst": {
        label: "船舶缺陷、修理与不符合项分析师",
        description: "追踪缺陷、临时措施、修理、不符合项、检验或检查、验证和关闭证据。",
      },
      "marine-vessel-survey-maintenance-review-owner": {
        label: "船舶检验与维修审查负责人",
        description: "将船舶权限、船体、机械以及缺陷与修理证据汇总为供合格船舶专业人员审查的资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "船舶检验与维修保障合格专业人员审查",
        description: "各项独立专业证据分支汇聚为一次受控的船舶检验与维修保障审查。",
        nodes: {
          "vessel-identity-statutory-class-authority-analyst":
            "固化船舶及其配置身份，并区分船旗国、法定、船级社、港口国监督和公司记录。",
          "vessel-hull-structure-condition-survey-analyst":
            "梳理船体、舱柜、甲板、构件、涂层、腐蚀、裂纹、变形和厚度证据。",
          "vessel-machinery-electrical-maintenance-analyst":
            "追踪关键设备、冗余、维修、测试、故障、延期项目、备件和验证证据。",
          "vessel-defect-repair-nonconformity-analyst":
            "追踪缺陷、临时措施、修理、不符合项、检验或检查、验证和关闭证据。",
          "marine-vessel-survey-maintenance-review-owner":
            "将船舶权限、船体、机械以及缺陷与修理证据汇总为供合格船舶专业人员审查的资料包。",
        },
      },
    },
  },
  "builtin/media-rights-clearance": {
    label: "媒体版权与授权核查",
    description:
      "将各组成素材的来源、权属链、许可协议与授权书条款以及预期用途限制，汇总为可供法律顾问审阅的媒体权利核查登记册。",
    selectorSummary: "用于边界明确的媒体权利证据整理与授权核查准备。",
    agents: {
      "media-asset-rights-inventory-analyst": {
        label: "媒体资产权利清查分析师",
        description: "对每项组成素材进行版本管理，并追踪创作者、来源、权利主张方和权属链证据。",
      },
      "media-license-release-terms-analyst": {
        label: "媒体许可协议与授权书条款分析师",
        description: "提取已提供文件中的许可事项、禁止事项、义务、限制以及尚未解决的解释问题。",
      },
      "media-intended-use-risk-analyst": {
        label: "媒体预期使用风险分析师",
        description: "将已固化的使用方案与记录在案的权利、授权书、限制和义务进行比对。",
      },
      "media-clearance-register-owner": {
        label: "媒体权利核查登记册负责人",
        description: "将所有分支汇总为经过版本管理、可供法律顾问审阅的决定与义务登记册。",
      },
    },
    workflows: {
      "media-rights-clearance-pack": {
        label: "媒体版权与授权核查资料包",
        description: "三个独立证据分支汇聚为一份可供法律顾问审阅的权利核查登记册。",
        nodes: {
          "media-asset-rights-inventory-analyst":
            "对组成素材进行版本管理，并追踪创作者、来源、权利主张方和权属链证据。",
          "media-license-release-terms-analyst": "提取记录在案的许可事项、禁止事项、义务、限制和待解释问题。",
          "media-intended-use-risk-analyst": "将预期用途与记录在案的权利范围、限制和义务进行比对。",
          "media-clearance-register-owner": "将所有分支汇总为一份经过版本管理、可供法律顾问审阅的决定资料包。",
        },
      },
    },
  },
  "builtin/medical-device-human-factors-usability-assurance": {
    label: "医疗器械人因与可用性保障",
    description:
      "对医疗器械使用规范、任务与使用相关风险分析、形成性和总结性证据，以及可用性工程可追溯性进行审查，但不具备合规判定或剩余风险接受权限。",
    selectorSummary: "用于证据边界明确的医疗器械人因与可用性工程审查准备。",
    agents: {
      "device-use-specification-interface-analyst": {
        label: "器械使用规范与界面分析师",
        description: "固化预期用户、预期用途、使用环境、器械与 UI 版本、标签、培训和界面边界。",
      },
      "critical-task-use-risk-analyst": {
        label: "关键任务与使用风险分析师",
        description: "梳理任务序列、使用困难、使用错误和已提供的危险情形，但不作风险接受判定。",
      },
      "formative-usability-evidence-analyst": {
        label: "形成性可用性证据分析师",
        description: "追踪形成性研究的范围、观察结果、设计假设和受控设计响应。",
      },
      "summative-usability-traceability-analyst": {
        label: "总结性可用性可追溯性分析师",
        description: "审查已提供的总结性评价方案、执行与结果以及关键任务覆盖，但不宣告验证成功。",
      },
      "medical-device-human-factors-usability-review-owner": {
        label: "医疗器械人因与可用性审查负责人",
        description: "将使用规范、使用风险、形成性和总结性分支汇总为受控的可用性工程审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "医疗器械人因与可用性保障合格专业人员审查",
        description: "各项独立专业证据分支汇聚为一次受控的医疗器械人因与可用性保障审查。",
        nodes: {
          "device-use-specification-interface-analyst":
            "固化预期用户、预期用途、使用环境、器械与 UI 版本、标签、培训和界面边界。",
          "critical-task-use-risk-analyst": "梳理任务序列、使用困难、使用错误和已提供的危险情形，但不作风险接受判定。",
          "formative-usability-evidence-analyst": "追踪形成性研究的范围、观察结果、设计假设和受控设计响应。",
          "summative-usability-traceability-analyst":
            "审查已提供的总结性评价方案、执行与结果以及关键任务覆盖，但不宣告验证成功。",
          "medical-device-human-factors-usability-review-owner":
            "将使用规范、使用风险、形成性和总结性分支汇总为受控的可用性工程审查资料包。",
        },
      },
    },
  },
  "builtin/medical-imaging-quality-assurance": {
    label: "医学影像质量保证",
    description:
      "在不具备临床或系统操作权限的前提下，开展有明确证据边界的影像设备、协议、模体 QC、DICOM workflow、显示、剂量指数和不符合项审查。",
    selectorSummary: "用于基于来源的医学影像 QA 证据与合格人员审查准备。",
    agents: {
      "imaging-equipment-protocol-configuration-analyst": {
        label: "影像设备、协议与配置分析师",
        description: "核对设备、探测器、软件、协议和获批基线证据。",
      },
      "imaging-phantom-technical-qc-analyst": {
        label: "影像模体技术 QC 分析师",
        description: "追踪模体程序、技术测量、计算、公差和不确定性。",
      },
      "dicom-data-display-workflow-integrity-analyst": {
        label: "DICOM 数据与显示 workflow 完整性分析师",
        description: "核对最小化的 DICOM 身份、传输、存储、衍生输出和显示链证据。",
      },
      "imaging-dose-nonconformance-trend-analyst": {
        label: "影像剂量、不符合项与趋势分析师",
        description: "追踪模态剂量指数上下文、不符合项、服务、复测、CAPA 和趋势证据。",
      },
      "medical-imaging-quality-assurance-review-owner": {
        label: "医学影像质量保证审查负责人",
        description: "将四个分支整合为合格人员审查资料包，同时保留临床和运营决定权。",
      },
    },
    workflows: {
      "medical-imaging-quality-assurance-review": {
        label: "医学影像质量保证审查",
        description: "四个独立影像 QA 证据分支汇聚为一次受控审查。",
        nodes: {
          "imaging-equipment-protocol-configuration-analyst": "核对设备、协议和配置基线。",
          "imaging-phantom-technical-qc-analyst": "追踪模体 QC 测量和不确定性。",
          "dicom-data-display-workflow-integrity-analyst": "核对 DICOM 与显示链完整性证据。",
          "imaging-dose-nonconformance-trend-analyst": "追踪剂量指数、不符合项、服务、CAPA 和趋势。",
          "medical-imaging-quality-assurance-review-owner":
            "在不具备临床、运营、恢复使用或认可权限的前提下整合所有证据。",
        },
      },
    },
  },
  "builtin/meeting-knowledge": {
    label: "会议知识运营",
    description: "基于来源开展会议记录、决定与行动提取、知识发布和独立可追溯性审查。",
    selectorSummary: "将会议证据转化为可追溯的决定、行动、待决问题和可复用知识。",
    agents: {
      "meeting-evidence-curator": {
        label: "会议证据整理员",
        description: "根据文字记录、录音、笔记、聊天和引用文件构建规范的带时间戳来源台账。",
      },
      "meeting-decision-analyst": {
        label: "会议决定与行动分析师",
        description: "归类候选决定、行动、负责人、日期、问题、风险和分歧，不虚构共识。",
      },
      "meeting-knowledge-editor": {
        label: "会议知识编辑员",
        description: "将来源证据和已归类结果整合为规范的会议纪要、决定与行动登记册及范围明确的知识更新。",
      },
      "meeting-knowledge-reviewer": {
        label: "会议知识审查员",
        description: "独立检查归属、时间戳、决定状态、行动责任、保密性、矛盾和来源覆盖。",
      },
    },
    workflows: {
      "meeting-knowledge-publication": {
        label: "会议知识发布",
        description: "并行开展来源整理和结果归类，将二者整合为一次知识发布，再独立审查来源忠实度与发布边界。",
        nodes: {
          "meeting-evidence-curator": "产出带时间戳的会议来源台账和覆盖图。",
          "meeting-decision-analyst": "产出已归类的决定、行动、问题、风险和分歧登记册。",
          "meeting-knowledge-editor": "将两项分析整合为规范的会议纪要、登记册和范围明确的知识更新。",
          "meeting-knowledge-reviewer": "独立审查整合后的发布内容，并记录所需纠正或暂不发布的材料。",
        },
      },
    },
  },
  "builtin/meteorological-observation-forecast-assurance": {
    label: "气象观测与预报保证",
    description: "处理站点与传感器元数据、观测 QC、预报周期溯源、对齐和验证证据，但不具备预报或预警权限。",
    selectorSummary: "用于基于来源的气象观测与预报保证证据工作。",
    agents: {
      "meteorological-observation-metadata-quality-analyst": {
        label: "气象观测元数据质量分析师",
        description: "追踪站点、平台、传感器、校准、观测、质量控制、延迟和 revision 证据。",
      },
      "forecast-cycle-provenance-analyst": {
        label: "预报周期溯源分析师",
        description:
          "追踪生成系统、模型或产品、周期、发布时间、有效时间、预见期、网格、层次、成员、后处理和 revision 证据。",
      },
      "forecast-verification-evidence-analyst": {
        label: "预报验证证据分析师",
        description: "对齐符合条件的观测与预报配对，并准备由来源定义的连续型、分类型、概率型或空间型验证证据。",
      },
      "meteorological-observation-forecast-assurance-review-owner": {
        label: "气象观测与预报保证审查负责人",
        description: "整合观测、预报溯源、对齐和验证证据，同时保留官方和运营决定权。",
      },
    },
    workflows: {
      "meteorological-observation-forecast-assurance-review": {
        label: "气象观测与预报保证审查",
        description: "三个独立气象证据分支汇聚为一次受控的保证审查。",
        nodes: {
          "meteorological-observation-metadata-quality-analyst": "追踪站点或传感器元数据、观测和质量控制。",
          "forecast-cycle-provenance-analyst": "追踪精确的预报产品、周期、发布时间、有效时间和预见期溯源。",
          "forecast-verification-evidence-analyst": "构建符合条件的匹配对和由来源定义的验证证据。",
          "meteorological-observation-forecast-assurance-review-owner":
            "在不具备预报、预警、运营或官方服务权限的前提下整合所有证据。",
        },
      },
    },
  },
  "builtin/mining-resource-operations": {
    label: "矿业资源运营",
    description: "将地质、矿山核对、冶金、水与尾矿、车队维护和关键控制证据整合为合格人员审查资料包。",
    selectorSummary: "用于边界明确的矿业证据与运营核对准备。",
    agents: {
      "mineral-data-resource-evidence-analyst": {
        label: "矿产数据与资源证据分析师",
        description: "检验采样、化验 QA/QC、测量、密度、域划分、模型和资源假设证据。",
      },
      "mine-planning-grade-control-reconciliation-analyst": {
        label: "矿山规划、品位控制与核对分析师",
        description: "在兼容的基准上核对计划、品位控制、测量、采矿、堆料和入厂矿记录。",
      },
      "processing-metallurgy-water-tailings-analyst": {
        label: "加工、冶金、水与尾矿分析师",
        description: "检查冶金核算边界、回收率、库存、水量平衡和尾矿依赖。",
      },
      "fleet-maintenance-critical-control-analyst": {
        label: "车队、维护与关键控制分析师",
        description: "区分车队可用率和利用率，同时追踪维护暴露与关键控制验证。",
      },
      "mining-integrated-operations-owner": {
        label: "矿业综合运营负责人",
        description: "将四个证据分支整合为经过版本化、供合格多学科审查的资料包。",
      },
    },
    workflows: {
      "mining-integrated-operations-pack": {
        label: "矿业综合运营资料包",
        description: "四个独立证据分支汇聚为一份合格人员审查资料包。",
        nodes: {
          "mineral-data-resource-evidence-analyst": "检验地质数据、QA/QC 和资源假设。",
          "mine-planning-grade-control-reconciliation-analyst": "核对计划、品位控制、堆料和入料。",
          "processing-metallurgy-water-tailings-analyst": "检验核算、回收、水和尾矿依赖。",
          "fleet-maintenance-critical-control-analyst": "检验车队、维护和关键控制证据。",
          "mining-integrated-operations-owner": "整合所有分支，不掩盖不兼容的基准或未解决的风险。",
        },
      },
    },
  },
  "builtin/nonprofit-grant-operations": {
    label: "非营利组织资助运营",
    description: "将资助方契合度、项目证据、预算、合规和交付准备度整合为可追溯的资助运营资料包。",
    selectorSummary: "用于边界明确的非营利组织资助规划与交付证据工作。",
    agents: {
      "grant-funder-fit-analyst": {
        label: "资助方契合度分析师",
        description: "梳理征集要求、资格证据、评审标准和战略契合度。",
      },
      "grant-program-evidence-analyst": {
        label: "资助项目证据分析师",
        description: "梳理需求、受益人、变革理论、成果、证据和交付可行性。",
      },
      "grant-budget-compliance-analyst": {
        label: "预算与合规分析师",
        description: "梳理成本依据、限制、配套资金假设、报告义务和控制缺口。",
      },
      "grant-delivery-pack-owner": {
        label: "资助交付资料包负责人",
        description: "将各分支整合为可审查的申请书与交付计划。",
      },
    },
    workflows: {
      "grant-delivery-pack": {
        label: "资助交付资料包",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "grant-funder-fit-analyst": "梳理征集要求、资格证据、评审标准和战略契合度。",
          "grant-program-evidence-analyst": "梳理需求、受益人、变革理论、成果、证据和交付可行性。",
          "grant-budget-compliance-analyst": "梳理成本依据、限制、配套资金假设、报告义务和控制缺口。",
          "grant-delivery-pack-owner": "将各分支整合为可审查的申请书与交付计划。",
        },
      },
    },
  },
  "builtin/nuclear-facility-operations-safety": {
    label: "核设施运营安全",
    description: "将配置、设计基准、设施状态、纵深防御、屏障、事件和运行经验证据整合为边界明确的核安全审查资料包。",
    selectorSummary: "用于基于来源的核设施配置与运营安全证据工作，不具备控制、可运行性、可报告性或许可权限。",
    agents: {
      "nuclear-configuration-design-basis-analyst": {
        label: "核设施配置与设计基准分析师",
        description: "核对设计要求、实体配置、设施文件、临时变更和工作记录。",
      },
      "nuclear-defence-in-depth-barrier-analyst": {
        label: "核设施纵深防御与屏障分析师",
        description: "梳理所提供的安全功能、SSC、屏障、控制、依赖、可用性证据和未知项。",
      },
      "nuclear-event-operating-experience-analyst": {
        label: "核事件与运行经验分析师",
        description: "重建事件时间线、受挑战的安全功能、通知、运行经验和行动证据。",
      },
      "nuclear-operations-safety-review-owner": {
        label: "核设施运营安全审查负责人",
        description: "整合三个独立证据分支，并将每项核安全决定交由持证和合格机构处理。",
      },
    },
    workflows: {
      "nuclear-facility-operations-safety-review": {
        label: "核设施运营安全审查",
        description: "三个独立的配置、屏障和事件分支汇聚为边界明确的合格人员审查资料包。",
        nodes: {
          "nuclear-configuration-design-basis-analyst": "核对设计要求、实体配置、受控文件、变更和工作证据。",
          "nuclear-defence-in-depth-barrier-analyst": "梳理所提供的安全功能、SSC、防御层级、屏障、控制、依赖和证据。",
          "nuclear-event-operating-experience-analyst": "重建事件、受挑战的功能、通知、纠正措施和运行经验。",
          "nuclear-operations-safety-review-owner": "整合所有分支，保留矛盾和未知项，并转交持证机构决定。",
        },
      },
    },
  },
  "builtin/office-delivery": {
    label: "Office 交付",
    description: "通过并行的内容与格式规划、显式组装和渲染质量审查，开发有来源支持的 Office 交付物。",
    selectorSummary: "用于需要可追溯内容和视觉验收的可编辑文档、电子表格、演示文稿、PDF 或配套 Office 资料包。",
    agents: {
      "office-source-analyst": {
        label: "Office 来源分析师",
        description: "构建注明日期的来源、主张、计算、引用、术语和缺失输入模型。",
      },
      "office-format-designer": {
        label: "Office 格式设计师",
        description: "定义受众旅程、信息层级、格式结构、视觉语义和渲染检查。",
      },
      "office-delivery-builder": {
        label: "Office 交付构建员",
        description: "将内容模型与格式计划整合为可编辑交付物及其规范导出文件。",
      },
      "office-quality-reviewer": {
        label: "Office 质量审查员",
        description: "审查实际渲染的交付物，检查数据完整性、可追溯性、视觉质量、导航和格式覆盖。",
      },
    },
    workflows: {
      "verified-office-delivery": {
        label: "经验证的 Office 交付",
        description: "并行分析来源和设计格式，在可编辑构建中整合二者，再审查渲染结果。",
        nodes: {
          "office-source-analyst": "发布规范的来源与内容模型。",
          "office-format-designer": "发布受众、结构、视觉和渲染计划。",
          "office-delivery-builder": "根据两项计划发布可编辑交付物和规范导出文件。",
          "office-quality-reviewer": "发布渲染内容与视觉验收报告。",
        },
      },
    },
  },
  "builtin/omnichannel-distribution": {
    label: "全渠道分发",
    description: "开展当前渠道研究、考虑权利的适配、衡量规划、准备度审查，并形成规范的已准备但未发布交付包。",
    selectorSummary: "用于准备并验证渠道专用交付包，但不向外部发布。",
    agents: {
      "distribution-brief-planner": {
        label: "分发简报规划师",
        description: "定义已接受的营销活动来源、目标和约束。",
      },
      "channel-spec-researcher": {
        label: "渠道规范研究员",
        description: "构建注明日期的第一方渠道规范资料集。",
      },
      "rights-compliance-analyst": {
        label: "权利与合规分析师",
        description: "归类主张、披露、权利和审批义务。",
      },
      "channel-adaptation-producer": {
        label: "渠道适配制作员",
        description: "产出完整的渠道专用内容包。",
      },
      "distribution-measurement-planner": {
        label: "分发衡量规划师",
        description: "定义渠道衡量与归因契约。",
      },
      "distribution-plan-synthesizer": {
        label: "分发计划综合分析师",
        description: "将适配与衡量工作整合为一份待执行的分发计划。",
      },
      "distribution-readiness-reviewer": {
        label: "分发准备度审查员",
        description: "独立审查唯一的整合计划前序项。",
      },
      "omnichannel-delivery-owner": {
        label: "全渠道交付负责人",
        description: "发布规范的已准备但未发布交付包。",
      },
    },
    workflows: {
      "omnichannel-delivery-pack": {
        label: "全渠道交付包",
        description:
          "当 Task 提供一项已接受的源营销活动、目标、受众和至少两个指定渠道时使用；准备并验证渠道交付包，但不向外部发布。",
        nodes: {
          "distribution-brief-planner": "发布边界明确的分发简报。",
          "channel-spec-researcher": "发布当前渠道规范。",
          "rights-compliance-analyst": "发布权利与合规分析。",
          "channel-adaptation-producer": "发布渠道专用内容适配。",
          "distribution-measurement-planner": "发布渠道衡量与归因计划。",
          "distribution-plan-synthesizer": "将两个制作分支整合为一份分发计划。",
          "distribution-readiness-reviewer": "独立审查唯一的整合计划前序项。",
          "omnichannel-delivery-owner": "发布规范的已准备但未发布交付包。",
        },
      },
    },
  },
  "builtin/one-person-company-operating-system": {
    label: "一人公司运营系统",
    description:
      "面向业主自营公司的商业级运营证据系统，整合产品与需求、收入与义务、交付容量和自动化治理，但不执行外部操作。",
    selectorSummary: "针对整家业主自营公司运行一次以证据为基础的运营审查。",
    agents: {
      "opc-strategy-offer-demand-analyst": {
        label: "OPC 战略、产品与需求分析师",
        description: "核对公司阶段、客户与渠道证据、产品版本、需求信号、实验和机会成本。",
      },
      "opc-revenue-finance-obligation-analyst": {
        label: "OPC 收入、财务与义务分析师",
        description: "核对受来源约束的收入、付款、退款、应收款、成本、现金和义务证据，但不具备会计或税务权限。",
      },
      "opc-delivery-customer-capacity-analyst": {
        label: "OPC 交付、客户与容量分析师",
        description: "跨业务模式核对履约、客户状态、支持负载、可用容量、承诺和恢复证据。",
      },
      "opc-automation-governance-resilience-analyst": {
        label: "OPC 自动化、治理与韧性分析师",
        description: "审计数据源、批准类别、secret 引用、workflow 幂等性、外部影响、可观测性和连续性证据。",
      },
      "one-person-company-operating-system-review-owner": {
        label: "OPC 运营审查负责人",
        description: "将四个独立运营分支整合为一份受证据约束的决策资料包，同时保留业主和专业审批权。",
      },
    },
    workflows: {
      "one-person-company-operating-review": {
        label: "一人公司运营审查",
        description: "四个独立运营证据分支并发运行，并一次性汇聚为公司级决策资料包。",
        nodes: {
          "opc-strategy-offer-demand-analyst": "产出产品、渠道、需求和实验组合。",
          "opc-revenue-finance-obligation-analyst": "产出已核对的收入、现金、成本和义务证据台账。",
          "opc-delivery-customer-capacity-analyst": "产出交付、客户状态、支持和容量证据。",
          "opc-automation-governance-resilience-analyst": "产出 workflow、批准、secret 引用、可观测性和韧性证据。",
          "one-person-company-operating-system-review-owner": "将四个分支整合为一份按优先级排序、边界明确的运营审查。",
        },
      },
    },
  },
} satisfies PublicSquadZhTranslationMap
