"""Offline, raw-input-only H05 reproduction and recovery exercise."""

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import platform
import random
import shutil
import sqlite3
import subprocess
import sys
import time

from service import Service, read_events


def reference_facts(events):
    # Test reference groups source payloads independently of the service monitor helper.
    amounts = defaultdict(set)
    counts = Counter()
    for event in events:
        key = (event["tenant"], event["event_id"])
        amounts[key].add(int(event["amount"]))
        counts[key] += 1
    assert all(len(values) == 1 for values in amounts.values()), (
        "source payload conflict"
    )
    return {key: next(iter(values)) for key, values in amounts.items()}, counts


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def table(path, columns, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(columns)
        writer.writerows(rows)


def legacy_worker(inputs, database, mode):
    spec = importlib.util.spec_from_file_location(
        "original_legacy", inputs / "legacy_service.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original = module.Service(str(database))
    first = original.replay(inputs / "records.csv")
    second = original.replay(inputs / "records.csv") if mode == "same-process" else None
    original.close()
    print(
        json.dumps({"pid": __import__("os").getpid(), "first": first, "second": second})
    )


def run(inputs, output):
    started = now()
    elapsed = time.perf_counter()
    cpu_started = time.process_time()
    output.mkdir(parents=True, exist_ok=False)
    verification = output / "verification"
    verification.mkdir()
    (verification / "databases").mkdir()
    # A generated delivery can itself reproduce in another new directory without this workspace.
    for name in ("service.py", "reproduce.py", "verify_delivery.py"):
        shutil.copyfile(Path(__file__).parent / name, output / name)
    shutil.copytree(inputs, output / "inputs")
    inputs = output / "inputs"
    events = read_events(inputs / "records.csv")
    expected, attempts = reference_facts(events)
    tenants = sorted({t for t, _ in expected})
    expected_totals = {
        t: sum(a for (tenant, _), a in expected.items() if tenant == t) for t in tenants
    }
    assert len(events) == 823 and len(expected) == 720
    assert Counter(t for t, _ in expected) == {t: 240 for t in tenants}
    commands = []

    def command(arguments, expected_code=0):
        begin = now()
        process = subprocess.run(
            [sys.executable, *map(str, arguments)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=output,
        )
        record = {
            "command": [sys.executable, *map(str, arguments)],
            "cwd": str(output),
            "started_at": begin,
            "finished_at": now(),
            "exit_code": process.returncode,
            "expected_exit_code": expected_code,
            "stdout": process.stdout,
            "stderr": process.stderr,
        }
        commands.append(record)
        save(verification / "commands.json", commands)
        assert process.returncode == expected_code, record
        return json.loads(process.stdout) if process.stdout.strip() else None

    service_path = output / "service.py"
    raw = inputs / "records.csv"

    def db(name):
        return verification / "databases" / f"{name}.sqlite"

    def ingest(name, *extra):
        return command(
            [service_path, "ingest", "--database", db(name), "--events", raw, *extra]
        )

    comparisons = []

    def compare(name, database=None, wanted=None):
        wanted = expected if wanted is None else wanted
        state = command([service_path, "snapshot", "--database", database or db(name)])
        actual = {(t, e): a for t, e, a in state["ledger"]}
        rows = []
        for key in sorted(wanted.keys() | actual.keys()):
            rows.append(
                [
                    *key,
                    wanted.get(key),
                    actual.get(key),
                    wanted.get(key) == actual.get(key),
                ]
            )
        table(
            verification / "comparisons" / f"{name}.csv",
            ["tenant", "event_id", "expected_amount", "actual_amount", "equal"],
            rows,
        )
        sums = {
            t: sum(a for (tenant, _), a in wanted.items() if tenant == t)
            for t in {t for t, _ in wanted}
        }
        check = {
            "scenario": name,
            "checked_at": now(),
            "identities": len(rows),
            "mismatches": sum(not row[-1] for row in rows),
            "expected_totals": sums,
            "actual_totals": state["totals"],
            "totals_equal": sums == state["totals"],
        }
        comparisons.append(check)
        save(verification / "comparisons.json", comparisons)
        assert actual == wanted and state["totals"] == sums, check
        return state

    # Run the supplied code, not a reimplementation, with durable state across real processes.
    legacy = command(
        [
            output / "reproduce.py",
            "--legacy-worker",
            "same-process",
            "--inputs",
            inputs,
            "--legacy-database",
            db("legacy-v1"),
        ]
    )
    with sqlite3.connect(db("legacy-v1")) as original_db:
        with sqlite3.connect(db("legacy-first")) as preserved_db:
            original_db.backup(preserved_db)
    restarted = command(
        [
            output / "reproduce.py",
            "--legacy-worker",
            "restart",
            "--inputs",
            inputs,
            "--legacy-database",
            db("legacy-v1"),
        ]
    )
    assert legacy["first"] == legacy["second"]
    assert restarted["first"] == {t: 2 * legacy["first"].get(t, 0) for t in tenants}
    save(
        verification / "legacy.json", {"same_process": legacy, "new_process": restarted}
    )
    impact = [
        [
            t,
            expected_totals[t],
            legacy["first"].get(t, 0),
            legacy["first"].get(t, 0) - expected_totals[t],
            restarted["first"].get(t, 0),
            restarted["first"].get(t, 0) - expected_totals[t],
            expected_totals[t],
        ]
        for t in tenants
    ]
    table(
        verification / "impact.csv",
        [
            "tenant",
            "expected",
            "legacy_first",
            "first_delta",
            "legacy_restart",
            "restart_delta",
            "fixed",
        ],
        impact,
    )
    # Every collision includes the original physical CSV line and the global-dedup winner.
    winners, collisions, source_rows = {}, [], []
    for line, event in enumerate(events, 2):
        key = (event["tenant"], event["event_id"])
        source_rows.append([line, *key, event["amount"], event["received_at"]])
        winner = winners.setdefault(
            event["event_id"], (line, event["tenant"], event["amount"])
        )
        if winner[1] != event["tenant"]:
            collisions.append(
                [
                    event["event_id"],
                    winner[0],
                    winner[1],
                    line,
                    event["tenant"],
                    event["amount"],
                ]
            )
    table(
        verification / "collisions.csv",
        [
            "event_id",
            "winner_line",
            "winner_tenant",
            "suppressed_line",
            "suppressed_tenant",
            "amount",
        ],
        collisions,
    )
    table(
        verification / "source_rows.csv",
        ["csv_line", "tenant", "event_id", "amount", "received_at"],
        source_rows,
    )

    replay = []
    winner_totals = {
        tenant: sum(
            int(amount) for _, owner, amount in winners.values() if owner == tenant
        )
        for tenant in tenants
    }
    assert legacy["first"] == winner_totals
    for number in ("1", "2"):
        receipt = ingest("fixed-v2")
        assert receipt["accepted"] == (720 if number == "1" else 0)
        assert receipt["duplicates"] == (103 if number == "1" else 823)
        state = compare(f"full-pass-{number}", db("fixed-v2"))
        replay.append([number, state["distinct"], state["total"]])
    ledger = [[*key, expected[key]] for key in sorted(expected)]
    duplicate_rows = [
        [*key, attempts[key]] for key in sorted(attempts) if attempts[key] > 1
    ]
    for directory in (output, output / "diagnostics"):
        table(
            directory / "ledger.csv", ["tenant", "event_id", "amount"], state["ledger"]
        )
        table(
            directory / "duplicates.csv",
            ["tenant", "event_id", "attempts"],
            duplicate_rows,
        )
        table(
            directory / "totals.csv",
            ["tenant", "total"],
            sorted(state["totals"].items()),
        )
        table(directory / "replay.csv", ["pass", "distinct", "total"], replay)

    # Prefix commits survive an actual interpreter exit. Resume with overlap, not a volatile cursor.
    prefix = ingest("restart", "--stop", "317")
    prefix_expected, _ = reference_facts(events[:317])
    compare("restart-prefix", db("restart"), prefix_expected)
    suffix = ingest("restart", "--start", "280")
    assert prefix["pid"] != suffix["pid"]
    compare("restart")
    save(
        verification / "restart.json",
        {
            "prefix_pid": prefix["pid"],
            "resume_pid": suffix["pid"],
            "prefix_stop": 317,
            "resume_start": 280,
        },
    )

    # Kill inside the real transaction at each boundary, then inspect before redelivery.
    for stage in ("after-ledger", "after-total", "before-commit", "after-commit"):
        name = f"crash-{stage}"
        command(
            [
                service_path,
                "ingest",
                "--database",
                db(name),
                "--events",
                raw,
                "--crash-at",
                stage,
            ],
            86,
        )
        before, _ = reference_facts(events[:1] if stage == "after-commit" else [])
        compare(f"{name}-before-resume", db(name), before)
        ingest(name)
        compare(name)

    reordered = list(events)
    random.Random(20261029).shuffle(reordered)
    shuffled = verification / "reordered.csv"
    table(
        shuffled,
        list(events[0]),
        ([event[k] for k in events[0]] for event in reordered),
    )
    command(
        [service_path, "ingest", "--database", db("reordered"), "--events", shuffled]
    )
    compare("reordered")

    # Four independently running interpreters, all delivering the same complete source.
    initial = Service(db("concurrent"))
    initial.close()
    gate = verification / "concurrent.start"
    processes = []
    for worker in range(4):
        args = [
            sys.executable,
            str(service_path),
            "ingest",
            "--database",
            str(db("concurrent")),
            "--events",
            str(raw),
            "--start-gate",
            str(gate),
        ]
        processes.append(
            (
                subprocess.Popen(
                    args,
                    cwd=output,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8",
                ),
                args,
                now(),
            )
        )
    assert all(p.poll() is None for p, _, _ in processes)
    gate.write_text(now(), encoding="utf-8")
    concurrent = []
    for process, args, begin in processes:
        stdout, stderr = process.communicate(timeout=180)
        record = {
            "command": args,
            "cwd": str(output),
            "started_at": begin,
            "finished_at": now(),
            "pid": process.pid,
            "exit_code": process.returncode,
            "stdout": stdout,
            "stderr": stderr,
        }
        commands.append(record)
        save(verification / "commands.json", commands)
        assert process.returncode == 0, record
        concurrent.append(json.loads(stdout))
    assert len({r["pid"] for r in concurrent}) == 4
    assert sum(r["accepted"] for r in concurrent) == len(expected)
    save(
        verification / "concurrent.json",
        {"workers": concurrent, "gate": str(gate), "all_alive_before_release": True},
    )
    compare("concurrent")

    # Positive contract tests: preserve string identities, reject conflicting amounts atomically.
    unit = Service(db("contract"))
    event = {"tenant": "t", "event_id": "001", "amount": "7"}
    assert unit.ingest(event) and not unit.ingest(event)
    assert unit.ingest({**event, "tenant": "u"})
    assert unit.ingest({**event, "event_id": "1"})
    before = unit.snapshot()
    for bad in (
        {**event, "amount": "8"},
        {**event, "amount": "1.5"},
        {**event, "tenant": ""},
    ):
        try:
            unit.ingest(bad)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid/conflicting event accepted")
        assert unit.snapshot() == before
    try:
        unit.ingest(
            {**event, "event_id": "exception"},
            lambda stage: (_ for _ in ()).throw(RuntimeError("injected")),
        )
    except RuntimeError:
        pass
    assert unit.snapshot() == before
    save(
        verification / "contract.json",
        {
            "canonical_string_identity": before,
            "conflict_and_invalid_rejected": True,
            "exception_rolled_back": True,
        },
    )
    unit.close()
    boundary_events = [
        {"tenant": "t", "event_id": str(i), "amount": "1"} for i in range(9)
    ]
    boundary = Service(db("threshold"))
    for item in boundary_events:
        boundary.ingest(item)
    at_threshold = boundary.monitor(boundary_events + boundary_events[:1])
    above_threshold = boundary.monitor(boundary_events + boundary_events[:2])
    assert at_threshold["alerts"] == []
    assert above_threshold["alerts"] == ["duplicate_rate_high"]
    save(
        verification / "threshold.json",
        {"at_threshold": at_threshold, "above_threshold": above_threshold},
    )
    boundary.close()

    # Executable monitors: observed duplicate warning, reconciliation fault, then recovery.
    baseline_monitor = command(
        [service_path, "monitor", "--database", db("fixed-v2"), "--events", raw], 2
    )
    assert baseline_monitor["alerts"] == ["duplicate_rate_high"]
    unique = verification / "unique.csv"
    table(unique, ["tenant", "event_id", "amount"], ledger)
    recovered_monitor = command(
        [service_path, "monitor", "--database", db("fixed-v2"), "--events", unique]
    )
    assert recovered_monitor["alerts"] == []
    ingest("monitor-fault")
    with sqlite3.connect(db("monitor-fault")) as connection:
        connection.execute(
            "UPDATE totals SET amount=amount+1 WHERE tenant=?", (tenants[0],)
        )
    totals_alarm = command(
        [
            service_path,
            "monitor",
            "--database",
            db("monitor-fault"),
            "--events",
            unique,
        ],
        2,
    )
    assert totals_alarm["alerts"] == ["ledger_reconciliation_failed"]
    with sqlite3.connect(db("monitor-fault")) as connection:
        connection.execute(
            "DELETE FROM ledger WHERE tenant=? AND event_id=?", tuple(ledger[0][:2])
        )
    missing_alarm = command(
        [
            service_path,
            "monitor",
            "--database",
            db("monitor-fault"),
            "--events",
            unique,
        ],
        2,
    )
    assert missing_alarm["tenants"][0]["identity_mismatches"] == 1
    ingest("monitor-balanced-fault")
    with sqlite3.connect(db("monitor-balanced-fault")) as connection:
        connection.execute(
            "UPDATE ledger SET event_id=? WHERE tenant=? AND event_id=?",
            ("wrong-identity", *ledger[0][:2]),
        )
    balanced_alarm = command(
        [
            service_path,
            "monitor",
            "--database",
            db("monitor-balanced-fault"),
            "--events",
            unique,
        ],
        2,
    )
    assert balanced_alarm["tenants"][0]["identity_mismatches"] == 2
    assert all(
        row["source_ledger_delta"] == row["ledger_totals_delta"] == 0
        for row in balanced_alarm["tenants"]
    )
    # Recover by rebuilding into a fresh version, never by adding old totals to the repaired ledger.
    ingest("monitor-rebuilt")
    compare("monitor-rebuilt")
    command(
        [
            service_path,
            "monitor",
            "--database",
            db("monitor-rebuilt"),
            "--events",
            unique,
        ]
    )
    save(
        verification / "monitor.json",
        {
            "raw_window": baseline_monitor,
            "unique_window": recovered_monitor,
            "totals_fault": totals_alarm,
            "missing_identity": missing_alarm,
            "balanced_wrong_identity": balanced_alarm,
            "recovery_database": str(db("monitor-rebuilt")),
            "fault_injection": [
                "alpha totals +1",
                "delete first ledger identity",
                "replace identity without amount change",
            ],
        },
    )

    # Persisted route is an isolated writer selector, not a claim about production routing.
    route = verification / "route.json"
    routing = []

    def change_route(release, enabled):
        value = {
            "release": release,
            "write_enabled": enabled,
            "database": "databases/fixed-v2.sqlite",
        }
        temporary = route.with_suffix(".next")
        save(temporary, value)
        temporary.replace(route)
        routing.append({"at": now(), **value})

    change_route("fixed-v2-cutover", True)
    command([service_path, "ingest", "--route", route, "--events", raw])
    compare("cutover", db("fixed-v2"))
    change_route("fixed-v2-rollback-read-only", False)
    command([service_path, "ingest", "--route", route, "--events", raw], 3)
    paused_probe = verification / "paused-probe.csv"
    table(
        paused_probe,
        ["tenant", "event_id", "amount"],
        [[tenants[0], "never-post-while-paused", 1]],
    )
    command([service_path, "ingest", "--route", route, "--events", paused_probe], 3)
    compare("rollback-read-only", db("fixed-v2"))
    change_route("fixed-v2-resumed", True)
    command([service_path, "ingest", "--route", route, "--events", raw])
    final_state = compare("resumed", db("fixed-v2"))
    save(
        verification / "cutover.json",
        {
            "transitions": routing,
            "rollback_policy": "pause writes; preserve fixed ledger; never route to legacy",
        },
    )

    # Original evidence timeline, independent of processing wall-clock timestamps.
    receipt_min = min(e["received_at"] for e in events)
    receipt_max = max(e["received_at"] for e in events)
    inversions = sum(
        events[i]["received_at"] < events[i - 1]["received_at"]
        for i in range(1, len(events))
    )
    timeline = {
        "scenario_clock": json.loads(
            (inputs / "context.json").read_text(encoding="utf-8")
        )["clock"],
        "received_at_min": receipt_min,
        "received_at_max": receipt_max,
        "adjacent_receipt_inversions_in_file": inversions,
        "business_event_time": "unknown: no business-time field",
        "historical_processing_time": "unknown: no historical execution log",
        "drill_started_at": started,
        "drill_finished_at": now(),
        "evidence": [
            "inputs/records.csv",
            "verification/source_rows.csv",
            "verification/commands.json",
        ],
    }
    save(verification / "timeline.json", timeline)
    save(
        verification / "entrypoints.json",
        {
            "import": "Service.ingest: composite key, BEGIN IMMEDIATE, ledger+totals COMMIT",
            "replay": "Service.replay -> Service.ingest; full-pass-1/full-pass-2",
            "restart": "CLI ingest -> replay -> ingest; two child PIDs, overlapping source range",
            "concurrent": "four CLI interpreters -> replay -> ingest; common start gate",
            "route": "CLI route selection -> same Service; write pause before opening writer",
            "legacy": "input original executed only as baseline; never selected for fixed writes",
        },
    )
    reconciliation = {
        "old_version": "legacy-v1",
        "old_first": legacy["first"],
        "old_after_restart": restarted["first"],
        "new_version": "fixed-v2",
        "new_totals": final_state["totals"],
        "source_expected": expected_totals,
        "method": "rebuild from raw business identities into empty database; retain legacy database",
        "old_totals_imported": False,
    }
    save(verification / "historical-rebuild.json", reconciliation)
    storage = []
    for database in sorted((verification / "databases").glob("*.sqlite")):
        connection = sqlite3.connect(database)
        try:
            checkpoint = connection.execute(
                "PRAGMA wal_checkpoint(TRUNCATE)"
            ).fetchone()
            assert checkpoint[0] == 0, (database, checkpoint)
            integrity = connection.execute("PRAGMA integrity_check").fetchall()
            assert integrity == [("ok",)], (database, integrity)
            storage.append(
                {
                    "database": database.name,
                    "checkpoint": checkpoint,
                    "integrity": "ok",
                    "standalone_main_database": True,
                }
            )
        finally:
            connection.close()
    save(verification / "storage.json", storage)
    summary = {
        "started_at": started,
        "finished_at": now(),
        "wall_seconds": time.perf_counter() - elapsed,
        "parent_cpu_seconds": time.process_time() - cpu_started,
        "resource_measurement_scope": "parent CPU only; wall includes children; no memory claim",
        "python": platform.python_version(),
        "sqlite": sqlite3.sqlite_version,
        "platform": platform.platform(),
        "transmissions": len(events),
        "distinct": len(expected),
        "extra_duplicates": len(events) - len(expected),
        "duplicated_identities": len(duplicate_rows),
        "totals": expected_totals,
        "replay": replay,
        "comparisons": comparisons,
        "command_count": len(commands),
        "independent_reviews": "pending: coordinator assigns two reviewers",
        "resource_policy": "record only; no CPU, memory or aggregate output cutoff",
    }
    save(verification / "summary.json", summary)
    write_reports(output, summary, impact, collisions, timeline)
    print(
        json.dumps(
            {
                "output": str(output),
                "commands": len(commands),
                "comparisons": len(comparisons),
                "distinct": len(expected),
                "totals": expected_totals,
                "status": "self-check-passed",
            }
        )
    )


def write_reports(output, summary, impact, collisions, timeline):
    impact_table = "\n".join("|" + "|".join(map(str, row)) + "|" for row in impact)
    examples = "\n".join(
        f"- {r[0]}：原CSV第{r[1]}行 {r[2]} 先占全局键；第{r[3]}行 {r[4]} 的 {r[5]} 被抑制。"
        for r in collisions[:5]
    )
    incident = f"""# H05 虚构支付事故报告

## 业务结论与范围
本报告仅描述题目隔离样例和实测演练，不是实际生产事故。金额均为整数最小货币单位，币种未知，不转换为元。
原输入 {summary["transmissions"]} 次传输，对应720个业务身份、三租户各240个；额外重复103次，涉及{summary["duplicated_identities"]}个身份。
正确身份是 `(tenant,event_id)`。业务账本已从原始事件重建；以下偏差为“观测值减正确值”，负数代表漏记。

|租户|正确金额|旧首次|首次差额|旧重启重放后|重启后差额|修复金额|
|---|---:|---:|---:|---:|---:|---:|
{impact_table}

上述是模拟服务收入汇总差错，不证明真实资金收付损失。全部三租户均纳入比较。
证据：`verification/impact.csv`、`legacy.json`、`historical-rebuild.json`、最终`totals.csv`。

## 事实时间线
- 场景参考钟：{timeline["scenario_clock"]}，仅来自context，不当作真实事故发生时刻。
- 原始received_at范围：{timeline["received_at_min"]} 至 {timeline["received_at_max"]}。这是接收时间字段，不是业务发生时间或执行时间。
- 物理CSV行序是本次首次导入顺序；相邻received_at倒序{timeline["adjacent_receipt_inversions_in_file"]}处。`verification/source_rows.csv`逐行保留定位。
- 业务事件发生时间、历史处理时间、首次发现者、生产中断持续时长均未知，输入没有这些证据。
- 本次演练UTC开始 {summary["started_at"]}，结束 {summary["finished_at"]}；每次命令起止、退出码和子进程输出见`verification/commands.json`。这些不是历史事故时间。

## 根因与可复查实例
`inputs/legacy_service.py`第14行建立内存seen，第17–19行只以event_id去重，第20–24行仅将totals持久提交。
跨租户共享event_id时，先到租户占用全局键，其他租户独立业务被误认为重复，造成漏记。例如：
{examples}
全部跨租户抑制记录见`verification/collisions.csv`。同身份重复金额已从完整原始输入核对一致。

原代码在同一对象连续重放两次，第二次不增加；真实新解释器重开同一旧数据库重放，seen为空而totals仍在，每租户累计恰为旧首次的两倍。
见`verification/legacy.json`及实际子进程命令记录。重放后的数值仍不正确，不能把“增记”误说成完整业务账本重复了两倍。
seen先写内存再提交金额也不原子：若金额提交失败而进程继续，seen可能抑制未入账事件。这是由代码推导的机制，不声称本次复现了旧服务该历史故障。

## 修复与恢复证据
`service.py`以SQLite联合主键持久保存ledger，BEGIN IMMEDIATE内先查同身份金额，插入ledger与更新totals后共同COMMIT。
冲突金额拒绝且不改账；同event_id跨租户不互斥；字符串001与1不合并。没有单独的内存去重真相源。
每个入口均复用ingest，覆盖清单见`verification/entrypoints.json`。ledger是业务事实，totals是同事务维护的派生汇总。

- 原序两次全量：`replay.csv`两行均为720与{sum(summary["totals"].values())}，逐键比较见`comparisons/full-pass-*.csv`。
- 真重启：一个子进程提交前317次传输后退出，另一进程从280位置重叠续传；PID和前缀账本、最终逐键比较见`restart.json`与`comparisons/restart*.csv`。
- 原子性：分别在ledger插入后、totals更新后、提交前、提交后直接os._exit(86)。前三种恢复前均无半笔，提交后保留完整首笔；重投均收敛720身份。见commands及`comparisons/crash-*.csv`。
- 四进程在共同启动门释放前均存活，各投递同一823行；合计新入账720，最终逐键一致。见`concurrent.json`和`comparisons/concurrent.csv`。
- 固定种子乱序与原序均逐身份、逐金额、逐租户汇总比较同一原始身份映射，不用总额相等代替账本比较。见`comparisons/reordered.csv`。
- 异常回滚、字符串身份及冲突拒绝的正向合同检查见`contract.json`。

上述未带前缀的JSON及comparisons路径均相对verification目录；四张结果表在交付根目录。断电、磁盘损毁、跨机分布式一致性和高负载容量没有实测，不从进程死亡演练外推。

## 历史重建、监控和发布
保留`verification/databases/legacy-first.sqlite`首次事实备份、`legacy-v1.sqlite`重启重放后的旧事实及旧结果，不把错误旧totals叠加新账。新fixed-v2从原始事件空库重建，三租户对账见historical-rebuild.json。
duplicates.csv只统计原始823行，不把二次重放、并发、故障重投计入传输重复诊断。

监控窗口重复率=(传输数-业务身份数)/传输数；本窗口103/823={103 / 823:.6%}，阈值严格>10%告警。
这是演练阈值而非真实业务SLA。源期望与ledger逐身份核对，并比较每租户源金额、ledger金额及totals金额；任一身份差或金额差非0告警。
原始窗口重复率告警命中、唯一事件新窗口清除；隔离监控库totals+1、删除一身份及同金额替换错误身份均触发对账告警；后者总额不变但身份差2。重建新版本后恢复。见monitor.json和退出码2/0；threshold.json验证恰好10%不告警、超过才告警。
窗口切换不是消除历史103次重复的声称。禁止以提高阈值遮盖偏差。

隔离路由切换到fixed-v2，重投后账本不变；回滚为修复账本只读停写，写请求退出3；再次恢复修复写入仍逐键一致。
不恢复有缺陷旧写入。见cutover.json、route.json、comparisons/cutover.csv、rollback-read-only.csv、resumed.csv。
本地路由演练不代表真实在线多节点切换；真实部署需停写/排空与权限隔离。

## 责任动作与剩余风险
|角色（非真实签字）|动作|验收证据|
|---|---|---|
|服务负责人|部署联合键与原子事务，禁止旧写入口|入口审计、故障/并发逐键比较|
|财务对账负责人|按三租户复核重建金额并保留旧版|impact.csv、historical-rebuild.json|
|值班/发布负责人|监控告警、停写回滚、恢复前对账|monitor.json、cutover.json、runbook.md|
|协调方安排的两位独立审查者|分别从原始输入复算并审查实际文件|尚待安排，不能以作者自检代替|

当前剩余风险：仅覆盖单机SQLite隔离样例；未测真实断电/磁盘故障/备份介质恢复、容量及多币种；完整原始事件源可用性是重建前提。
本题同身份金额不变；未来修订业务需独立业务协议，不能静默覆盖。实际生产权限、发布审批、历史时刻和真实责任人未知。
双人独立审查尚未完成；不宣称评分、生产上线或任务最终验收通过。

## 重复执行与方法来源
`python reproduce.py --inputs inputs --output <不存在的新目录>`。新目录包含源码、原始输入、四表、报告、SQLite事实及完整演练记录，可再次在新路径复跑。
本次作者自检命令数{summary["command_count"]}，逐键比较场景{len(summary["comparisons"])}个；详情以机器记录为准。
仅离线使用随包`inputs/source-notes.md`第4项对SQLite原子提交的方法定位（https://sqlite.org/atomiccommit.html）；没有联网核读网页，未引入外部研究结论。
资源只记录耗时、环境及执行输出，不作为提前结束条件。独立审查和真实生产验证不是本报告已完成事项。
"""
    (output / "incident.md").write_text(incident, encoding="utf-8")
    runbook = f"""# H05 隔离样例发布与恢复操作手册

## 边界与准备
仅运行本题隔离服务。需本机Python 3及标准库sqlite3；不需要第三方包、网络、凭据或外部模型。
保留inputs原样，amount为整数最小单位，身份字符串不转换。禁止将旧totals导入新账或重启旧写入作为回滚。
角色为职责分配建议，不是实际人员签字。业务/事件历史时间未知，不填造历史时间。

## 从零复现与验收
1. 在交付目录运行 `python reproduce.py --inputs inputs --output fresh-run`；fresh-run必须不存在。
2. 退出0且输出self-check-passed表示作者机器检查完成，不代表双人独立验收。失败要保留目录和commands.json定位，不覆盖证据。
3. 核对fresh-run/verification/legacy.json：同进程两次相等，新进程在原旧库上增至两倍。impact.csv逐租户量化差额。
4. 核对ledger.csv每身份一行、totals.csv按租户为{summary["totals"]}；replay.csv pass字符串1和2均distinct720、total{sum(summary["totals"].values())}。
5. 比较verification/comparisons所有逐身份记录；检查comparisons.json所有mismatches=0、totals_equal=true。
6. 检查崩溃退出86，恢复前前三边界为空、提交后首笔存在；恢复后完整账本。检查restart.json不同PID、concurrent.json四PID和新入账合计720。
7. 由协调方安排两位独立审查者分别从raw inputs复算、检查报告和runbook、实际执行新路径复跑；作者不得代签。

## 修复服务入口
`python service.py ingest --database isolated.sqlite --events inputs/records.csv`
重启续传、重放、并发均使用同一命令；--start/--stop是零起始传输行切片，不含CSV表头。恢复可全量重投，不能依赖易失游标。
`python service.py snapshot --database isolated.sqlite` 给出同一事务读到的账本与totals。
冲突金额会拒绝且事务回滚；先隔离冲突事件调查，不静默覆盖。不要用另一实现绕过去重。

## 监测与告警
`python service.py monitor --database isolated.sqlite --events inputs/records.csv`
退出0无告警，2有告警；重复率严格大于0.10触发duplicate_rate_high，任一身份差或金额差非0触发ledger_reconciliation_failed。
源期望是该账本覆盖范围的完整raw集合；不能用不完整窗口对完整账本对账。重复率可用单独有界传输窗口，但对账源必须覆盖账本。
本题原始窗口会预期触发重复率告警：103/823；需调查上游重试，不改变业务金额。
监控演练用verification/unique.csv表示后续无重复窗口；对账仍覆盖全部身份。
对账告警：发布负责人停写；财务按租户复算；服务负责人保全故障库并从raw重建新库，逐键比较后恢复。
禁止直接修改totals掩盖问题。verification/monitor.json记录故障注入和恢复，不用于生产破坏。

## 隔离切换与安全回滚
reproduce自动执行真实CLI路由演练，verification/cutover.json保留每步配置。
路由JSON含database相对路由文件所在目录的路径、write_enabled布尔、release标签。通过临时文件原子replace更新路由。
1. 停止旧写入并保留legacy-v1.sqlite旧事实；本演练原服务子进程已退出，不再作为writer。
2. 空库fixed-v2从raw重建；财务逐身份对账，三租户各240身份；故障、并发与重放检查通过后才切换。
3. 将路由指向fixed-v2、write_enabled=true；CLI ingest --route verification/route.json --events inputs/records.csv，核对不增账。
4. 若需回滚，路由仍指向同一修复库，write_enabled=false；写请求退出3，snapshot可读，逐键核对账本不变。旧实现禁止写入。
5. 完成调查并重新对账后恢复true，同一原始数据重投，应无新增；保存命令、PID、时刻、差额与审批记录。
演练最终路由为fixed-v2-resumed。路由使用相对路径，移动完整交付目录后仍指向该目录内同一修复账本。新一轮演练仍必须在不存在的新目录复跑。
本选择器只适用于隔离CLI，无在线常驻进程。真实多节点需额外写入栅栏、停写排空、备份恢复演练与业务审批；本题不声称完成。

## 数据保全与审计
新账依据raw身份重建，不按received_at排序修补数字。保留legacy-v1和fixed-v2版本、impact、historical-rebuild及commands原始记录。
duplicates只来自原始输入attempts，不来自测试重投。所有最终四表在根目录和diagnostics各一份。
commands记录实际时间、命令、工作目录、退出码和输出；比较CSV列出每个身份期望和实值；未知历史时间仍未知。
资源耗时见summary.json；未设置CPU、内存或输出总量提前结束条件。没有外部联网赛道。
"""
    (output / "runbook.md").write_text(runbook, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--legacy-worker", choices=["same-process", "restart"])
    parser.add_argument("--legacy-database", type=Path)
    args = parser.parse_args()
    if args.legacy_worker:
        legacy_worker(
            args.inputs.resolve(), args.legacy_database.resolve(), args.legacy_worker
        )
    else:
        if args.output is None:
            parser.error("--output is required")
        run(args.inputs.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
