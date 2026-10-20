# 首页目标先确认、后创建

471的实际缺陷是打开后关闭Goal表单，已经留下空会话/匿名Project。本轮将首页表单提前：先填写目标和可选预算，只有表单确认才进入原project/global Conversation factory。确认的input及同一requestID通过原精确Session/authority/epoch交接，复用选中owner的Goal POST。已有Chat/Task/Mission/SideChat的mutation路径保留，没有新API、LLM流程门、合成消息或数据库迁移。

| 实际截图 | 人工复核 |
| --- | --- |
| [全局表单](global-form-before-create.png) | 仍是原launcher URL、原首页，目标直接预填原输入；明确说明确认后创建新对话。 |
| [全局取消](global-cancel-retains-home-draft.png) | 关闭后仍在原首页，原草稿完整可编辑。 |
| [全局确认结果](global-confirmed-result.png) | 修改成果后确认，一次真实work回复GOAL472GLOBALREADY；33,733/100,000 tokens、1/1 turns，状态Budget reached。 |
| [中文使用说明](goal-help-chinese.png) | 如何使用仍独立显示三步说明。 |
| [项目中文表单](project-chinese-form-before-create.png) | 原project的Code首页直接预填项目草稿，当前中文确认说明可读。 |
| [项目取消](project-cancel-retains-home-draft.png) | 原项目首页与原草稿保持。 |
| [项目确认结果](project-confirmed-result-chinese.png) | 原Project内一次真实chat回复GOAL472PROJECTREADY；37,196/100,000令牌、1/1轮，已达预算。 |
| [刷新恢复](project-result-after-reload.png) | 同一URL刷新后目标、原回复和预算状态保持。 |
| [已有目标详情](existing-goal-details-chinese.png) | 原详情/预算表单与已用统计正常展示，未保存新预算或恢复执行。 |
| [恢复英文](project-result-english-restored.png) | 原英文偏好恢复，目标/结果仍完整。 |

十张1280×720实图均已呈现并人工查看。全局与项目的取消观察分别为138 Project/186 Session→138/186、139/187→139/187；没有用删除补救取消。数据观察只记录真实读取，UI验收通过实际页面完成，没有新增或运行UI自动化、DOM/组件/源码文案或截图测试。

[实际目标、输入/回复、创建事实及保留核验](results.json)：全局Work owner ses_-zURPSNu3zz6SIH4nxQ7、Goal pev_g0VYaXcT300osY85ityb；原项目Chat owner ses_-zURPRFwZzzTe6qazRhB、Goal pev_g0VYaYkAL00R3JWBJBHG。两者均由真实goal-controller输入触发、正常assistant finish stop，实际gpt-6.1-sol，接收一轮后budget_limited；不能将该状态描述为Goal complete。原input的author为goal-controller，界面完整显示其真实控制消息，不伪装为新用户。持久化creation事件绑定实际Session/owner、author=user、原request_id及完整已确认input。

原137 Project/185 Session全部ID、目录和归属保持，包含471留下的真实空会话；最终139 Project/188 Session/schema3。新增分别为预检、确认后的全局Work和原项目Chat目标会话。构建原55931 exit0（正式skip-tauri、Vite50.25s）、overlay typecheck原91508 exit0、目录检查2 locales/2521 keys；这些只作编译补充。后端observer第一轮误读owner.projectID，按当前schema改读顶层projectID后重跑同一真实结果通过，没有新增模型执行或改产品。

[原生结算](native-settlement.json)：原81175 exit0、公开shutdown200，Host/Target/physical/output/request/launcher完整结算。实际4/最多10个流：预检memory/chat、目标work/chat，均200/stream/source-reader EOF。[复制对退休](private-pair-retirement.json)：runtime/private完整auth/models对在结算和实际秘密值扫描后退休，源metadata保持，无refresh/exchange；tab24关闭，原用户18571未操作。

本轮没有新执行Task/Mission/SideChat目标、附件/引用提交、连接替换/创建失败路径或流中Sources/Rendering；原选择和authority guard及461已提交失败会话保留合同保持，未用本轮截图冒称全覆盖。原完整配置性能与未采样Rendering范围继续，整体goal active。
