# 工作量分配：完整任务原型

已交新的[公开任务](public/TASK.md)、[输入定位](public/INPUTS.json)、[质量合同](QUALITY.md)、完整参考工作簿/三项回答/源码及一次真实错误程序的同消费者结果。**这是未独立整审的任务原型，不是冻结bench、候选成绩、数小时任务资格或官方GDPval成绩。** 原十题/旧分/既有模型结果保持不变。

选题来自GDPval公开task `ce864f41-8584-49ba-b24f-9c9104b47bf0`，revision `11e7900cdcac61bc4daf59e65feb238acda98fbf`。先按原prompt/原料形式选择，随后在读取专家答案前登记本派生题的21工作日/85%个人项目容量口径。原专家采用四周、项目小时/名义容量；原文件和原rubric完整保留，不改它、不冒同一合同、不借专家来源认证本地参考。[方案](BUILD-PLAN.md)保留实施前定义及影响分析。

## 实际完整产物

- [参考工作簿](D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101/reference/tracker.xlsx)：六页，包含实际原账、人员登记、人员/部门/项目结果、可编辑工时/容量/预算与单向公式。六页均实际呈现查看；部门页初稿的固定数值备注已改为依赖公式，首次版本和源保在外部`first-reference.zip`。
- [三项管理回答](answers.reference.md)：部门、个人和项目的实际风险及未登记人员/缺失March31活动的限制。
- [独立源消费](source_facts.py)、[参考生产程序](build_reference.mjs)和[实际XLSX数值消费者](check_workbook.py)。消费者从任意sheet/位置/列顺序的公开表头定位，读的是保存后的XLSX数值，不以公式文本/文件存在或自报成功验收。
- 外部原根`D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101`：原三XLSX、原prompt、原专家交付/rubric、固定完整parquet、全部下载原字节、实际重算/错误程序、完整数值误差、六页PNG及先行版本。仓库只投影本地原创源、合同、事实收据和小图，不冒完整外部目录或可再许可的原始输入。

## 已实测结果

原四表为24个人的记录，注册表只有23人。总账**3114h=注册2959h+未分配155h**，其中项目2488h/Admin626h。Ellen Zhu的145项目小时/10行政小时进入原账及项目比较，她的HR属性/容量/比例保持未知。Wrike原拼写映射公开列明。两项源metadata均已由固定parquet解码逐字段与捕获row响应相同；这是来源身份核对，不是业务验收。

参考XLSX经真实保存/重开进入同一消费者，24人员/5部门/9项目的逐值误差均0，实际CLI exit0。错误生产程序`drop-unregistered`从同一原账丢弃未登记人员，真实生成XLSX后同消费者exit4：人员3个值错、项目7个值/状态错；部门表仍匹配。不能将一次失败抹成全部能力失败。实际argv/开始结束/子进程exit在`actual-checker-commands.json`，两份全误差JSON分别保在`reference/check.json`与`wrong-drop-unregistered/check.json`。

保存后的工作簿真实导入并改变一条项目工时，个人、部门、项目各增加1h；再把工作日21改20，首人容量变160h、PMO容量640h。`reference/refresh.json`保结果；变化只在内存副本，不覆盖交付原件。采用本机Artifact Tool 2.8.106、Node24.22.1工具链，未启动Excel窗口，未取得Microsoft Excel原生应用重算证据。作者自审不代签独立整题审查。输入归一由同一原表reader完成，数值核对分别走Python求和和工作簿公式；它不是两个独立输入解析器的相互认证。

## 原生重建

从公开输入缓存运行以下两步（没有模型请求）：

```powershell
python source_facts.py --source D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101/public --output D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101/facts.json
node build_reference.mjs D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101/facts.json D:/opencorvus-benchmark-runs/gdpval-workload-task-20261101/reference
```

Python读取需要`openpyxl`；Node生产使用本机bundled `@oai/artifact-tool`，本次只在自有运行根建立指向loader node_modules的junction并执行同一源副本，未修改运行库。原命令/版本事实见`execution-observation.json`。原件下载准备程序见[来源物化](../../evaluator/professional-source-intake-20261101/README.md)，不提供给候选。新的输出目录可用于复建，但本次已完成对象没有重跑需要。

## 未满足项

Q01/Q07–Q13需要完整内容、来源、刷新和视觉证据；已有作者自审、实际图和刷新事实，但没有独立整题审查。数值消费者只认证其明确范围，不是全grader。完整多样合法输入、专业人评/统计效度、区分度、候选有效数小时和任何Codex/OC结果均未建立；无自动启动候选/审查授权。简单表格合并和几秒重算不能证明重型难度，因此不把本原型补进十题完成率。

原始内容可能已有训练暴露，不当未来heldout。原数据卡未声明具体SPDX许可，因此不宣称原件适用本仓库许可。[官方数据源](https://huggingface.co/datasets/openai/gdpval/tree/11e7900cdcac61bc4daf59e65feb238acda98fbf)公开了任务材料；[官方说明](https://evals.openai.com/gdpval/grading)推荐职业专家成对比较，本地作者自审没有替代它。
