# 0.1.48 发布证据

正式版已于2026-11-07公开：[Release](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.48)。产品来源固定为`7896ab63ef13b0fbf25ab7638838a2afcd2ba42c`。

- [原生发布42368349375](https://github.com/yangheng95/opencorvus/actions/runs/42368349375)：23成功、6非适用跳过，五平台图形界面/命令行及Linux三格式全部交付。
- [准确返回的配对官网42370194000](https://github.com/yangheng95/opencorvus/actions/runs/42370194000)：8成功；日志验证产品source、原生parent和publisher实际返回ID一致。
- 原始运行11:28:56Z至12:01:17Z，共1941秒（32分21），早于原截止12:28:56Z；正式发布仅1次准入、两工作流均第1次attempt。
- 29公开资源、5更新平台、18官网实际下载响应200；GitHub双语正文精确匹配冻结根日志。83份旧日志逐项保留，总84份；原23发布对象全部保留，新增后24，无本轮失败正式候选。

## 机器回执

- `release-result.json`、`native-run.json`、`website-run.json`：真实终态、13份首次运行/重启回执（每份4会话、2持久化，`realProvider=false`）、安装资源验证和配对官网激活。
- `prepare-owner.json`：原始标签/空草稿归属；`public-readback.json`：29资源、有效不可变资源完整性、5更新平台和18官网映射；`public-downloads.json`：18个公开链接逐一跟随重定向后的真实200响应。
- `release-inventory-before.json`、`release-inventory-after.json`、`cleanup.json`：历史ID、标签、发布时间和发布状态保全，没有清退健康历史对象。
- `intel-preflight.json`、`intel-proof.json`：预检同run第2次成功、首轮域名解析失败及正式冻结source的Intel构建/首次运行事实；只复用依赖缓存，未移入debug资产。
- `preparation.json`、`website-precheck.json`：三平台原失败的聚焦修复、真实peer归属、57后端案例/143断言、14目录导入案例/88断言、独立官网104文件零错误，以及71工具的目录事实。GitHub的64条提示全部属于保留的历史验收requirements快照，当前1732包冻结依赖审计零漏洞；未改写历史快照或告警状态。
- `published-cli-asset.json`：145174404字节的正式Windows包与GitHub不可变对象身份一致；`published-ui-runtime.json`、`published-ui-settlement.json`：实际启动0.1.48、公开shutdown200、原PID31716/17964、51248监听及自有临时root均结清。

## 真实页面

以下11张均通过真实页面交互取得，并已逐张人工查看。没有运行UI自动化测试。

- `published-settings-en.jpg`、`published-settings-zh.jpg`：正式下载包提供的中英48设置日志，包含71工具条目。
- `website-changelog-en.jpg`、`website-changelog-zh.jpg`：对应冻结来源的官网中英48完整页面。
- `dev-mention-zh.jpg`、`dev-project-mention.jpg`：全局和项目内的中文提及、Research Studio中文说明及真实引用插入。
- `dev-reference-zh.jpg`：生产者匹配及已选引用状态；`dev-file-workbench.jpg`：完整项目目录和真实文件。
- `dev-unsaved-decision.jpg`：真实编辑后的保存并继续，随后实际重新打开；`dev-native-file-preview.jpg`：原生单选的方向键切换及保存后的预览。
- `dev-changelog-zh.jpg`：准备阶段的中文日志快照；最终随包内容以两个published-settings截图为准。首个默认来源旧UI的截图已排除。

本地复核仅使用自有空实例，未复制模型凭据、发送消息或启动持续目标，零真实模型请求；自有页面和实例已关闭，未操作用户18571或现用窗口、进程、数据库。复杂历史来源摘录和冲突恢复未在空实例重放。常规全量单元CI与本次发布工作流分别记录，未将发布成功宣称为其已通过。

方案、原始要求、修改前分析及阶段记录见[本版Recall](../../records/2026-11/2026-11-07-release-0.1.48.md)。
