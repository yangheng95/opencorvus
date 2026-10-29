# S06实际原生运行：独立非盲结果复核

日期：2026-10-29。Task：`tsk_g00VZR9KuE00aKSMSF10`。

**S06冻结的四项smoke条件均实际通过，可记`smoke_pass`；这是非盲开发管线复核，`comparable=false`。不计入十个重型case，不证明小时级，不批准L06完整成本1%或benchmark成熟。** 本审查未再次委托、未调用Provider/GPU/MILP、未访问运行服务/凭据/推理正文，也未恢复任何暂停容器；仅执行封存的标准库候选程序、已审业务checker和独立标量公式。

## 四项实际结果

| 条件 | 独立核对的实际证据 | 结果 |
| --- | --- | --- |
| native-completion | API Task completed/terminalReason completed，status inactive/running0；原始.eval的header success、completed_samples1、task_completed accuracy1；实际Task请求模型/流式审计 | 通过 |
| sealed-business-feasibility | 两份原始封存计划，用主仓冻结原输入、已审v2 checker和独立标量公式核对 | 通过 |
| known-small-optima | 重新枚举每题648组合/12可行，再核对封存与新复跑计划的精确成本 | base9/2、price-change11/2，通过 |
| full-clean-source-replay | 自有新目录初始只有solve.py、README及两个公开原输入；真实两次执行，随后重验两份新计划 | 通过 |

Inspect的`task_completed=1`只证明生命周期，数学正确由后面三项单独证明。`none/none`是Inspect适配占位模型，不是实际Provider；真实请求审计为openai/gpt-6.1-sol。

## 完整源码冷复跑和精确耗时

执行目录：`cold-replay/`。初始四文件清单在`cold-replay-initial-inventory.json`，旧输出、DB、评估器及oracle均未复制进该目录。原输入直接来自主仓smoke/public/inputs，来源与字节身份记录在`source-inventory.json`。原封存结果只保留在独立评估目录，未给执行程序。

实际公开入口：

```text
C:/Python314/python.exe -B solve.py --input inputs/base.json --output results/base
C:/Python314/python.exe -B solve.py --input inputs/price-change.json --output results/price-change
```

cwd均为本审查的`cold-replay/`，两次均exit0，输出计划及摘要真实生成。四次checker分别核对封存base/新base/封存price-change/新price-change；全部exit0，并以不同实现的独立标量oracle核对最优值、共同首周、采购/装运/生产、阶段/库存、现金与费用。没有要求匹配某个唯一策略或摘要JSON键，也未给README排版加条件。

| 本审查子进程 | 墙钟秒 |
| --- | ---: |
| base源码运行 | 0.1432333998 |
| price-change源码运行 | 0.1410033000 |
| 两次候选程序合计 | 0.2842366998 |
| 四次独立checker合计 | 0.6390908002 |
| 源码运行+checker合计 | **0.9233275000** |

这些是本机真实子进程墙钟，未含人工源码/元数据审查，不是性能排名。原生Task总墙钟由API时间重算为650.922秒，不能当有效思考时长或小时级证据。

题内成本为模拟最小货币单位：base两场景5/4，期望4.5，现金最低96/96；price-change为4/7，期望5.5，现金最低100/98。均与封存和重新生成计划一致。详见`independent-artifact-checks.json`、`business-checks/`及`independent-optima/`。这些不是Provider费用；审计摘要内部recordedCostUSD0也不能解释成真实免费，本轮未做LLM货币成本排名。

源码已逐段阅读：只open传入input，按数据构造有限枚举/精确Fraction递归；output.exists仅用于执行公开的新目录约束，之后写新plan/summary。未读取旧结果，未根据两个文件名硬编码目标值。共享阶段同一动作推进各场景，揭示后保留已承诺库存/在途/现金，逐场景后缀最优。实际两输入重跑支持这里的小例结果，未测试README声称的更大维度性能。

## 真实原生审计、角色和来源身份

我从原始provider-source-reader元数据重新计算，而非只接受main摘要：最后递增快照编号293不是请求数。总请求73，其中API明确Task根session及子session集合内71、单独preflight2。Task的71次全部gpt-6.1-sol、stream=true、HTTP200、identity observed、reader settled/eof；requestContext的provider/API模型也都对应openai/gpt-6.1-sol。见`provider-independent-verification.json`及保留的无正文元数据原件。

原始Inspect .eval只读取`header.json`，未打开samples/message/reasoning正文。eval_id为`LSZsxLyqavbNAdnEnVNGWn`，单样本元数据与API的S06-cheap-smoke-1对应，header结果与主方read_eval_log收据一致。`inspect-independent-header.json`保存字段和来源。主方另记录Windows可选AF_UNIX控制面warning；本轮没有冒称该warning已修复，也没有用warning掩盖实际成功的执行和业务验证。

原生preset实际为orchestrator+一个base-tester delegated-worker，API topology存在真实agent_call边，不能称纯单agent结果。公开TASK写“不需要其他agent”，未冻结单agent比较条件；本次如实保留原生preset角色，不事后添加单agent得分门槛。这不是本审查再次委托，也不等同两个人类专家或盲评。

运行时注册/server-result/worktree记录一致为`9c54d33aafcdbd330631ef2d3391de3f45960c86`，当时工作区有183条dirty状态。该HEAD不能单独代表完整可重建的运行源码，不用旧摘要里的2ac替代。候选独立repo记录HEAD `40487f33083e90d32816eec86368b13c2232b35b`、status[]；本次实际评的是封存源码，冷复跑没有依赖dirty runtime。源码版本限制是保持comparable=false的原因之一。

server-result记录Task结算后停止自有服务，runtimeDisposed/credentialsRemoved均true。本审查只核对该收据，没有读取临时auth/models或查询运行服务，不扩大为用户进程/安全隔离资格认证。

## 证据入口与结论范围

- `stage-assessment.json`：四项实际判定、精确耗时、角色、模型、来源和限制。
- `commands/`：本审查真实执行命令、cwd、exit、stdout/stderr；未重复主方已有复跑。
- `source-snapshot/`、`frozen-inputs/`、`cold-replay/`：封存源/原结果、权威原输入、自有全新复跑及新结果。
- `native-evidence/`、`api-terminal-observation.json`、`inspect-independent-header.json`、`provider-independent-verification.json`：原生终态与实际模型/流式证据；早期pending观察保持原件，最终判定另附。

本轮没有剩余阻断S06四项smoke通过的实质问题。结果只确认这次原生管线和两份微型业务任务真实完成、可由完整源码复跑；未增加重型case完成数、难度分或成熟度认证。
