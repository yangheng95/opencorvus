# 项目配置事件及附件原件实测

对应[实施前方案与Recall](../../records/2026-10/2026-10-31-project-config-event-authority.md)。收录真实页面截图与脱敏checker结果，不收录完整配置、认证、模型目录或数据库。

修复 Project 配置使用 Session 事件名导致的公开协议冲突，附件本身未失效。真实候选保存后发布 `project.config.changed`、有效 `Config.Info` 和原 directory，生产公共事件校验通过；Session/Task 的 `config.changed` 及历史保持原合同。

| 截图 | 实际查看内容 |
| --- | --- |
| [01](01-before-real-preflight.png) | 基线明确模型和真实预检 |
| [02](02-before-staged-draft.png) | 基线上传与未发送草稿 |
| [03](03-before-save-parallelism.png) | 基线实际设置5→4 |
| [04](04-before-draft-after-save.png) | 基线保存后的原草稿 |
| [05](05-before-real-read-result.png) | 基线实际read及回答 |
| [06](06-before-original-source.png) | 基线原三行只读Sources |
| [07](07-after-real-preflight.png) | 候选明确模型及预检 |
| [08](08-after-staged-draft.png) | 候选相同原件与草稿 |
| [09](09-after-save-parallelism.png) | 候选自然龄后实际设置4 |
| [10](10-after-draft-after-save.png) | 多次真实保存后的草稿与模型 |
| [11](11-after-real-read-result.png) | 候选正确原文字段及Sources |
| [12](12-after-original-source.png) | 英文界面打开只读原件 |
| [13](13-after-chinese-source.png) | 中文来源、原件、空闲控件与日期 |

全部十三张均在真实native开发 `/ui` 页面呈现并人工查看。附件为[自有54字节输入](input/staged-note.txt)，模型提示未泄露字段预期值。两scope共10次真实gpt-6.1-sol流式请求，全部200及reader EOF；七文件58后端正向用例、正式SDK生成、前后端类型检查及普通前端构建通过。

[脱敏验证回执](verification.json)保留基线协议错误、首次候选observer executable身份不一致的工具错误及其修正后的真实通过。Windows自有测试长目录的Git发现失败经独立原件复制证明，再缩短私有运行器标签完整重跑，未修改产品合同。schema9/92表、原业务字段、115附件和完整旧历史保持；所有自有页/进程与配对凭据副本已结清。不存在新增UI自动化测试或真实用户数据库升级。
