# 成员入口名称与当前 Goal 页面

本轮产品改动仅为两个现有语言值：普通成员与专家团成员共用的阅读入口，英文改为“Agents”，中文改为“成员会话”。原来共用键固定“Expert Squad agents / 专家团成员”，会误标普通成员。页签、下拉及列表区域的无障碍名称继续读取同一个键。

正式`bun run build:overlay --skip-tauri`原60859 exit0，实际Node Vite构建，未进入SDK/后端/Tauri步骤；新独立bundle经自有native18789提供。没有新增或运行UI自动化测试。`check:i18n`只作目录完整性补充：两个locale、2520顶层key。

| 真实截图 | 人工观察 |
| --- | --- |
| [英文页签](agents-english.png) | “Agents”完整显示；原普通成员正常打开。 |
| [英文来源](agents-english-sources.png) | All agents列表往返后，同一既有成员的README.md L2–3原来源可读。 |
| [中文成员会话](agents-chinese-sources.png) | 经真实设置切中文，页签及当前阅读控件使用中性中文，文件与agent原身份保留。 |
| [中文默认页](home-goal-chinese.png) | 当前首页主体、输入、建议操作、独立创建目标及如何使用入口可见。 |
| [三步使用说明](goal-help-chinese.png) | 从首页创建、填写完成标准、查看进度及暂停的当前说明。 |
| [目标草稿](goal-draft-chinese.png) | 当前目标、可选令牌/自动轮次预算及自动续跑说明。 |
| [关闭后的空会话](goal-cancel-leaves-conversation.png) | 发现的新问题：未提交目标但已留下空Work会话及匿名项目。 |
| [英文默认页恢复](home-goal-english.png) | 原英文偏好已恢复，当前首页Goal入口与预算可选说明保持。 |

八张1280×720截图均已实际呈现、人工查看。既有Goal布局来自前几批，本轮不把复核包装为新的首页布局修复，也不宣称静态图片验证了所有直播Rendering瞬时帧。旧普通成员未接受新业务输入，没有创建或调用新成员。

[实际构建、保留核验及关闭草稿事实](results.json)：当前137 Project/185 Session/schema3，原135/183全部ID、目录、归属保持。增加的记录分别来自真实模型预检和真实Goal表单预览。预览后会话ses_-zURPXrRrzzcvguIfGye真实存在、无消息，公开Goal读取HTTP200/null；没有提交新目标，也没有清理该真实发现。下一批需修Goal创建时机，不能据此宣称完整Goal体验全部通过。

[原生结算](native-settlement.json)：原27569 exit0，公开shutdown200，Host/Target/physical/output/request/launcher完整结算，两个实际预检Sol请求均200/stream/source-reader EOF，整批预设最多4。[完整复制对退休](private-pair-retirement.json)：runtime/private auth与完整models均在结算后成对退休，经实际秘密值扫描，源metadata保持、无refresh/exchange。自有tab23关闭，原用户18571未操作。
