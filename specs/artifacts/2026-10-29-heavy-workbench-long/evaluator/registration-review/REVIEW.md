# 薄启动注册合同独立审查

审查者：`/root/benchmark_review`。范围仅注册解析器、其3项非UI测试、`serve_heavy_workbench.ts`本轮差异及07:32 UTC Recall。没有修改主仓库、读取凭据、启动服务/模型或再次委托。所有新收据与审查文件仅写入本目录。

## 阶段结论

**本轮局部注册合同变更未发现实质阻断，可在所审范围认可。** 它解决旧HeavyWorkBench-10/Hxx字面身份限制；不证明L01题目冻结、真实Provider预检、Task长跑、资源隔离或cleanup端到端已经通过。

## 已核对的实际行为与差异

- 注册只有一个当前Zod实现，launcher直接调用；旧字面断言已删除，未添加旧/新benchmark双路解析或模型路由。
- 根对象与budget对象均passthrough。实际旧H05归档注册、新L01身份以及额外嵌套根/budget元数据均保持值相等；未丢失occurrence、来源、策略或未知元数据。
- total_model_tokens必须明确提供null或安全正整数；没有coerce、默认值或隐含预算。实际纯解析探针验证null不变、正整数17不变、显式inactivitySeconds=1234不变。
- launcher仍只在token字段非null时进入原有计量/取消逻辑。本轮没有引入总墙钟截断；旧的lineage计量、公共cancel、stop文件退出与清理路径没有改变。其它budget字段保持元数据，不由本解析器新增执行政策。
- `listener`与赋给`server`的是同一个Server.listen结果。listener用于已建立运行时的URL/预检/请求，server继续供清理闭包使用；没有第二次监听、第二个服务对象或平行事实源。
- 取消回执数组增加显式TypeScript类型，响应仍按原JSON值完整保存。ready输出重排仅格式变化。
- 本轮差异没有更改Task/Provider/凭据暂存/工具/队列/消息/cleanup实现。审查没有据此扩大认证这些原路径。

## 实际复跑

精确命令、UTC时间、退出码和原始stdout/stderr均在同名JSON及文本：

1. `focused-tests`：实际运行指定`.test.ts`，3 pass、0 fail、4 expect，退出0。旧H05使用真实归档registration；新项读取当前公开L01 profile；错误项验证缺失字段映射到Zod invalid_type及精确路径。
2. `pure-metadata-probe`：仅动态导入纯解析器，验证嵌套元数据、显式null、正整数预算及真实无活动秒数保留，退出0。未导入launcher。
3. `targeted-strict-null-types`：TypeScript5.8.2，三个目标文件、noEmit、strictNullChecks、skipLibCheck，使用已安装的package @types目录，退出0。动态生产模块路径未被当作完整产品类型检查；这是定向检查。
4. `targeted-prettier`：三个目标文件--check，退出0。

Bun测试从本自有目录执行，使用该目录空preload的bunfig，不加载仓库全局测试预载，也没有扫描或运行UI测试。实际Bun版本在原始测试输出中为1.4.3。

## 命令修正与原件保留

`attempt-1-command-discovery/`完整保留最初命令探查。前置--config调用虽退出0但没有测试/探针输出，未被认可为执行证据；首次tsc因根目录未链接@types/bun返回TS2688。随后使用独立cwd自动读取空配置、已有package类型目录，实际复跑得到上述明确结果。没有将该调用方式问题包装成仓库缺陷，也没有覆盖失败原件。

`source-snapshot/`保留审查源码，`launcher.diff.patch`保留本轮launcher差异；`source-identity-after-checks.json`记录执行后与快照的字节身份。字节检查只用于标记所审源码版本，功能结论来自真实测试与差异审查，不以摘要或字节比较代替行为验收。

## 保留边界

没有启动serve脚本，没有访问auth/models文件，没有调用模型或服务。本结论不能替代新题冻结后的原生Inspect真实预检、Provider身份、长期运行、用量归属、自然终态及清理证据。
