import type { PublicSquadZhTranslationMap } from "./public-market-zh-types"

export const publicMarketZhTranslations01To35 = {
  "builtin/academic-paper-review": {
    label: "学术论文审查",
    description:
      "对手稿进行证据可追溯的审查，覆盖文献、新颖性、逻辑、方法、事实、引文、幻觉风险与呈现方式，并汇总为 revision 指南。",
    selectorSummary: "用于严格、授权的学术稿件和提交准备审查。",
    agents: {
      "paper-review-charter-planner": {
        label: "审查章程规划师",
        description: "冻结手稿版本、授权、投稿场景、证据边界、主张清单和专家审查需求。",
      },
      "paper-literature-landscape-reviewer": {
        label: "文献全景审查员",
        description: "构建可复现的既有研究全景，并检查引文覆盖度与代表性。",
      },
      "paper-novelty-contribution-reviewer": {
        label: "新颖性和贡献评审员",
        description: "将声称的贡献与检查过的先前工作进行比较，并记录可辩护的区别和重叠。",
      },
      "paper-logic-argument-reviewer": {
        label: "逻辑与论证评审员",
        description: "审核前提、推论、矛盾、替代方案、范围、因果关系和结论强度。",
      },
      "paper-methods-facts-reviewer": {
        label: "方法、统计和事实审查员",
        description: "检查研究设计、统计、可复现性、伦理、数值恒等关系和事实一致性。",
      },
      "paper-presentation-reviewer": {
        label: "演示和图形审查员",
        description: "审查叙述忠实度、结构、可读性、表格、图形、图注、不确定性和无障碍性。",
      },
      "paper-citation-hallucination-auditor": {
        label: "引文和幻觉审核员",
        description: "独立验证重大声明和参考文献，同时保留有限搜索的不确定性。",
      },
      "paper-review-integration-editor": {
        label: "审查整合编辑器",
        description: "把各分支汇总进证据登记册，保留分歧，并给出可执行的 revision 顺序。",
      },
    },
    workflows: {
      "academic-paper-review": {
        label: "学术论文评审",
        description:
          "并行启动三个独立证据分支，在文献全景完成后评估新颖性，展开依赖审查章程的完整性检查，并汇总为证据可追溯的审查。",
        nodes: {
          "paper-review-charter-planner": "发布冻结的审查章程和主张清单。",
          "paper-literature-landscape-reviewer": "发布可复现的文献全景。",
          "paper-novelty-contribution-reviewer": "发布贡献和新颖性矩阵。",
          "paper-logic-argument-reviewer": "发布逻辑和论证审核。",
          "paper-methods-facts-reviewer": "发布方法、统计数据、事实和再现性审核。",
          "paper-presentation-reviewer": "发布叙述、表格、图形和无障碍审查。",
          "paper-citation-hallucination-auditor": "发布主张、引文和幻觉台账。",
          "paper-review-integration-editor": "将完整审查证据整合为按优先级排序的 revision 指南。",
        },
      },
    },
  },
  "builtin/actuarial-reserving": {
    label: "精算准备金评估",
    description: "把未付赔款数据、方法、不确定性、验证与治理证据汇总为合格的精算审查。",
    selectorSummary: "用于边界明确的财产与意外险未付赔款准备金证据审查。",
    agents: {
      "reserving-data-triangle-reconciliation-analyst": {
        label: "准备金数据与三角表核对分析师",
        description: "将受控来源记录与增量及累计准备金三角表进行核对。",
      },
      "reserving-method-assumption-diagnostics-analyst": {
        label: "准备金方法、假设与诊断分析师",
        description: "追踪赔付发展、尾部、趋势和预期损失假设，并提供比较诊断。",
      },
      "reserve-uncertainty-validation-analyst": {
        label: "准备金不确定性和验证分析师",
        description: "测试实际与预期、回测、情景、范围和假设敏感证据。",
      },
      "reserve-governance-rollforward-disclosure-analyst": {
        label: "准备金治理、前滚和披露分析师",
        description: "追踪期初至本期的变动、账面准备金与指示准备金的差异，以及治理和披露证据。",
      },
      "actuarial-reserving-evidence-owner": {
        label: "精算准备金证据负责人",
        description: "将四个独立分支合并为一个可审查的证据和未解决的决策登记册。",
      },
    },
    workflows: {
      "actuarial-reserving-review": {
        label: "精算准备金审查",
        description: "四个零依赖的准备金证据分支汇聚为一次明确的合格精算审查。",
        nodes: {
          "reserving-data-triangle-reconciliation-analyst": "核对来源记录与准备金三角表证据。",
          "reserving-method-assumption-diagnostics-analyst": "追踪方法和假设。",
          "reserve-uncertainty-validation-analyst": "检验不确定性和验证证据。",
          "reserve-governance-rollforward-disclosure-analyst": "追踪治理和披露。",
          "actuarial-reserving-evidence-owner": "汇总所有分支，但不选择方法、不确认账面准备金，也不对准备金发表意见。",
        },
      },
    },
  },
  "builtin/advanced": {
    label: "Advanced",
    description: "内置的高级软件交付团队，保留从需求到架构的可追溯性，以及并行调查、实施、测试、界面与独立审查边界。",
    selectorSummary:
      "用于需要从需求到架构可追溯、并行调查与实施证据及独立审查，但没有更窄已安装专家契约的高级软件交付。",
    agents: {
      "request-interpreter": {
        label: "请求解析员",
        description: "澄清意图、缺失的输入、范围边界和操作员决策。",
      },
      "requirement-engineer": {
        label: "需求工程师",
        description: "根据当前证据记录可证伪的要求和基本决策。",
      },
      "solution-architect": {
        label: "解决方案架构师",
        description: "创建可追溯的界面契约、独立 revision 的 Delivery Slice 和组装责任归属。",
      },
      "workload-reviewer": {
        label: "工作负载审核员",
        description: "评估 Delivery Slice 规模、耦合、遗漏工作、验收覆盖和验证成本，但不承担架构决策权。",
      },
      "source-investigator": {
        label: "来源调查员",
        description: "开展以只读为主的代码库调查，并记录有来源依据的证据。",
      },
      "research-investigator": {
        label: "外部研究调查员",
        description: "收集持久的多源外部证据并将事实与推论分开。",
      },
      "interface-investigator": {
        label: "接口调查员",
        description: "捕获界面结构、行为、状态、资产和参考证据。",
      },
      "interface-designer": {
        label: "界面设计师",
        description: "根据批准的证据生成可追溯的界面设计和实施合同。",
      },
      "implementation-engineer": {
        label: "实施工程师",
        description: "实现 Architect 契约并产出代码库、命令和 runtime 证据，但不承担审查责任。",
      },
      "test-engineer": {
        label: "测试工程师",
        description: "独立执行适用的非 UI 测试，并根据实施证据进行 runtime 检查并报告准确结果。",
      },
      "visual-reviewer": {
        label: "视觉审核员",
        description: "审查真实渲染证据、交互状态和视觉验收覆盖。",
      },
      "system-integrity-reviewer": {
        label: "系统完整性审核员",
        description: "实现证明就绪后，对需求、契约、实现和证据开展不可转交的独立系统审查。",
      },
      "interface-integrity-reviewer": {
        label: "接口完整性审核员",
        description: "对已实现的接口行为执行独立的 Task 范围审查并提供证据，而无需交付切片规划图。",
      },
      "claim-verifier": {
        label: "主张核验员",
        description: "根据可追溯的证据验证重大事实主张并报告不确定性。",
      },
    },
    workflows: {
      "planned-delivery": {
        label: "计划交付",
        description:
          "完成计划型非界面交付：并行调查意图、需求与存储库，建立精确的需求至架构衔接，并行开展工作量审查与实施，最后并行测试并独立审查系统。",
        nodes: {
          "request-interpreter": "确认意图、输入和范围，并在不存在任何澄清差距时明确记录。",
          "requirement-engineer": "根据当前证据记录可证伪的要求和基本决策。",
          "source-investigator": "与意图和需求工作并行地调查存储库结构、调用者、测试和所有权边界。",
          "solution-architect":
            "将精确意图、RequirementSet 与代码库证据整合为可追溯契约、不可变 Delivery Slice revision 和组装责任归属。",
          "workload-reviewer": "在没有架构授权的情况下评估切片大小、耦合、省略的工作、验收覆盖率和验证成本。",
          "implementation-engineer": "与工作量审查并行实施确切的架构师合同，并记录具体存储库和验证证据。",
          "test-engineer": "在存在实施证据后，独立执行适用的非 UI 测试和 runtime 检查。",
          "system-integrity-reviewer": "在实施和工作量证据存在后，与测试执行同时进行独立的对抗性审查。",
        },
      },
      "evidence-investigation": {
        label: "证据调查",
        description:
          "当调查本身就是 Task 交付，或阻塞一项不交付决策时，完成存储库和外部调查，再核验事实主张；不要把此图作为交付工作流的辅助阶段，后者的调度器可针对具体证据缺口派遣单个调查员。",
        nodes: {
          "source-investigator": "开展以只读为主的代码库调查，并记录有来源依据的证据。",
          "research-investigator": "收集持久的多源外部证据并将事实与推论分开。",
          "claim-verifier": "根据收集的证据验证重大事实主张并报告不确定性。",
        },
      },
      "greenfield-interface-delivery": {
        label: "全新界面交付",
        description:
          "在没有来源 URL 时交付全新界面：并行调查意图、需求与存储库，建立精确的需求至架构衔接，并行进行界面设计与工作量审查，由实施方检查真实页面，最后并行测试并独立审查界面与系统。",
        nodes: {
          "request-interpreter": "确认新建接口意图、输入和范围，而无需发明源接口依赖项。",
          "requirement-engineer": "登记全新界面中可证伪的产品、数据、交互与视觉要求。",
          "source-investigator": "与意图和需求工作并行地调查目标存储库、设计系统实现表面和所有权边界。",
          "solution-architect":
            "将精确意图、RequirementSet 和代码库证据整合为可追溯界面契约、不可变 Delivery Slice revision 和组装责任归属。",
          "interface-designer": "根据获批需求和架构证据生成原创、可追溯的界面设计与实现契约。",
          "workload-reviewer": "在架构契约存在后，与界面设计并行质疑切片规模、所有权与验证工作量。",
          "implementation-engineer": "设计证据存在后实施已批准的界面契约，同时保留架构师所有权边界。",
          "test-engineer": "在存在实施证据后，独立执行适用的非 UI 测试和 runtime 检查。",
          "interface-integrity-reviewer": "独立审查已实现的界面行为并提供证据。",
          "system-integrity-reviewer": "独立于测试和目视审查来审查需求、合同、实施和工作量证据。",
        },
      },
      "greenfield-interface-visual-delivery": {
        label: "具有独立视觉审查的全新界面交付",
        description:
          "当操作者或代码库明确要求由独立 Visual Reviewer 作出判断时，使用完整的全新界面流程并增加独立渲染审查，交付不依赖源 URL 的新界面。",
        nodes: {
          "request-interpreter": "确认新建接口意图、输入和范围，而无需发明源接口依赖项。",
          "requirement-engineer": "登记全新界面中可证伪的产品、数据、交互和视觉要求。",
          "source-investigator": "与意图和需求工作并行地调查目标存储库、设计系统实现表面和所有权边界。",
          "solution-architect":
            "将精确意图、RequirementSet 和代码库证据整合为可追溯界面契约、不可变 Delivery Slice revision 和组装责任归属。",
          "interface-designer": "根据获批需求和架构证据生成原创、可追溯的界面设计与实现契约。",
          "workload-reviewer": "Architect 契约形成后，与界面设计并行检验 Slice 规模、责任归属和验证工作量。",
          "implementation-engineer": "设计证据形成后实现获批界面契约，并遵守 Architect 的责任边界。",
          "test-engineer": "在存在实施证据后，独立执行适用的非 UI 测试和 runtime 检查。",
          "visual-reviewer": "在测试和独立完整性审查的同时审查真实呈现的实现和交互状态。",
          "interface-integrity-reviewer":
            "独立审查已实现的界面行为和渲染证据，不以 Visual Reviewer 的结论代替自身判断。",
          "system-integrity-reviewer": "独立于测试和目视审查来审查需求、合同、实施和工作量证据。",
        },
      },
      "reference-interface-delivery": {
        label: "提供的参考接口交付",
        description:
          "基于操作者提供的一个界面 URL 交付：并行开展界面观察、意图、需求与存储库调查，建立精确的需求至架构衔接，并行设计和工作量审查后实施，最后并行测试、视觉审查与独立审查。",
        nodes: {
          "interface-investigator": "从操作者提供的一个来源界面 URL 捕获结构、行为、状态、资产与参考证据。",
          "request-interpreter": "与需求和直接界面观察并行地确认意图、输入和范围。",
          "requirement-engineer": "从完整请求中登记可证伪的产品、交互、保真度与验收要求。",
          "source-investigator": "与源接口观察和需求工作并行地调查目标存储库和所有权边界。",
          "solution-architect":
            "将直接观察到的界面、意图、RequirementSet 和代码库证据整合为可追溯契约与不可变 Delivery Slice revision。",
          "interface-designer": "根据所提供的参考和 Architect 证据生成可追溯的界面设计与实现契约。",
          "workload-reviewer": "与界面设计并行质疑切片规模、所有权与视觉验证工作量。",
          "implementation-engineer": "在设计证据存在后实现提供的参考接口契约。",
          "test-engineer": "在存在实施证据后，独立执行适用的非 UI 测试和 runtime 检查。",
          "visual-reviewer": "在测试和独立审查的同时审查真实渲染的结果、交互和参考保真度。",
          "interface-integrity-reviewer":
            "独立审查已实现的界面行为和渲染证据，不以 Visual Reviewer 的结论代替自身判断。",
          "system-integrity-reviewer": "独立于测试和目视审查来审查需求、合同、实施和工作量证据。",
        },
      },
    },
  },
  "builtin/agriculture-food-systems": {
    label: "农业与食品系统",
    description: "将生产背景、资源约束以及市场与生物安全证据整合为边界明确的季节性系统计划。",
    selectorSummary: "用于有证据支持的农业和粮食系统规划。",
    agents: {
      "agriculture-production-context-analyst": {
        label: "生产环境分析师",
        description: "梳理作物、畜牧、气候、土壤、水资源和季节性证据。",
      },
      "agriculture-resource-input-analyst": {
        label: "资源和投入分析师",
        description: "绘制劳动力、设备、投入、水、存储和可追溯性限制。",
      },
      "agriculture-market-biosecurity-analyst": {
        label: "市场和生物安全分析师",
        description: "绘制需求、物流、食品安全、生物安全和市场风险图。",
      },
      "food-system-plan-owner": {
        label: "食品系统计划负责人",
        description: "将各分支整合为边界明确的季节与食品系统计划。",
      },
    },
    workflows: {
      "season-food-system-plan": {
        label: "季节与食品系统计划",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "agriculture-production-context-analyst": "梳理作物、畜牧、气候、土壤、水资源和季节性证据。",
          "agriculture-resource-input-analyst": "绘制劳动力、设备、投入、水、存储和可追溯性限制。",
          "agriculture-market-biosecurity-analyst": "绘制需求、物流、食品安全、生物安全和市场风险图。",
          "food-system-plan-owner": "将各分支整合为边界明确的季节与食品系统计划。",
        },
      },
    },
  },
  "builtin/ai-model-governance-evaluation": {
    label: "AI 模型治理与评估",
    description: "将用例风险、溯源、评估和独立可信度证据整合为责任明确的 AI 治理资料包。",
    selectorSummary: "用于边界明确的 AI 模型治理与评估证据工作。",
    agents: {
      "ai-use-case-risk-governance-analyst": {
        label: "AI 用例风险和治理分析师",
        description: "绘制预期用途、受影响群体、风险分类、控制、负责人和决策权限。",
      },
      "model-data-provenance-documentation-analyst": {
        label: "模型和数据来源分析师",
        description: "对模型、数据集、prompt、工具、配置、限制和文档证据进行版本化。",
      },
      "ai-evaluation-design-results-analyst": {
        label: "AI 评估设计和结果分析",
        description: "设计声明绑定协议并检查行级、切片、聚合和再现性证据。",
      },
      "ai-independent-trustworthiness-reviewer": {
        label: "独立 AI 可信度审核员",
        description: "挑战鲁棒性、偏见、隐私、安全、人类监督和评估有效性主张。",
      },
      "ai-model-governance-evaluation-owner": {
        label: "AI 模型治理和评估负责人",
        description: "将四个分支整合为主张、风险、证据和决策登记册。",
      },
    },
    workflows: {
      "ai-model-governance-evaluation-review": {
        label: "AI 模型治理和评估审查",
        description: "四个独立 AI 证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "ai-use-case-risk-governance-analyst": "绘制用例风险和治理图。",
          "model-data-provenance-documentation-analyst": "梳理模型与数据溯源。",
          "ai-evaluation-design-results-analyst": "绘制评估协议和结果。",
          "ai-independent-trustworthiness-reviewer": "挑战可信证据。",
          "ai-model-governance-evaluation-owner": "整合所有根分支，但不接受风险，也不部署模型。",
        },
      },
    },
  },
  "builtin/air-traffic-management-safety": {
    label: "空中交通管理安全",
    description: "整合空域配置、需求与容量、危险与控制及保证证据，供合格人员开展 ATM 安全审查。",
    selectorSummary: "用于非运营空中交通管理安全证据。",
    agents: {
      "airspace-facility-procedure-configuration-analyst": {
        label: "空域、设施和程序配置分析师",
        description: "核对注明日期的空域、设施、程序和系统配置证据。",
      },
      "traffic-demand-capacity-performance-analyst": {
        label: "流量需求、容量和性能分析师",
        description: "检验所提供的流量、容量和性能定义及度量。",
      },
      "air-traffic-hazard-risk-control-analyst": {
        label: "空中交通危险、风险和控制分析师",
        description: "根据提供的安全证据建立危险后果控制的可追溯性。",
      },
      "occurrence-change-safety-assurance-analyst": {
        label: "发生、变化和安全保证分析师",
        description: "审查事件、指标、变化和控制有效性证据。",
      },
      "air-traffic-management-safety-review-owner": {
        label: "空中交通管理安全审查负责人",
        description: "整合 ATM 配置、性能、危险和保证证据，但不具备运营权限。",
      },
    },
    workflows: {
      "air-traffic-management-safety-review": {
        label: "空中交通管理安全审查",
        description: "四个独立的专业证据部门汇聚为空中交通管理安全审查负责人。",
        nodes: {
          "airspace-facility-procedure-configuration-analyst": "核对注明日期的空域、设施、程序和系统配置证据。",
          "traffic-demand-capacity-performance-analyst": "检验所提供的流量、容量和性能定义及度量。",
          "air-traffic-hazard-risk-control-analyst": "根据提供的安全证据建立危险后果控制的可追溯性。",
          "occurrence-change-safety-assurance-analyst": "审查事件、指标、变化和控制有效性证据。",
          "air-traffic-management-safety-review-owner": "整合 ATM 配置、性能、危险和保证证据，但不具备运营权限。",
        },
      },
    },
  },
  "builtin/anti-money-laundering-compliance": {
    label: "反洗钱合规",
    description: "整合机构专属 AML 计划、客户风险、监控、警报与案件及独立测试证据，供合格人员审查。",
    selectorSummary: "用于边界明确的 AML/CFT 合规证据工作。",
    agents: {
      "aml-program-risk-assessment-control-analyst": {
        label: "AML 项目风险评估与控制分析师",
        description: "绘制机构特定的适用性、企业风险、治理和控制证据。",
      },
      "customer-beneficial-owner-risk-review-analyst": {
        label: "客户和受益所有人风险审查分析师",
        description: "追踪授权 CDD、受益所有人、关系和持续风险审查证据。",
      },
      "transaction-monitoring-alert-case-analyst": {
        label: "交易监控、警报和案例分析",
        description: "核对来源总体、监控版本、警报、案件、事实和人工处置结果。",
      },
      "aml-quality-testing-governance-analyst": {
        label: "AML 质量、独立测试和治理分析师",
        description: "检查监控质量、假阳性/阴性证据、积压、覆盖、培训和独立测试。",
      },
      "anti-money-laundering-compliance-review-owner": {
        label: "反洗钱合规审查负责人",
        description: "整合计划、客户、监控和测试证据，供合格人员开展 AML 审查。",
      },
    },
    workflows: {
      "anti-money-laundering-compliance-review": {
        label: "反洗钱合规审查",
        description: "四个独立的合规证据分支汇聚成一个明确的审查负责人。",
        nodes: {
          "aml-program-risk-assessment-control-analyst": "绘制机构特定的适用性、企业风险、治理和控制证据。",
          "customer-beneficial-owner-risk-review-analyst": "追踪授权 CDD、受益所有人、关系和持续风险审查证据。",
          "transaction-monitoring-alert-case-analyst": "核对来源总体、监控版本、警报、案件、事实和人工处置结果。",
          "aml-quality-testing-governance-analyst": "检查监控质量、假阳性/阴性证据、积压、覆盖、培训和独立测试。",
          "anti-money-laundering-compliance-review-owner": "整合计划、客户、监控和测试证据，供合格人员开展 AML 审查。",
        },
      },
    },
  },
  "builtin/automotive-functional-safety": {
    label: "汽车功能安全",
    description: "将 Item、HARA、安全要求、故障分析、验证和生命周期证据整合为供合格人员审查的功能安全论证资料包。",
    selectorSummary: "用于边界明确的道路车辆 E/E 功能安全证据工作。",
    agents: {
      "item-definition-hara-evidence-analyst": {
        label: "项目定义和 HARA 证据分析",
        description: "跟踪项目边界、情况、危险事件、分类和提供的安全目标。",
      },
      "safety-concept-requirement-trace-analyst": {
        label: "安全概念和需求追踪分析师",
        description: "通过功能、技术、系统、硬件和软件要求和测试来跟踪安全目标。",
      },
      "hardware-software-safety-analysis-verification-analyst": {
        label: "硬件、软件和验证分析师",
        description: "审查所提供的故障分析、指标、相关失效、验证与确认（V&V）证据。",
      },
      "functional-safety-lifecycle-assurance-analyst": {
        label: "功能安全生命周期保证分析师",
        description: "跟踪计划、责任接口、配置、变更、异常、资格和确认证据。",
      },
      "automotive-functional-safety-case-owner": {
        label: "汽车功能安全案例负责人",
        description: "将四个分支整合为主张、证据与缺口登记册，供合格人员评估。",
      },
    },
    workflows: {
      "automotive-functional-safety-case-review": {
        label: "汽车功能安全案例回顾",
        description: "四个独立的功能安全分支汇聚成一个合格的审查包。",
        nodes: {
          "item-definition-hara-evidence-analyst": "追踪 Item 与 HARA 证据。",
          "safety-concept-requirement-trace-analyst": "追踪安全概念和要求。",
          "hardware-software-safety-analysis-verification-analyst": "追踪故障分析和 V&V 证据。",
          "functional-safety-lifecycle-assurance-analyst": "追踪生命周期保证证据。",
          "automotive-functional-safety-case-owner": "整合所有分支，但不作安全批准或放行决定。",
        },
      },
    },
  },
  "builtin/aviation-maintenance-reliability": {
    label: "航空维修可靠性",
    description: "将飞机配置、维修可靠性和规划证据整合为经授权的适航审查资料包，但不具备维修或放行权限。",
    selectorSummary: "用于边界明确的飞机维修可靠性证据与规划审查。",
    agents: {
      "aircraft-configuration-records-analyst": {
        label: "飞机配置和记录分析师",
        description: "核对按序列号管理的飞机配置、寿命限制、维修记录和所提供的适用性证据。",
      },
      "maintenance-reliability-analyst": {
        label: "维护可靠性分析师",
        description: "分析暴露标准化维护事件、重复、移除和分层可靠性证据。",
      },
      "maintenance-planning-airworthiness-analyst": {
        label: "维护计划和适航分析师",
        description: "跟踪到期工作、批准的计划修订、延期、依赖性和授权审查需求。",
      },
      "aviation-maintenance-reliability-owner": {
        label: "航空维修可靠性负责人",
        description: "将配置、可靠性和规划证据整合为供合格人员审查的决策资料包。",
      },
    },
    workflows: {
      "aviation-maintenance-reliability-review": {
        label: "航空维修可靠性审查",
        description: "三个独立的飞机证据分支汇聚成一个授权审查包。",
        nodes: {
          "aircraft-configuration-records-analyst": "核对配置、寿命限制、记录和适用性。",
          "maintenance-reliability-analyst": "分析暴露标准化的可靠性证据。",
          "maintenance-planning-airworthiness-analyst": "跟踪应有的工作和合格的适航审查需求。",
          "aviation-maintenance-reliability-owner": "整合三个分支，但不作适航或放行决定。",
        },
      },
    },
  },
  "builtin/base": {
    label: "Base",
    description:
      "Base 是 Advanced 中便捷的复合 Expert Squad，面向非 Goal 交付：研究员、规划师、开发工程师和测试工程师构成精简路径，包自带的完整性与视觉审查员可通过固定的验证交付 workflow 使用。",
    selectorSummary:
      "使用 Advanced 的便捷复合版本 Base，通过研究、规划、实现、测试以及选定的验证审查闭环，完成一项完整的非 Goal Task 交付。",
    agents: {
      "base-researcher": {
        label: "Base 研究员",
        description: "开展以只读为主的代码库调查和相关外部研究，并发布规范的 Base 研究报告。",
      },
      "base-planner": {
        label: "Base 规划师",
        description: "审查规范研究报告并发布一份完整的 Task 实施计划，而无需编辑产品文件或创建源自 Goal 的计划事实。",
      },
      "base-developer": {
        label: "Base 开发工程师",
        description: "采用选定的 Base 实施计划修改代码库，执行由实现方负责的检查，并发布开发报告。",
      },
      "base-tester": {
        label: "Base 测试工程师",
        description: "依据研究、计划、开发报告、最终 diff、可执行检查和渲染证据独立测试实现，并发布规范的测试报告。",
      },
      "base-integrity-reviewer": {
        label: "Base 完整性审查员",
        description: "独立审查所选上游 Artifacts 的完整基础交付、实施行为、测试、runtime 证据和未解决的风险。",
      },
      "base-visual-reviewer": {
        label: "Base 视觉审查员",
        description: "独立审查真实渲染的交付、交互状态和视觉验收证据，不以源代码或自动化 UI 断言替代真实页面证据。",
      },
    },
    workflows: {
      "composite-delivery": {
        label: "复合交付",
        description:
          "一条 Task 范围的类型研究、规划、实施和测试链，无需 RequirementSet、ContractGraph、Goal 或交付切片规划。",
        nodes: {
          "base-researcher": "研究具体任务并发布规范的 Base 研究报告。",
          "base-planner": "读取并选用 Base 研究报告，发布规范的非 Goal 实施计划。",
          "base-developer": "读取并选用 Base 计划，实现完整的 Task 交付，运行由实现方负责的检查，并发布开发报告。",
          "base-tester": "读取并选用完整的 Base 交接材料，独立验证交付并发布规范的测试报告。",
        },
      },
      "integrity-verified-delivery": {
        label: "完整性验证交付",
        description: "运行精简的非 Goal 交付链，再依据由测试证据支撑的完整交接材料开展独立的系统级完整性审查。",
        nodes: {
          "base-researcher": "研究具体任务并发布规范的 Base 研究报告。",
          "base-planner": "读取并选用 Base 研究报告，发布规范的非 Goal 实施计划。",
          "base-developer": "读取并选用 Base 计划，实现完整的 Task 交付，运行由实现方负责的检查，并发布开发报告。",
          "base-tester": "读取并选用完整的 Base 交接材料，独立验证交付并发布规范的测试报告。",
          "base-integrity-reviewer":
            "根据完整的研究、计划、开发、测试、差异、命令和 runtime 证据执行独立的系统级完整性审查。",
        },
      },
      "visual-verified-delivery": {
        label: "视觉验证交付",
        description:
          "运行精简的非 Goal 交付链，并行测试和视觉审查真实渲染的实现，再综合两个证据分支开展独立完整性审查。",
        nodes: {
          "base-researcher": "研究具体任务并发布规范的 Base 研究报告。",
          "base-planner": "读取并选用 Base 研究报告，发布规范的非 Goal 实施计划。",
          "base-developer": "读取并选用 Base 计划，实现完整的 Task 交付，运行由实现方负责的检查，并发布开发报告。",
          "base-tester": "读取并选用完整的 Base 交接材料，独立验证交付并发布规范的测试报告。",
          "base-visual-reviewer": "实际操作并审查真实渲染的实现、交互状态、诊断结果和新鲜视觉证据。",
          "base-integrity-reviewer": "在测试和真实呈现的视觉证据完成后，执行独立的系统级完整性审查。",
        },
      },
    },
  },
  "builtin/battery-safety-reliability": {
    label: "电池安全与可靠性",
    description: "整合电芯、模块、电池包、运行包络、滥用试验、热失控、蔓延、屏障、故障和可靠性证据，供合格人员审查。",
    selectorSummary:
      "用于边界明确的电池安全与可靠性证据工作，不具备带电试验、BMS、受损电池处置、应急、运输、认证或放行权限。",
    agents: {
      "battery-configuration-operating-envelope-analyst": {
        label: "电池配置和工作范围分析",
        description: "核对电芯、模块和电池包谱系、BMS 与保护版本、预期用途和受控运行包络证据。",
      },
      "battery-abuse-thermal-runaway-evidence-analyst": {
        label: "电池滥用和热失控证据分析师",
        description: "重建授权的历史滥用测试条件、仪器、热事件、传播和屏障观察。",
      },
      "battery-reliability-failure-data-analyst": {
        label: "电池可靠性和故障-数据分析师",
        description: "在开展边界明确的可靠性计算与不确定性审查前，定义可比总体、暴露量、故障和删失数据。",
      },
      "battery-safety-reliability-review-owner": {
        label: "电池安全可靠性审查负责人",
        description: "整合配置、滥用与热事件及可靠性分支，同时保留具体应用领域的专业决定权。",
      },
    },
    workflows: {
      "battery-safety-reliability-review": {
        label: "电池安全可靠性审查",
        description: "三个独立的配置、滥用/热和故障可靠性分支汇聚成一个有界审查包。",
        nodes: {
          "battery-configuration-operating-envelope-analyst": "核对电池谱系、保护配置、应用和受控运行包络证据。",
          "battery-abuse-thermal-runaway-evidence-analyst": "重建已经授权的历史测试条件、测量、热事件和传播证据。",
          "battery-reliability-failure-data-analyst": "构建可比总体、暴露量、故障与删失数据及边界明确的可靠性证据。",
          "battery-safety-reliability-review-owner":
            "整合所有分支并保留不确定性，将安全、试验、运输、认证和放行决定交由有权人员处理。",
        },
      },
    },
  },
  "builtin/biopharmaceutical-manufacturing-quality": {
    label: "生物制药生产质量",
    description:
      "将 GMP 批次、材料与设备谱系、偏差、CAPA、工艺验证、持续验证和数据完整性证据整合为边界明确的质量审查资料包。",
    selectorSummary: "用于基于来源的生物制药 GMP 制造质量证据，无批次、偏差、CAPA、验证、发布或合规授权。",
    agents: {
      "biopharma-batch-record-genealogy-analyst": {
        label: "生物制药批次记录和谱系分析师",
        description: "核对主批记录与已执行批记录、物料、批次、设备、人员条目、收率、状态和审计轨迹。",
      },
      "biopharma-deviation-capa-analyst": {
        label: "生物制药偏差和 CAPA 分析师",
        description: "构建偏差年表、影响范围、有证据支持的原因假设、CAPA 行动和有效性证据。",
      },
      "biopharma-process-validation-analyst": {
        label: "生物制药工艺验证分析师",
        description: "跟踪生命周期验证、CQA/CPP/控制策略、资格、抽样、统计和持续验证证据。",
      },
      "biopharma-manufacturing-quality-review-owner": {
        label: "生物制药制造质量审查负责人",
        description: "整合批次、偏差与 CAPA 及验证证据，同时保留质量部门和批次放行权限。",
      },
    },
    workflows: {
      "biopharma-manufacturing-quality-review": {
        label: "生物制药生产质量审查",
        description: "三个独立批次、偏差/CAPA 和验证分支汇聚到一个有界 GMP 审查包中。",
        nodes: {
          "biopharma-batch-record-genealogy-analyst": "核对批次执行、物料与设备谱系、收率、状态、签名和审计轨迹。",
          "biopharma-deviation-capa-analyst": "建立偏差、调查、影响、CAPA、实施和有效性证据。",
          "biopharma-process-validation-analyst": "跟踪工艺设计、鉴定、控制策略、抽样、统计和持续验证。",
          "biopharma-manufacturing-quality-review-owner":
            "整合所有分支并保留矛盾，将质量部门和放行决定交由有权人员处理。",
        },
      },
    },
  },
  "builtin/bridge-structural-integrity-assurance": {
    label: "桥梁结构完整性保证",
    description:
      "对桥梁资产配置、构件检查、缺陷、荷载评级、冲刷、疲劳、维护行动和独立 QC/QA 证据提供保证，但不具备发布限载要求、封闭桥梁或工程放行权限。",
    selectorSummary: "用于准备受控的桥梁检查与结构完整性证据，供合格的业主方审查。",
    agents: {
      "bridge-asset-configuration-authority-analyst": {
        label: "桥梁资产配置与权限分析师",
        description: "固化桥梁、跨径和构件身份、记录、改造、检查计划及专业权限。",
      },
      "bridge-inspection-condition-defect-analyst": {
        label: "桥梁检查、状况与缺陷分析师",
        description: "将材料与构件观测对应到可复现的位置、尺寸、证据和限制条件。",
      },
      "bridge-load-rating-scour-fatigue-analyst": {
        label: "桥梁荷载评级、冲刷与疲劳分析师",
        description: "追踪所提供的分析模型、荷载、冲刷、疲劳与断裂及控制性证据，但不作工程决定。",
      },
      "bridge-maintenance-action-qcqa-analyst": {
        label: "桥梁维护行动与 QC/QA 分析师",
        description: "追踪发现项、业主行动、所提供的限制措施、维修证据、验证和独立 QC/QA。",
      },
      "bridge-structural-integrity-review-owner": {
        label: "桥梁结构完整性审查负责人",
        description: "将资产、检查、分析以及行动与 QC/QA 证据整合为供合格桥梁业主审查的资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "桥梁结构完整性保证合格审查",
        description: "各独立专业证据分支汇聚为一次受控的桥梁结构完整性保证审查。",
        nodes: {
          "bridge-asset-configuration-authority-analyst": "固化桥梁、跨径和构件身份、记录、改造、检查计划及专业权限。",
          "bridge-inspection-condition-defect-analyst": "将材料与构件观测对应到可复现的位置、尺寸、证据和限制条件。",
          "bridge-load-rating-scour-fatigue-analyst":
            "追踪所提供的分析模型、荷载、冲刷、疲劳与断裂及控制性证据，但不作工程决定。",
          "bridge-maintenance-action-qcqa-analyst":
            "追踪发现项、业主行动、所提供的限制措施、维修证据、验证和独立 QC/QA。",
          "bridge-structural-integrity-review-owner":
            "将资产、检查、分析以及行动与 QC/QA 证据整合为供合格桥梁业主审查的资料包。",
        },
      },
    },
  },
  "builtin/browser-research-acceptance": {
    label: "浏览器研究与验收",
    description: "规划边界明确的浏览器研究，采集真实页面证据，并行审计交互行为，再将两个分支整合为明确的验收结论。",
    selectorSummary: "当结果取决于当前渲染页面、可观察的浏览器交互和有证据支持的验收时使用。",
    agents: {
      "browser-research-planner": {
        label: "浏览器研究规划器",
        description: "定义可观察的目标、页面边界、证据矩阵、交互场景和停止条件。",
      },
      "browser-evidence-observer": {
        label: "浏览器证据观察者",
        description: "依据研究矩阵检查真实页面，并记录注明日期的主张、可见状态、来源定位信息和截图。",
      },
      "browser-interaction-auditor": {
        label: "浏览器交互审核器",
        description: "实际执行声明的交互场景，并记录可见结果、状态转换和未解决阻塞项。",
      },
      "browser-acceptance-reviewer": {
        label: "浏览器验收审核员",
        description: "将研究和交互证据结合到标准级别的通过、失败、阻止或未经验证的决策中。",
      },
    },
    workflows: {
      "browser-evidence-acceptance": {
        label: "浏览器证据接受",
        description: "一次性完成规划，并行检查内容与交互，再将两个证据分支整合为验收结论。",
        nodes: {
          "browser-research-planner": "发布可观察的目标、证据矩阵、场景和停止条件。",
          "browser-evidence-observer": "发布真实页面内容和视觉证据档案。",
          "browser-interaction-auditor": "发布交互结果和可见状态审计。",
          "browser-acceptance-reviewer": "发布联合标准级验收报告。",
        },
      },
    },
  },
  "builtin/chemical-process-safety": {
    label: "化工过程安全",
    description:
      "将过程信息、危险情景、机械完整性与变更准备度以及事件与屏障证据整合为供合格人员使用的过程安全审查资料包。",
    selectorSummary: "用于边界明确的灾难性化工过程危险证据工作。",
    agents: {
      "process-safety-information-boundary-analyst": {
        label: "过程安全信息和边界分析",
        description: "对边界明确的流程所涉及的化学品、技术、设备和设计基准证据进行版本化。",
      },
      "pha-hazop-lopa-scenario-analyst": {
        label: "PHA、HAZOP 和 LOPA 场景分析师",
        description: "追踪偏差、原因、后果、保障措施和提供的保护层假设。",
      },
      "mechanical-integrity-moc-readiness-analyst": {
        label: "机械完整性和变革准备分析师",
        description: "跟踪检查、测试、延期、MOC 影响、培训和 PSSR 先决条件。",
      },
      "incident-barrier-learning-analyst": {
        label: "事件和障碍学习分析师",
        description: "将事故与险情关联到屏障证据、原因、建议和重新验证。",
      },
      "process-safety-evidence-owner": {
        label: "过程安全证据负责人",
        description: "将四个分支整合为供合格人员审查的决策登记册，但不接受风险。",
      },
    },
    workflows: {
      "chemical-process-safety-review": {
        label: "化学工艺安全审查",
        description: "四个独立的证据分支汇聚成一个合格的过程安全包。",
        nodes: {
          "process-safety-information-boundary-analyst": "对 PSI 和边界证据进行版本化。",
          "pha-hazop-lopa-scenario-analyst": "跟踪危险场景和提供的层假设。",
          "mechanical-integrity-moc-readiness-analyst": "追踪完整性、变革和启动准备情况的证据。",
          "incident-barrier-learning-analyst": "跟踪事件和障碍学习。",
          "process-safety-evidence-owner": "整合四个分支，但不接受风险，也不授权行动。",
        },
      },
    },
  },
  "builtin/climate-risk-adaptation": {
    label: "气候风险适应",
    description:
      "将气候危害、暴露与脆弱性及适应路径证据整合为明确标注情景的审查资料包，但不具备工程、精算、法律或资本决策权。",
    selectorSummary: "用于边界明确的气候风险证据与适应路径审查。",
    agents: {
      "climate-hazard-scenario-analyst": {
        label: "气候灾害和情景分析师",
        description: "追踪物理和过渡危害的来源版本、场景、视野、模型、基线和不确定性。",
      },
      "exposure-vulnerability-consequence-analyst": {
        label: "暴露、脆弱性与后果分析师",
        description: "绘制资产、人口、服务、依赖性、敏感性、适应能力、公平性和后果证据。",
      },
      "adaptation-options-pathways-analyst": {
        label: "适应选项和路径分析师",
        description: "整理适应选项、依赖、前置时间、触发条件、剩余风险、协同效益和适应失当证据。",
      },
      "climate-risk-adaptation-owner": {
        label: "气候风险适应负责人",
        description: "将情景、暴露与脆弱性及路径证据整合为供合格人员使用的决策资料包。",
      },
    },
    workflows: {
      "climate-risk-adaptation-review": {
        label: "气候风险适应审查",
        description: "三个独立的气候风险分支汇聚成一个情景明确的适应审查包。",
        nodes: {
          "climate-hazard-scenario-analyst": "追踪危险、情景、视野、模型、基线和不确定性。",
          "exposure-vulnerability-consequence-analyst": "梳理暴露、脆弱性、后果、依赖和公平性证据。",
          "adaptation-options-pathways-analyst": "整理选项、路径、触发条件、协同效益、剩余风险和适应失当。",
          "climate-risk-adaptation-owner": "整合三个证据分支，但不作工程、精算、法律、披露或资本决策。",
        },
      },
    },
  },
  "builtin/clinical-genomics-variant-evidence-review": {
    label: "临床基因组变异证据审查",
    description:
      "开展按来源版本管理的临床基因组变异证据审查，覆盖病例身份、群体与计算证据、功能与家系共分离证据以及分类溯源，但不具备诊断或变异分类决定权。",
    selectorSummary: "用于由合格人员开展、受来源约束的临床序列变异证据及未解决冲突审查。",
    agents: {
      "genomic-case-build-identity-analyst": {
        label: "基因组病例与版本身份分析师",
        description: "固化病例、样本、表型、基因与疾病关系、基因组版本、转录本和标准化变异身份。",
      },
      "population-computational-evidence-analyst": {
        label: "群体与计算证据分析师",
        description: "构建经过版本化的群体频率和计算证据观测，但不作临床解释。",
      },
      "functional-segregation-evidence-analyst": {
        label: "功能与家系共分离证据分析师",
        description: "追踪检测、病例、家系共分离、de novo、等位基因和表型证据，并标明独立性与质量限制。",
      },
      "variant-classification-provenance-analyst": {
        label: "变异分类溯源分析师",
        description: "将现有标准与分类对应到受控规范、证据 ID、日期和冲突问题。",
      },
      "clinical-genomics-variant-evidence-review-owner": {
        label: "临床基因组变异证据审查负责人",
        description: "将身份、群体与计算、功能与家系共分离以及标准溯源分支整合为合格人员审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "临床基因组变异证据合格审查",
        description: "各独立专业证据分支汇聚为一次受控的临床基因组变异证据审查。",
        nodes: {
          "genomic-case-build-identity-analyst":
            "固化病例、样本、表型、基因与疾病关系、基因组版本、转录本和标准化变异身份。",
          "population-computational-evidence-analyst": "构建经过版本化的群体频率和计算证据观测，但不作临床解释。",
          "functional-segregation-evidence-analyst":
            "追踪检测、病例、家系共分离、de novo、等位基因和表型证据，并标明独立性与质量限制。",
          "variant-classification-provenance-analyst": "将现有标准与分类对应到受控规范、证据 ID、日期和冲突问题。",
          "clinical-genomics-variant-evidence-review-owner":
            "将身份、群体与计算、功能与家系共分离以及标准溯源分支整合为合格人员审查资料包。",
        },
      },
    },
  },
  "builtin/clinical-trial-operations": {
    label: "临床试验运营",
    description:
      "将研究中心准备度、受试者流程与试验执行、数据质量与监查，以及安全、TMF 与结项证据整合为边界明确的临床试验运营审查。",
    selectorSummary: "用于在没有参与者、医疗、监管或发布权限的情况下进行以证据为主导的临床试验操作审查。",
    agents: {
      "trial-startup-site-readiness-analyst": {
        label: "试验启动和现场准备分析师",
        description: "梳理按方案版本管理的批准、必备文件、角色、培训、授权、设施、系统和启动依赖。",
      },
      "trial-enrollment-conduct-analyst": {
        label: "注册和试验行为分析师",
        description: "按照所提供的试验方案核对筛选、入组、访视、退出和偏差事实，但不替受试者作决定。",
      },
      "trial-data-quality-monitoring-analyst": {
        label: "数据质量和监控分析师",
        description: "梳理关键质量风险、数据缺失、质疑老化、核对和基于风险的监查证据。",
      },
      "trial-safety-tmf-closeout-analyst": {
        label: "安全、TMF 和收尾分析师",
        description: "检查安全信息流转与核对证据，以及试验主文件和结项完整性，但不作裁定或认证。",
      },
      "clinical-trial-operations-review-owner": {
        label: "临床试验操作审查负责人",
        description: "将四个独立运营分支整合为责任明确的问题、升级和审批资料包。",
      },
    },
    workflows: {
      "clinical-trial-operations-review": {
        label: "临床试验操作审查",
        description: "四个独立试验运营证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "trial-startup-site-readiness-analyst": "梳理批准、必备文件、角色、培训、授权、设施、系统和启动依赖。",
          "trial-enrollment-conduct-analyst": "核对受试者流程分母、访视窗口事实、退出和偏差证据。",
          "trial-data-quality-monitoring-analyst": "梳理关键质量风险、质疑、数据缺失、核对和监查证据。",
          "trial-safety-tmf-closeout-analyst": "梳理安全信息流转与核对，以及 TMF 与结项完整性证据。",
          "clinical-trial-operations-review-owner":
            "将所有分支整合为经过版本化的问题、依赖、升级事项和合格人员批准门槛。",
        },
      },
    },
  },
  "builtin/cloud-finops-cost-governance": {
    label: "云 FinOps 成本治理",
    description:
      "将云成本、使用量、计费质量、分摊、单位经济性、预测、承诺、优化、异常、治理和价值证据整合为边界明确的 FinOps 审查资料包。",
    selectorSummary: "用于基于来源的技术成本和使用治理证据，无需购买承诺、更改资源、预订条目或设置预算。",
    agents: {
      "finops-cost-usage-billing-quality-analyst": {
        label: "FinOps 成本使用和计费质量分析师",
        description: "核对技术成本、使用量、计费、币种、schema、发票和来源质量证据。",
      },
      "finops-allocation-unit-economics-analyst": {
        label: "FinOps 分配和单位经济分析师",
        description: "构建可追踪的直接、共享和未分配的成本证据以及版本化的单位经济学计算。",
      },
      "finops-forecast-commitment-optimization-analyst": {
        label: "FinOps 预测承诺和优化分析师",
        description: "比较基于来源的预算、预测、承诺、利用率和优化证据，无需进行交易或更改。",
      },
      "finops-anomaly-governance-value-analyst": {
        label: "FinOps 异常治理和价值分析师",
        description: "重建成本异常、控制所有权、例外、价值链接和结果不确定性。",
      },
      "cloud-finops-cost-governance-review-owner": {
        label: "云 FinOps 成本治理审核负责人",
        description: "整合计费、分摊、预测、承诺、异常、治理和价值证据，同时保留人工决策门槛。",
      },
    },
    workflows: {
      "cloud-finops-cost-governance-review": {
        label: "云 FinOps 成本治理审核",
        description: "四个独立的技术成本证据分支汇聚成一个有界的 FinOps 合格审查包。",
        nodes: {
          "finops-cost-usage-billing-quality-analyst": "核对成本、使用量、计费、币种、发票和来源质量证据。",
          "finops-allocation-unit-economics-analyst": "使用公式、分母和未知数构建分配和单位经济学证据。",
          "finops-forecast-commitment-optimization-analyst": "无需购买或部署即可构建预测、承诺和优化候选证据。",
          "finops-anomaly-governance-value-analyst": "重建异常、治理控制、例外和价值证据。",
          "cloud-finops-cost-governance-review-owner": "整合四个分支并保留冲突，将每项决定或行动交由获授权人员处理。",
        },
      },
    },
  },
  "builtin/cloud-platform-architecture": {
    label: "云平台架构",
    description: "提供商中立的云工作负载、可靠性和成本/运营分析已纳入架构决策包。",
    selectorSummary: "用于有证据支持的云或混合平台架构决策。",
    agents: {
      "cloud-workload-requirements-analyst": {
        label: "工作负载需求分析师",
        description: "定义工作负载边界、目标、约束和假设。",
      },
      "cloud-reliability-analyst": {
        label: "云可靠性分析师",
        description: "评估故障域、恢复、状态和弹性证据。",
      },
      "cloud-cost-operations-analyst": {
        label: "云成本和运营分析师",
        description: "绘制成本驱动因素、运营所有权和支持限制。",
      },
      "cloud-architecture-decision-owner": {
        label: "云架构决策负责人",
        description: "将需求、可靠性和运营证据整合为一份决策记录。",
      },
    },
    workflows: {
      "cloud-architecture-decision-pack": {
        label: "云架构决策包",
        description: "三个独立架构分支汇聚为一份责任明确的决策记录。",
        nodes: {
          "cloud-workload-requirements-analyst": "定义可衡量的工作负载要求。",
          "cloud-reliability-analyst": "分析故障和恢复行为。",
          "cloud-cost-operations-analyst": "分析成本和运营所有权。",
          "cloud-architecture-decision-owner": "将所有分支整合为架构决策资料包。",
        },
      },
    },
  },
  "builtin/commercial-legal": {
    label: "商事法务",
    description:
      "开展受司法辖区和日期约束的商事事项规划、法律依据研究、并行合同与监管分析、法务策略、独立复核和规范报告。",
    selectorSummary: "用于需要现行法律依据和可供决策报告的边界明确的商事合同、交易、谈判或监管风险审查。",
    agents: {
      "commercial-legal-matter-planner": {
        label: "商事法务事项规划师",
        description: "定义具体法务事项、客户立场、司法辖区、文件、问题、来源政策和验收边界。",
      },
      "commercial-legal-authority-researcher": {
        label: "商事法律依据研究员",
        description: "为边界明确的事项构建注明日期的官方法律依据资料集和精确的文件条款清单。",
      },
      "commercial-legal-contract-analyst": {
        label: "商事合同分析师",
        description: "开展条款级商事合同分析，并依据选定的法律依据资料集准备精确修订。",
      },
      "commercial-legal-regulatory-analyst": {
        label: "商事监管分析师",
        description: "根据具体事实判断交易涉及的监管适用性、义务、风险敞口和应对行动。",
      },
      "commercial-legal-strategy-counsel": {
        label: "商事法务策略顾问",
        description: "将合同与监管分析结果整合为按优先级排序的修订、谈判立场、签署行动和剩余风险。",
      },
      "commercial-legal-fact-checker": {
        label: "商事法务事实核查员",
        description: "独立审计单一综合法务策略的法律依据、条款可追溯性、日期、司法辖区、覆盖和结论尺度。",
      },
      "commercial-legal-report-writer": {
        label: "商事法务报告撰写员",
        description: "落实审计修正并发布规范的法务报告和配套交互式文档。",
      },
    },
    workflows: {
      "commercial-legal-review": {
        label: "商事法务审查",
        description:
          "当 Task 提供边界明确的商业事项、客户立场、适用司法辖区、截至日期以及可识别的文件或条款时使用；每个节点均为必需。",
        nodes: {
          "commercial-legal-matter-planner": "发布边界明确的事项章程。",
          "commercial-legal-authority-researcher": "发布官方法律依据资料集和条款清单。",
          "commercial-legal-contract-analyst": "发布条款级商事合同分析和修订。",
          "commercial-legal-regulatory-analyst": "发布基于事实的监管适用性分析。",
          "commercial-legal-strategy-counsel": "发布综合法务策略。",
          "commercial-legal-fact-checker": "独立审核单一综合策略。",
          "commercial-legal-report-writer": "发布规范的 Markdown、类型化报告和配套交互式文档。",
        },
      },
    },
  },
  "builtin/construction-project-controls": {
    label: "建设项目管控",
    description: "将范围、进度、成本、采购、现场风险和质量证据整合为责任明确的项目管控登记册。",
    selectorSummary: "用于边界明确的建设项目管控分析。",
    agents: {
      "construction-scope-schedule-analyst": {
        label: "范围和进度分析师",
        description: "梳理范围基线、依赖、里程碑、关键路径假设和进度差异。",
      },
      "construction-cost-procurement-analyst": {
        label: "成本和采购分析师",
        description: "梳理估算依据、承诺、变更、采购前置时间和成本差异。",
      },
      "construction-site-risk-quality-analyst": {
        label: "现场风险和质量分析师",
        description: "绘制场地限制、质量证据、安全接口、许可证和未解决的风险。",
      },
      "construction-controls-owner": {
        label: "施工项目控制负责人",
        description: "将各分支整合为可供决策的管控登记册。",
      },
    },
    workflows: {
      "construction-controls-pack": {
        label: "施工控制包",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "construction-scope-schedule-analyst": "梳理范围基线、依赖、里程碑、关键路径假设和进度差异。",
          "construction-cost-procurement-analyst": "梳理估算依据、承诺、变更、采购前置时间和成本差异。",
          "construction-site-risk-quality-analyst": "绘制场地限制、质量证据、安全接口、许可证和未解决的风险。",
          "construction-controls-owner": "将各分支整合为可供决策的管控登记册。",
        },
      },
    },
  },
  "builtin/corporate-governance-entity-secretariat": {
    label: "公司治理与公司秘书事务",
    description:
      "准备受来源约束的公司实体、治理机构、会议、书面同意、决议、会议记录、行动、申报日历和登记册证据，但不具备法律、签署或申报权限。",
    selectorSummary: "用于准备受控的公司治理与公司秘书事务证据，供法律顾问和获授权的公司秘书审查。",
    agents: {
      "entity-authority-governing-record-analyst": {
        label: "实体权限与治理记录分析师",
        description: "固化实体身份、司法辖区、治理文件、机构构成和授权委托证据。",
      },
      "governing-body-meeting-materials-analyst": {
        label: "治理机构会议材料分析师",
        description: "核对会议目的、通知、议程、材料、出席情况、利益冲突和来源时间线。",
      },
      "resolution-minutes-consent-action-analyst": {
        label: "决议、会议记录、书面同意与行动分析师",
        description: "起草受证据约束的会议记录、书面同意与决议文件并追踪行动，但不声称已经签署或生效。",
      },
      "entity-calendar-filing-register-analyst": {
        label: "实体日历、申报与登记册分析师",
        description: "梳理法律顾问提供的义务、日期、申报事项、登记册和完成证据。",
      },
      "corporate-governance-entity-secretariat-review-owner": {
        label: "公司治理与公司秘书事务审查负责人",
        description: "将权限、会议、决定与行动以及实体日历证据整合为供法律顾问使用的公司秘书资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "公司治理与公司秘书事务合格审查",
        description: "各独立专业证据分支汇聚为一次受控的公司治理与公司秘书事务审查。",
        nodes: {
          "entity-authority-governing-record-analyst": "固化实体身份、司法辖区、治理文件、机构构成和授权委托证据。",
          "governing-body-meeting-materials-analyst":
            "核对会议目的、通知、议程、材料、出席情况、利益冲突和来源时间线。",
          "resolution-minutes-consent-action-analyst":
            "起草受证据约束的会议记录、书面同意与决议文件并追踪行动，但不声称已经签署或生效。",
          "entity-calendar-filing-register-analyst": "梳理法律顾问提供的义务、日期、申报事项、登记册和完成证据。",
          "corporate-governance-entity-secretariat-review-owner":
            "将权限、会议、决定与行动以及实体日历证据整合为供法律顾问使用的公司秘书资料包。",
        },
      },
    },
  },
  "builtin/corporate-treasury-liquidity-operations": {
    label: "公司资金与流动性运营",
    description:
      "整理公司现金头寸、预测、融资、付款、结算、银行账户及对账控制证据，但不具备付款、交易、借款、套期保值、会计或投资权限。",
    selectorSummary: "用于准备受来源约束的公司资金流动性与控制证据，供获授权人员审查。",
    agents: {
      "treasury-cash-account-authority-analyst": {
        label: "现金账户与权限分析师",
        description: "固化实体、银行、账户、币种、余额定义、责任归属、签字权和控制证据。",
      },
      "treasury-cash-position-forecast-analyst": {
        label: "现金头寸与预测分析师",
        description: "核对按价值日记录的头寸、预测、实际值、情景和差异证据。",
      },
      "treasury-payment-funding-liquidity-analyst": {
        label: "资金付款、融资与流动性分析师",
        description: "梳理付款义务、融资工具、到期日、结算依赖和所提供的限额，但不执行相关操作。",
      },
      "treasury-bank-reconciliation-control-analyst": {
        label: "资金银行核对与控制分析师",
        description: "核对银行对账单、资金系统、ERP 和指令证据，并记录异常与控制责任归属。",
      },
      "corporate-treasury-liquidity-review-owner": {
        label: "公司资金与流动性审查负责人",
        description: "将权限、头寸与预测、付款与融资以及核对分支整合为受控的资金审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "公司资金与流动性运营合格审查",
        description: "各独立专业证据分支汇聚为一次受控的公司资金与流动性运营审查。",
        nodes: {
          "treasury-cash-account-authority-analyst":
            "固化实体、银行、账户、币种、余额定义、责任归属、签字权和控制证据。",
          "treasury-cash-position-forecast-analyst": "核对按价值日记录的头寸、预测、实际值、情景和差异证据。",
          "treasury-payment-funding-liquidity-analyst":
            "梳理付款义务、融资工具、到期日、结算依赖和所提供的限额，但不执行相关操作。",
          "treasury-bank-reconciliation-control-analyst":
            "核对银行对账单、资金系统、ERP 和指令证据，并记录异常与控制责任归属。",
          "corporate-treasury-liquidity-review-owner":
            "将权限、头寸与预测、付款与融资以及核对分支整合为受控的资金审查资料包。",
        },
      },
    },
  },
  "builtin/cultural-heritage-preservation": {
    label: "文化遗产保护",
    description: "将价值意义、来源、状况、预防性风险、数字保存和访问证据整合为边界明确的保护规划资料包。",
    selectorSummary: "用于以证据为依据的文化遗产保护规划，但不具备处理或权利决定权限。",
    agents: {
      "heritage-significance-provenance-analyst": {
        label: "意义和来源分析师",
        description: "将经过验证的记录、推论、口头来源、社区持有的知识、保管和权利限制分开。",
      },
      "heritage-condition-risk-analyst": {
        label: "条件和风险分析师",
        description: "梳理保存状况变化、劣化因素、危害和预防性风险证据，但不制定处理方案。",
      },
      "heritage-digital-access-analyst": {
        label: "数字保存和访问分析师",
        description: "审查数字来源、固定性、格式可持续性、访问控制、同意和文化敏感性。",
      },
      "heritage-conservation-plan-owner": {
        label: "保护计划负责人",
        description: "将独立证据分支整合为边界明确的保存选项和合格人员决策门槛。",
      },
    },
    workflows: {
      "heritage-preservation-plan": {
        label: "遗产保护计划",
        description: "三个独立的遗产证据分支汇聚成一个保护规划包。",
        nodes: {
          "heritage-significance-provenance-analyst": "梳理价值意义、来源、保管、证据类别、权利和社区持有的知识。",
          "heritage-condition-risk-analyst": "梳理保存状况变化、劣化因素、危险情景和预防控制。",
          "heritage-digital-access-analyst": "梳理数字固化性、格式、访问、同意和文化敏感性限制。",
          "heritage-conservation-plan-owner": "将所有分支整合为按优先级排序的保存选项、依赖和审批门槛。",
        },
      },
    },
  },
  "builtin/customer-success": {
    label: "客户成功运营",
    description: "以证据为主导的客户健康状况、生命周期、保留、移交和运营计划分析，具有明确的来源和人工决策边界。",
    selectorSummary: "将客户证据和运营事实转化为可审计的客户成功计划。",
    agents: {
      "customer-success-evidence-analyst": {
        label: "客户证据分析师",
        description: "根据客户、支持、产品、商业和关系记录构建注明日期、按客群细分的证据台账。",
      },
      "customer-success-lifecycle-analyst": {
        label: "客户生命周期分析师",
        description: "绘制入职、采用、支持、更新、升级和移交定义、负责人和控制差距。",
      },
      "customer-success-operations-designer": {
        label: "客户成功运营设计师",
        description: "将证据和生命周期分析与负责人、触发器、措施和审查点结合到一个优先运营计划中。",
      },
      "customer-success-plan-reviewer": {
        label: "客户成功计划审核员",
        description: "独立检查证据的可追溯性、分段有效性、所有权、测量、交接闭合和校准结论。",
      },
    },
    workflows: {
      "customer-success-operating-plan": {
        label: "客户成功运营计划",
        description: "并行运行两项边界明确的分析，将其精确输出整合为一份运营计划，再独立审查整合结果。",
        nodes: {
          "customer-success-evidence-analyst": "产出注明日期、按客群细分的客户证据台账。",
          "customer-success-lifecycle-analyst": "生成生命周期、所有权、移交和控制图。",
          "customer-success-operations-designer": "将两种分析结合到单一客户成功运营计划中。",
          "customer-success-plan-reviewer": "独立审查联合运营计划并记录所需的更正。",
        },
      },
    },
  },
  "builtin/customs-trade-compliance": {
    label: "海关贸易合规",
    description: "跨境交易、分类、原产地、估值、筛选和经纪商准入证据纳入合格的贸易审查。",
    selectorSummary: "用于边界明确的海关与贸易合规证据工作。",
    agents: {
      "trade-transaction-jurisdiction-document-analyst": {
        label: "贸易交易、司法管辖区和文件分析师",
        description: "冻结跨境交易、各方、货物、路线、日期、角色和文件基线。",
      },
      "tariff-classification-product-evidence-analyst": {
        label: "关税分类和产品证据分析师",
        description: "构建产品事实、候选命名法和规则跟踪，而不指定最终分类。",
      },
      "origin-valuation-preference-analyst": {
        label: "起源、估值和偏好分析师",
        description: "追踪 BOM、流程与原产地证据以及海关估价输入，核验所提供的优惠待遇主张。",
      },
      "restricted-party-license-entry-control-analyst": {
        label: "受限方、许可证和进入控制分析师",
        description: "检查潜在匹配、许可/控制和经纪人进入调节证据。",
      },
      "customs-trade-compliance-review-owner": {
        label: "海关贸易合规审查负责人",
        description: "整合交易、归类、原产地与估价以及筛查与报关证据，供合格人员审查。",
      },
    },
    workflows: {
      "customs-trade-compliance-review": {
        label: "海关贸易合规审查",
        description: "四个独立的贸易证据分支汇聚成一个明确的审查负责人。",
        nodes: {
          "trade-transaction-jurisdiction-document-analyst": "冻结跨境交易、各方、货物、路线、日期、角色和文件基线。",
          "tariff-classification-product-evidence-analyst": "构建产品事实、候选命名法和规则跟踪，而不指定最终分类。",
          "origin-valuation-preference-analyst":
            "追踪 BOM、流程与原产地证据以及海关估价输入，核验所提供的优惠待遇主张。",
          "restricted-party-license-entry-control-analyst": "检查潜在匹配、许可/控制和经纪人进入调节证据。",
          "customs-trade-compliance-review-owner": "整合交易、归类、原产地与估价以及筛查与报关证据，供合格人员审查。",
        },
      },
    },
  },
  "builtin/cybersecurity-assurance": {
    label: "网络安全保障",
    description: "将只读的威胁、控制和事件准备度分析整合为有证据支持的安全保证登记册。",
    selectorSummary: "用于边界明确的安全态势、控制证据和事件准备度保证。",
    agents: {
      "security-threat-evidence-analyst": {
        label: "威胁证据分析师",
        description: "绘制资产、信任边界、威胁声明和观察到的证据。",
      },
      "security-control-coverage-analyst": {
        label: "控制覆盖率分析师",
        description: "将所声称的控制措施对应到证据、负责人、缺口和验证状态。",
      },
      "security-incident-readiness-analyst": {
        label: "事件准备分析师",
        description: "评估检测、升级、遏制、恢复和演习证据。",
      },
      "security-assurance-integrator": {
        label: "安全保障集成商",
        description: "将所有安全证据整合为一份可审查的保证登记册。",
      },
    },
    workflows: {
      "security-assurance-pack": {
        label: "安全保障包",
        description: "三个独立保证分支汇聚为一份责任明确的证据登记册。",
        nodes: {
          "security-threat-evidence-analyst": "绘制威胁图和观察到的证据。",
          "security-control-coverage-analyst": "梳理控制覆盖与缺口。",
          "security-incident-readiness-analyst": "梳理事件准备度证据。",
          "security-assurance-integrator": "将所有分支整合为保证登记册。",
        },
      },
    },
  },
  "builtin/dam-safety-surveillance-assurance": {
    label: "大坝安全监测保证",
    description:
      "对大坝设施配置、检查、仪器监测、性能、潜在失效模式和控制证据提供保证，但不具备运营、工程放行或应急处置权限。",
    selectorSummary: "用于准备受来源约束的大坝检查与监测证据，供合格的大坝安全人员审查。",
    agents: {
      "dam-configuration-authority-consequence-analyst": {
        label: "大坝配置、权限与后果分析师",
        description: "固化大坝身份、结构、设计与改造权限、荷载背景和所提供的后果分类。",
      },
      "dam-inspection-condition-defect-analyst": {
        label: "大坝检查、状况与缺陷分析师",
        description: "将目视、测量和无损检测观测对应到精确位置、尺寸、比较结果和限制条件。",
      },
      "dam-instrumentation-performance-surveillance-analyst": {
        label: "大坝仪器、性能与监测分析师",
        description: "核对仪器健康状态、读数、换算、环境与荷载协变量以及获授权的行为基线。",
      },
      "dam-potential-failure-mode-control-analyst": {
        label: "大坝潜在失效模式与控制分析师",
        description: "追踪所提供的潜在失效模式、证据、检测控制、行动和验证，但不接受风险。",
      },
      "dam-safety-surveillance-review-owner": {
        label: "大坝安全监测审查负责人",
        description: "将配置、检查、仪器监测以及失效模式与控制证据整合为合格的大坝安全审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "大坝安全监测保证合格审查",
        description: "各独立专业证据分支汇聚为一次受控的大坝安全监测保证审查。",
        nodes: {
          "dam-configuration-authority-consequence-analyst":
            "固化大坝身份、结构、设计与改造权限、荷载背景和所提供的后果分类。",
          "dam-inspection-condition-defect-analyst":
            "将目视、测量和无损检测观测对应到精确位置、尺寸、比较结果和限制条件。",
          "dam-instrumentation-performance-surveillance-analyst":
            "核对仪器健康状态、读数、换算、环境与荷载协变量以及获授权的行为基线。",
          "dam-potential-failure-mode-control-analyst":
            "追踪所提供的潜在失效模式、证据、检测控制、行动和验证，但不接受风险。",
          "dam-safety-surveillance-review-owner":
            "将配置、检查、仪器监测以及失效模式与控制证据整合为合格的大坝安全审查资料包。",
        },
      },
    },
  },
  "builtin/data-analysis": {
    label: "数据分析与商业洞察",
    description: "将边界明确的运营数据转化为可复现的绩效与细分分析、经审计的商业洞察和可执行的运营报告。",
    selectorSummary: "用于需要指标核对、并行绩效与细分分析以及经审计决策报告的边界明确的运营数据集。",
    agents: {
      "data-analysis-planner": {
        label: "数据分析规划师",
        description: "定义业务问题、指标、数据集边界、比较计划和停止条件。",
      },
      "data-analysis-data-steward": {
        label: "数据分析 数据管家",
        description: "构建包含溯源、粒度、质量发现和指标核对的标准化数据资料集。",
      },
      "data-analysis-performance-analyst": {
        label: "数据分析绩效分析师",
        description: "根据已接受的档案分析趋势、差异、效率和运营绩效。",
      },
      "data-analysis-segment-analyst": {
        label: "数据分析细分分析师",
        description: "从已接受的档案中分析群组、区域、渠道、产品或客户群。",
      },
      "data-analysis-insight-synthesizer": {
        label: "数据分析洞察合成器",
        description: "将两个分析分支核对并整合为按优先级排序的洞察和运营行动序列。",
      },
      "data-analysis-fact-checker": {
        label: "数据分析事实核查员",
        description: "根据其计算、来源、定义和限制独立检查综合摘要。",
      },
      "data-analysis-report-writer": {
        label: "数据分析报告编写者",
        description: "解决审计问题并发布规范的运营洞察报告。",
      },
    },
    workflows: {
      "operating-insight-report": {
        label: "经审计的运营洞察报告",
        description:
          "当 Task 提供边界明确的运营数据和指标定义时使用：定义分析、整理数据资料集、并行分析绩效和细分、综合并审计洞察，再发布报告。",
        nodes: {
          "data-analysis-planner": "发布数据分析/分析宪章。",
          "data-analysis-data-steward": "发布数据分析/数据档案。",
          "data-analysis-performance-analyst": "发布数据分析/性能分析。",
          "data-analysis-segment-analyst": "发布数据分析/细分分析。",
          "data-analysis-insight-synthesizer": "发布数据分析/见解简报。",
          "data-analysis-fact-checker": "发布数据分析/审计。",
          "data-analysis-report-writer": "发布数据分析/报告。",
        },
      },
    },
  },
  "builtin/data-engineering-reliability": {
    label: "数据工程可靠性",
    description: "将契约、重放安全性和可观测性分析整合为有证据支持的数据产品发布资料包。",
    selectorSummary: "用于可靠的数据产品和管道发布规划。",
    agents: {
      "data-contract-analyst": {
        label: "数据合约分析师",
        description: "定义源、输出、沿袭和兼容性契约。",
      },
      "data-pipeline-resilience-analyst": {
        label: "管道弹性分析师",
        description: "分析幂等性、重放、回填、排序和回滚。",
      },
      "data-observability-analyst": {
        label: "数据可观测性分析师",
        description: "定义质量证据、服务指标、警报和所有权。",
      },
      "data-release-integrator": {
        label: "数据发布集成商",
        description: "将契约、韧性和可观测性整合为一份发布资料包。",
      },
    },
    workflows: {
      "data-product-release-pack": {
        label: "数据产品发布包",
        description: "三个独立的可靠性分支汇聚成一个受控发布包。",
        nodes: {
          "data-contract-analyst": "定义合约和消费者。",
          "data-pipeline-resilience-analyst": "分析重放和失败行为。",
          "data-observability-analyst": "定义可观察性和质量证据。",
          "data-release-integrator": "将所有分支整合为发布资料包。",
        },
      },
    },
  },
  "builtin/deep-research": {
    label: "深度研究",
    description: "从多视角来源发现、证据整理和有依据的大纲，到带引文的草稿、独立引文审查与精炼的长篇报告。",
    selectorSummary: "用于需要多种视角、深度来源发掘、引文、综合分析和高质量报告的广泛或有争议的研究问题。",
    agents: {
      "deep-research-planner": {
        label: "深度研究规划师",
        description: "定义研究问题、受众、视角图、来源政策、可交付成果和停止条件。",
      },
      "deep-research-knowledge-curator": {
        label: "深度研究知识整理员",
        description: "发现不同的观点，提出特定观点的问题，并建立引用的证据档案。",
      },
      "deep-research-outline-editor": {
        label: "深度研究大纲编辑",
        description: "将选定的证据转换为具有章节级证据分配的连贯、非冗余的层次结构。",
      },
      "deep-research-draft-writer": {
        label: "深度研究草稿撰写员",
        description: "撰写完整、有来源依据的草稿，使文内引文对应到整理后的来源索引。",
      },
      "deep-research-citation-reviewer": {
        label: "深度研究引文审查员",
        description: "独立审计引文是否支持主张、来源质量、覆盖、位置、综合质量和不确定性。",
      },
      "deep-research-report-writer": {
        label: "深度研究报告撰写者",
        description: "落实独立审查意见，并发布规范的 Markdown 与可见的最终研究报告。",
      },
    },
    workflows: {
      "multi-perspective-report": {
        label: "多视角深度研究报告",
        description:
          "界定问题，整理以多视角为主线的证据，构建有依据的大纲，撰写带引文的草稿，审查引文，并发布一份高质量报告。",
        nodes: {
          "deep-research-planner": "发布边界明确的研究章程和视角计划。",
          "deep-research-knowledge-curator": "发布多视角证据档案。",
          "deep-research-outline-editor": "发布有证据的文章大纲。",
          "deep-research-draft-writer": "发布完整的带引文草稿。",
          "deep-research-citation-reviewer": "发布独立的引文与综合审查结果。",
          "deep-research-report-writer": "发布规范的 Markdown 和可见的最终报告。",
        },
      },
    },
  },
  "builtin/digital-accessibility-assurance": {
    label: "数字无障碍保证",
    description:
      "对数字无障碍清单、WCAG 成功准则映射、语义、键盘、辅助技术、视觉、媒体、认知、人工检查和整改证据提供保证，但不具备符合性认定或法律决定权。",
    selectorSummary: "用于准备可复现的数字无障碍证据和整改验证，供合格人员审查。",
    agents: {
      "accessibility-scope-inventory-analyst": {
        label: "无障碍范围与清单分析师",
        description: "固化用户旅程、状态、build、locale、技术、标准与政策来源以及测试矩阵。",
      },
      "accessibility-semantics-keyboard-assistive-analyst": {
        label: "无障碍语义、键盘与辅助技术分析师",
        description: "产出语义、键盘、焦点、表单、状态和辅助技术证据。",
      },
      "accessibility-visual-media-cognitive-analyst": {
        label: "无障碍视觉、媒体与认知分析师",
        description: "测量对比度、重排、视觉呈现、动态效果、时间限制、媒体替代和认知一致性证据。",
      },
      "accessibility-manual-user-remediation-verification-analyst": {
        label: "人工检查、用户研究与整改验证分析师",
        description: "追踪人工检查规程、经授权采集的残障用户证据、整改版本、复测、回归和例外。",
      },
      "digital-accessibility-assurance-review-owner": {
        label: "数字无障碍保证审查负责人",
        description: "将范围、语义与键盘、视觉与媒体以及人工检查与整改证据整合为合格的无障碍审查资料包。",
      },
    },
    workflows: {
      "qualified-review": {
        label: "数字无障碍保证合格审查",
        description: "各独立专业证据分支汇聚为一次受控的数字无障碍保证审查。",
        nodes: {
          "accessibility-scope-inventory-analyst":
            "固化用户旅程、状态、build、locale、技术、标准与政策来源以及测试矩阵。",
          "accessibility-semantics-keyboard-assistive-analyst": "产出语义、键盘、焦点、表单、状态和辅助技术证据。",
          "accessibility-visual-media-cognitive-analyst":
            "测量对比度、重排、视觉呈现、动态效果、时间限制、媒体替代和认知一致性证据。",
          "accessibility-manual-user-remediation-verification-analyst":
            "追踪人工检查规程、经授权采集的残障用户证据、整改版本、复测、回归和例外。",
          "digital-accessibility-assurance-review-owner":
            "将范围、语义与键盘、视觉与媒体以及人工检查与整改证据整合为合格的无障碍审查资料包。",
        },
      },
    },
  },
  "builtin/digital-forensics-incident-investigation": {
    label: "数字取证事件调查",
    description: "整合经授权的数字证据保全、端点与云 Artifact、时间线和假设证据，供合格人员开展 DFIR 审查。",
    selectorSummary: "用于边界明确的数字取证事件证据工作，不执行实时采集、遏制或归因。",
    agents: {
      "digital-evidence-authority-preservation-analyst": {
        label: "数字证据授权与保全分析师",
        description: "固化调查授权、事项范围、法定保全、系统、保管责任人、许可方法和证据保管要求。",
      },
      "endpoint-memory-disk-artifact-analyst": {
        label: "端点、内存和磁盘 Artifact 分析师",
        description: "检查所提供的端点、内存镜像和磁盘镜像 Artifact 观察结果，并保留工具与解析器溯源。",
      },
      "network-cloud-identity-artifact-analyst": {
        label: "网络、云和身份 Artifact 分析师",
        description: "将所提供的网络、云审计和跨帐户、设备、会话和服务的身份 Artifact 关联起来。",
      },
      "incident-timeline-hypothesis-corroboration-analyst": {
        label: "事件时间线、假设和佐证分析师",
        description: "构建标准化且保留来源信息的事件时间线，并检验相互竞争的事件假设。",
      },
      "digital-forensics-incident-evidence-owner": {
        label: "数字取证事件证据负责人",
        description: "将授权范围、端点、分布式 Artifact 和时间线假设整合为保留矛盾的审查资料包。",
      },
    },
    workflows: {
      "digital-forensics-incident-review": {
        label: "数字取证事件调查审查",
        description: "四个独立证据起点汇聚至一名职责明确的合格审查负责人。",
        nodes: {
          "digital-evidence-authority-preservation-analyst":
            "固化调查授权、事项范围、法定保全、系统、保管责任人、许可方法和证据保管要求。",
          "endpoint-memory-disk-artifact-analyst":
            "检查所提供的端点、内存镜像和磁盘镜像 Artifact 观察结果，并保留工具与解析器溯源。",
          "network-cloud-identity-artifact-analyst":
            "将所提供的网络、云审计和跨帐户、设备、会话和服务的身份 Artifact 关联起来。",
          "incident-timeline-hypothesis-corroboration-analyst":
            "构建标准化且保留来源信息的事件时间线，并检验相互竞争的事件假设。",
          "digital-forensics-incident-evidence-owner":
            "将授权范围、端点、分布式 Artifact 和时间线假设整合为保留矛盾的审查资料包。",
        },
      },
    },
  },
  "builtin/ecommerce-merchandising": {
    label: "电商商品运营",
    description: "将商品目录、需求与定价以及体验与运营证据整合为可回退的商品运营测试计划。",
    selectorSummary: "用于有证据支持的电商商品运营实验。",
    agents: {
      "merchandising-catalog-evidence-analyst": {
        label: "目录证据分析师",
        description: "梳理商品目录质量、分类体系、属性、可售性和来源。",
      },
      "merchandising-demand-pricing-analyst": {
        label: "需求和定价分析师",
        description: "测试需求、价格、促销、利润和季节性假设。",
      },
      "merchandising-experience-operations-analyst": {
        label: "体验与运营分析师",
        description: "梳理用户旅程、履约、退货、库存、无障碍性和客户保障措施。",
      },
      "merchandising-plan-owner": {
        label: "商品运营计划负责人",
        description: "将所有分支整合为设有防护且可回退的测试计划。",
      },
    },
    workflows: {
      "merchandising-test-plan": {
        label: "商品运营测试计划",
        description: "三个独立商品运营分支汇聚为一份设有防护的实验计划。",
        nodes: {
          "merchandising-catalog-evidence-analyst": "梳理商品目录证据。",
          "merchandising-demand-pricing-analyst": "测试需求和定价假设。",
          "merchandising-experience-operations-analyst": "梳理体验与运营约束。",
          "merchandising-plan-owner": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/education-program-design": {
    label: "教育项目设计",
    description: "将学习者证据、课程结构、评估和无障碍分析整合为可衡量的学习项目蓝图。",
    selectorSummary: "用于有证据支持的课程和学习计划设计。",
    agents: {
      "education-learner-evidence-analyst": {
        label: "学习者证据分析师",
        description: "绘制学习者背景、需求、限制和证据质量。",
      },
      "education-curriculum-architect": {
        label: "课程架构师",
        description: "设计可衡量的结果、先决条件、顺序和实践。",
      },
      "education-assessment-accessibility-analyst": {
        label: "评估和无障碍分析师",
        description: "协调评估、反馈、合理便利措施和无障碍要求。",
      },
      "education-program-integrator": {
        label: "学习计划集成商",
        description: "将所有分支整合为可审查的学习项目蓝图。",
      },
    },
    workflows: {
      "learning-program-blueprint": {
        label: "学习计划蓝图",
        description: "三个独立的教育设计分支汇聚成一张蓝图。",
        nodes: {
          "education-learner-evidence-analyst": "绘制学习者证据。",
          "education-curriculum-architect": "设计课程结构。",
          "education-assessment-accessibility-analyst": "设计评估与无障碍方案。",
          "education-program-integrator": "整合已完成的分支报告。",
        },
      },
    },
  },
  "builtin/emergency-management-continuity": {
    label: "应急管理与业务连续性",
    description: "将全灾种、关键职能、资源、通信和演练证据整合为非运营性的连续性准备资料包。",
    selectorSummary: "用于边界明确的应急与连续性准备规划。",
    agents: {
      "hazard-scenario-assumption-analyst": {
        label: "危险情景和假设分析师",
        description: "构建注明日期的全灾种规划情景和级联影响假设，但不作预测。",
      },
      "essential-functions-continuity-analyst": {
        label: "关键职能连续性分析师",
        description: "绘制基本职能、恢复目标、依赖性、继任、授权和连续性战略。",
      },
      "incident-resource-communications-analyst": {
        label: "事件资源和通信分析师",
        description: "绘制批准的事件接口、类型资源、互助、后勤和无障碍通信。",
      },
      "exercise-improvement-analyst": {
        label: "锻炼和改善分析师",
        description: "追踪演习目标、观察结果、评估证据和纠正措施。",
      },
      "emergency-continuity-readiness-owner": {
        label: "应急连续性准备负责人",
        description: "将四个分支整合为经过版本化的准备度与改进决策资料包。",
      },
    },
    workflows: {
      "emergency-continuity-readiness-pack": {
        label: "应急连续性准备资料包",
        description: "四个独立的规划部门汇聚成一个负责的非运营准备包。",
        nodes: {
          "hazard-scenario-assumption-analyst": "构建所有灾害情景和连锁影响假设。",
          "essential-functions-continuity-analyst": "梳理关键职能、目标、依赖和策略。",
          "incident-resource-communications-analyst": "梳理获批的事件、资源和通信接口。",
          "exercise-improvement-analyst": "梳理演练证据和改进行动。",
          "emergency-continuity-readiness-owner": "将所有分支整合为准备度决策资料包。",
        },
      },
    },
  },
  "builtin/energy-utilities-planning": {
    label: "能源与公用事业规划",
    description: "将需求、供给、可靠性、成本和排放证据整合为边界明确的公用事业情景登记册。",
    selectorSummary: "用于有证据支持的能源和公用事业规划场景。",
    agents: {
      "utility-demand-supply-analyst": {
        label: "需求与供应分析师",
        description: "构建有来源依据的需求、发电、储能和输入假设。",
      },
      "utility-reliability-constraints-analyst": {
        label: "可靠性约束分析师",
        description: "绘制资产、网络、弹性、维护和安全约束。",
      },
      "utility-cost-emissions-analyst": {
        label: "成本和排放分析师",
        description: "比较各情景中有来源依据的成本、排放和政策假设。",
      },
      "utility-plan-owner": {
        label: "公用事业计划负责人",
        description: "将各分支整合为设有人工决策门槛的情景登记册。",
      },
    },
    workflows: {
      "utility-scenario-plan": {
        label: "公用事业情景计划",
        description: "三个独立证据分支汇聚为一份责任明确的审查资料包。",
        nodes: {
          "utility-demand-supply-analyst": "构建有来源依据的需求、发电、储能和输入假设。",
          "utility-reliability-constraints-analyst": "绘制资产、网络、弹性、维护和安全约束。",
          "utility-cost-emissions-analyst": "比较各情景中有来源依据的成本、排放和政策假设。",
          "utility-plan-owner": "将各分支整合为设有人工决策门槛的情景登记册。",
        },
      },
    },
  },
  "builtin/enterprise-backup-recovery-assurance": {
    label: "企业备份恢复保障",
    description: "工作负载范围、备份副本、完整性和独立恢复证据相结合，以提供合格的恢复保证。",
    selectorSummary: "用于边界明确的备份可恢复性证据工作，不执行实际备份或恢复操作。",
    agents: {
      "workload-recovery-scope-analyst": {
        label: "工作负载和恢复范围分析师",
        description: "固化工作负载、数据、依赖以及由人工负责的恢复目标证据。",
      },
      "backup-copy-retention-immutability-analyst": {
        label: "备份副本、保留和不变性分析师",
        description: "核对备份作业、副本、保留策略和所提供的不可变性证据。",
      },
      "backup-catalog-hash-integrity-analyst": {
        label: "备份目录和哈希完整性分析师",
        description: "检验所提供的目录、manifest、checksum 和完整性证据。",
      },
      "isolated-restore-recovery-validation-analyst": {
        label: "隔离恢复和恢复验证分析师",
        description: "审查授权的隔离恢复测试和恢复验证证据。",
      },
      "enterprise-backup-recovery-assurance-owner": {
        label: "企业备份恢复保证负责人",
        description: "连接范围、副本、完整性和隔离恢复证据而不执行恢复。",
      },
    },
    workflows: {
      "enterprise-backup-recovery-assurance-review": {
        label: "企业备份恢复保证审查",
        description: "四个独立的专业证据部门汇聚为企业备份恢复保证负责人。",
        nodes: {
          "workload-recovery-scope-analyst": "固化工作负载、数据、依赖以及由人工负责的恢复目标证据。",
          "backup-copy-retention-immutability-analyst": "核对备份作业、副本、保留策略和所提供的不可变性证据。",
          "backup-catalog-hash-integrity-analyst": "检验所提供的目录、manifest、checksum 和完整性证据。",
          "isolated-restore-recovery-validation-analyst": "审查授权的隔离恢复测试和恢复验证证据。",
          "enterprise-backup-recovery-assurance-owner": "连接范围、副本、完整性和隔离恢复证据而不执行恢复。",
        },
      },
    },
  },
  "builtin/equity-research": {
    label: "股票研究",
    description: "以注明日期的一手来源证据资料集为起点，经基本面、估值、平衡投资论点和数值审计，形成面向投资者的报告。",
    selectorSummary: "用于需要可审计报告的上市公司、行业、可比公司、估值、催化因素、风险和投资论点研究。",
    agents: {
      "equity-research-planner": {
        label: "股票研究规划师",
        description: "定义注明日期的研究章程、投资者问题、可比公司边界、来源政策和停止条件。",
      },
      "equity-source-analyst": {
        label: "股票研究来源分析师",
        description: "构建注明日期的一手来源资料集，以及标准化的运营、财务、市场和可比公司证据表。",
      },
      "equity-fundamentals-analyst": {
        label: "股票基本面分析师",
        description: "根据选定的证据解释增长、利润率、现金转换、资本密集度、资产负债表质量和同行定位。",
      },
      "equity-valuation-analyst": {
        label: "股票估值分析师",
        description: "产生具有敏感性和明确假设的透明可比公司和内在估值范围。",
      },
      "equity-thesis-analyst": {
        label: "股票投资论点分析师",
        description: "将基本面与估值整合为平衡的投资论点、催化因素、风险及乐观、基准和悲观情景。",
      },
      "equity-fact-checker": {
        label: "股票研究事实核查员",
        description: "独立审计数值可追溯性、日期、估值计算、来源质量和投资论点的证据支撑。",
      },
      "equity-report-writer": {
        label: "股票研究报告撰写员",
        description: "将经过审计的证据转化为规范的 Markdown 和可见的投资者就绪报告，且不改变底层分析。",
      },
    },
    workflows: {
      "equity-research-report": {
        label: "可审计的股票研究报告",
        description:
          "规划一项注明日期的公开市场股票研究，整理来源，并行分析基本面与估值，形成并审计投资论点，再发布报告。",
        nodes: {
          "equity-research-planner": "发布边界明确的股票研究章程。",
          "equity-source-analyst": "发布一手来源资料集和标准化证据表。",
          "equity-fundamentals-analyst": "发布运营、财务质量和同行分析。",
          "equity-valuation-analyst": "发布估值范围、假设和敏感性。",
          "equity-thesis-analyst": "发布核对整合后的投资论点和情景。",
          "equity-fact-checker": "发布独立的事实和数字审计。",
          "equity-report-writer": "发布规范的 Markdown 和可见的最终报告。",
        },
      },
    },
  },
  "builtin/evolution-lab": {
    label: "演进实验室",
    description: "为明确的 Expert Squad 演进活动提供不依赖具体目标类型的证据、候选方案、评估、完整性审查和建议资料包。",
    selectorSummary: "仅用于明确的 Expert Squad 演进调查或活动。",
    agents: {
      "evolution-observer": {
        label: "演进机会观察员",
        description: "将明确选定的生产证据转化为边界明确的改进机会，但不派发修复任务。",
      },
      "evolution-failure-analyst": {
        label: "演进失败分析师",
        description: "重建有证据支持的因果链并标明已证实的责任归属，同时保留未知项。",
      },
      "evolution-experiment-planner": {
        label: "演进实验规划师",
        description: "在候选方案工作开始前，固化目标 revision、案例、评分器、环境、实验组顺序、预算和可变更范围。",
      },
      "evolution-candidate-author": {
        label: "演进候选方案编写员",
        description: "在已固化的可变文本范围内编写一个完整、自包含的目标包候选方案。",
      },
      "evolution-evaluator": {
        label: "演进评估员",
        description: "收集精确的双组运行证据，仅执行已固化的评分器契约，并保留结果不可用的状态。",
      },
      "evolution-security-integrity-reviewer": {
        label: "演进安全与完整性审查员",
        description: "独立审计权限、泄露、奖励操纵、证据沿袭、已固化文件和实验漂移。",
      },
      "evolution-recommendation-owner": {
        label: "演进建议负责人",
        description: "发布实验范围内的比较与建议并保留未知项，但不安装任何 revision。",
      },
    },
    workflows: {
      "evolution-opportunity-analysis": {
        label: "演进机会及原因分析",
        description: "在任何活动获准前，用于明确选定的现有生产证据；发布边界明确的改进机会和已证实的因果归属。",
        nodes: {
          "evolution-observer": "根据明确选定的证据发布边界明确的演进机会。",
          "evolution-failure-analyst": "发布故障因果归属和明确的未知项。",
        },
      },
      "evolution-candidate-preparation": {
        label: "已固化的开发活动与候选方案准备",
        description:
          "仅用于已导入获准机会与归属证据的 Mission 阶段；编写完整候选方案前，先固化一个开发 Dataset 分区。留出集和认证活动使用评估 workflow，绝不使用此流程图。",
        nodes: {
          "evolution-experiment-planner": "发布已固化的活动规范和精确的父级 revision，但不包含尚未创建的候选 digest。",
          "evolution-candidate-author": "发布一个完整的经过验证的候选 revision。",
        },
      },
      "evolution-campaign-evaluation": {
        label: "已固化的双组评估与建议",
        description:
          "仅在 Mission 已运行相互独立、profile 精确一致的基线与候选 Tasks，并将其终态证据连同活动和候选 Artifacts 一并导入后使用。",
        nodes: {
          "evolution-evaluator": "发布已导入且固化的基线与候选 Tasks 的精确运行证据和评分器结果。",
          "evolution-security-integrity-reviewer": "审计候选方案完整性、权限、证据、实验漂移和奖励操纵。",
          "evolution-recommendation-owner": "发布范围明确的比较与建议，但不具备候选方案晋级权限。",
        },
      },
    },
  },
} satisfies PublicSquadZhTranslationMap
