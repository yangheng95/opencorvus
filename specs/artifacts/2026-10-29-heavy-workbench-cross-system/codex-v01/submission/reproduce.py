"""Rebuild H05 from raw inputs, executable source and a new output directory.

No saved business tables or databases are read from earlier runs. Python stdlib only.
"""

import argparse
import collections
import csv
import json
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from reporting import build_reports


def now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def save(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def table(path, fields, rows):
    with Path(path).open("w", newline="", encoding="utf8") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(fields)
        writer.writerows(rows)


def event_table(path, rows):
    table(path, ["tenant", "event_id", "amount", "received_at"],
          [[row[k] for k in ("tenant", "event_id", "amount", "received_at")] for row in rows])


class Runner:
    def __init__(self, output):
        self.output = output
        self.logs = output / "verification" / "commands"
        self.logs.mkdir(parents=True)
        self.commands, self.checks = [], []
        self.env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}

    def start(self, label, argv):
        command = [sys.executable, *map(str, argv)]
        record = {"label": label, "argv": command, "cwd": str(self.output), "started_at": now()}
        proc = subprocess.Popen(command, cwd=self.output, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf8")
        record["pid"] = proc.pid
        return proc, record

    def finish(self, running, expected=0):
        proc, record = running
        stdout, stderr = proc.communicate()
        record.update({"finished_at": now(), "exit_code": proc.returncode, "expected_exit_code": expected})
        (self.logs / (record["label"] + ".stdout.txt")).write_text(stdout, encoding="utf8")
        (self.logs / (record["label"] + ".stderr.txt")).write_text(stderr, encoding="utf8")
        record["stdout"] = "commands/" + record["label"] + ".stdout.txt"
        record["stderr"] = "commands/" + record["label"] + ".stderr.txt"
        self.commands.append(record)
        save(self.output / "verification/commands.json", self.commands)
        if proc.returncode != expected:
            raise RuntimeError(f"{record['label']}: exit {proc.returncode}, expected {expected}: {stderr}")
        print(f"{record['label']}: exit={proc.returncode}", flush=True)
        return json.loads(stdout) if stdout.strip().startswith("{") else stdout

    def run(self, label, argv, expected=0):
        return self.finish(self.start(label, argv), expected)

    def check(self, label, condition, evidence):
        self.checks.append({"check": label, "passed": bool(condition), "evidence": evidence, "observed_at": now()})
        save(self.output / "verification/checks.json", self.checks)
        if not condition:
            raise AssertionError(f"{label}: {evidence}")

    def service(self, label, command, **kwargs):
        args = [self.output / "service.py", command]
        expected = kwargs.pop("exit", 0)
        for k, v in kwargs.items():
            args.extend(["--" + k.replace("_", "-"), v])
        return self.run(label, args, expected)

    def check_db(self, label, path, reference, attempts=None):
        with sqlite3.connect(Path(path).as_uri() + "?mode=ro", uri=True) as database:
            actual = {(t, e): a for t, e, a in database.execute("SELECT tenant,event_id,amount FROM ledger")}
            actual_attempts = {(t, e): a for t, e, a in database.execute("SELECT tenant,event_id,attempts FROM ledger")}
            totals = dict(database.execute("SELECT tenant,amount FROM totals"))
            integrity = database.execute("PRAGMA integrity_check").fetchone()[0]
            view_type = database.execute("SELECT type FROM sqlite_master WHERE name='totals'").fetchone()[0]
        expected_totals = dict(collections.Counter())
        for (tenant, _), amount in reference.items():
            expected_totals[tenant] = expected_totals.get(tenant, 0) + amount
        evidence = {"database": str(path.relative_to(self.output)), "distinct": len(actual), "total": sum(actual.values()),
                    "tenants": totals, "expected_tenants": expected_totals, "attempts": sum(actual_attempts.values()),
                    "missing": len(reference.keys() - actual.keys()), "extra": len(actual.keys() - reference.keys()),
                    "wrong_amounts": sum(reference[k] != actual[k] for k in reference.keys() & actual.keys()),
                    "integrity": integrity, "totals_object_type": view_type,
                    "attempt_mismatches": sum(actual_attempts.get(k) != v for k, v in attempts.items()) if attempts is not None else None}
        self.check(label, actual == reference and totals == expected_totals and integrity == "ok" and view_type == "view" and (attempts is None or actual_attempts == attempts), evidence)
        return evidence


def parallel_replays(runner, label, mode, database, events, inputs, count):
    # Initialize once; each contender then has a separate OS process and SQLite connection.
    root = runner.output / "verification" / "barriers" / label
    root.mkdir(parents=True)
    release = root / "release"
    jobs = []
    try:
        for i in range(count):
            ready = root / f"ready-{i}.json"
            argv = [runner.output / "exercise_worker.py", mode, "--database", database, "--events", events,
                    "--inputs", inputs, "--ready", ready, "--release", release]
            jobs.append((ready, runner.start(f"{label}-{i}", argv)))
        started = time.monotonic()
        while not all(ready.exists() for ready, _ in jobs):
            if time.monotonic() - started > 40:
                raise RuntimeError("concurrency workers did not reach the ready barrier")
            if any(proc.poll() is not None for _, (proc, _) in jobs):
                raise RuntimeError("concurrency worker exited before release")
            time.sleep(0.02)
        save(release, {"released_at": now(), "ready": [json.loads(p.read_text()) for p, _ in jobs]})
        results = [runner.finish(job) for _, job in jobs]
    except BaseException:
        release.touch(exist_ok=True)
        for _, (proc, _) in jobs:
            if proc.poll() is None:
                proc.terminate()  # Only children created by this isolated exercise.
            proc.communicate()
        raise
    runner.check(label + "-independent-processes", len({r["pid"] for r in results}) == count,
                 {"pids": [r["pid"] for r in results], "barrier": str(release.relative_to(runner.output))})
    return results


def reference_of(rows):
    reference, attempts = {}, collections.Counter()
    for row in rows:
        key, amount = (row["tenant"], row["event_id"]), int(row["amount"])
        if key in reference and reference[key] != amount:
            raise ValueError(f"raw input amount conflict for {key!r}")
        reference[key] = amount
        attempts[key] += 1
    return reference, dict(attempts)


def activate(pointer, database, generation):
    replacement = pointer.with_suffix(".new")
    save(replacement, {"database": str(database), "service_version": "1.0.0", "generation": generation, "activated_at": now()})
    os.replace(replacement, pointer)


def reproduce(inputs, output):
    started, monotonic = now(), time.monotonic()
    source = Path(__file__).resolve().parent
    inputs, output = inputs.resolve(), output.resolve()
    if output == source or inputs == output or inputs in output.parents and output.name == "inputs":
        raise ValueError("choose a separate new output directory")
    for required in ("records.csv", "legacy_service.py", "context.json", "source-notes.md"):
        if not (inputs / required).is_file():
            raise ValueError(f"missing raw input {required}")
    rows = list(csv.DictReader((inputs / "records.csv").open(encoding="utf-8-sig", newline="")))
    reference, attempts = reference_of(rows)
    context = json.loads((inputs / "context.json").read_text(encoding="utf8"))
    if context["case"] != "H05":
        raise ValueError("this reproduction implements the H05 contract")
    output.mkdir(parents=True, exist_ok=False)
    for name in ("service.py", "reproduce.py", "exercise_worker.py", "test_service.py", "reporting.py", "verify_delivery.py", "monitor-policy.json"):
        shutil.copyfile(source / name, output / name)
    dbs = output / "verification/databases"
    dbs.mkdir(parents=True)
    generated = output / "verification/generated-inputs"
    generated.mkdir()
    runner = Runner(output)
    runner.run("unit-contracts", [output / "test_service.py"])
    audit = {"records": len(rows), "business_identities": len(reference), "extra_transmissions": len(rows) - len(reference),
             "duplicate_identities": sum(v > 1 for v in attempts.values()),
             "tenant_attempts": dict(collections.Counter(r["tenant"] for r in rows)),
             "received_at_min": min(r["received_at"] for r in rows), "received_at_max": max(r["received_at"] for r in rows),
             "adjacent_received_at_regressions": sum(rows[i]["received_at"] < rows[i-1]["received_at"] for i in range(1, len(rows))),
             "event_business_time": "unknown: source has no event_at", "original_processing_time": "unknown",
             "e0028_rows": [{"csv_line": i+2, **r} for i, r in enumerate(rows) if r["event_id"] == "E0028"]}
    save(output / "verification/input-audit.json", audit)
    table(output / "verification/source-timeline.csv", ["csv_line", "tenant", "event_id", "amount", "received_at", "business_time", "original_processing_time"],
          [(i+2, r["tenant"], r["event_id"], r["amount"], r["received_at"], "unknown", "unknown") for i, r in enumerate(rows)])
    legacy = runner.run("legacy-original", [output / "exercise_worker.py", "legacy", "--inputs", inputs, "--output", output / "verification/legacy"])
    computed_legacy = collections.Counter()
    winner_ids = set()
    for row in rows:
        if row["event_id"] not in winner_ids:
            computed_legacy[row["tenant"]] += int(row["amount"])
            winner_ids.add(row["event_id"])
    runner.check("legacy-measured-vs-code-attribution", legacy["first"] == dict(computed_legacy) and legacy["same_process_replay"] == dict(computed_legacy)
                 and legacy["restart_once"] == {t: v*2 for t, v in computed_legacy.items()}
                 and legacy["restart_twice"] == {t: v*3 for t, v in computed_legacy.items()},
                 {k: legacy[k] for k in ("first", "same_process_replay", "restart_once", "restart_twice")})
    runner.check("legacy-failed-write-retry-measured", legacy["write_failure"]["injected_error"] == "injected-write-failure"
                 and legacy["write_failure"]["totals_after_retry"] == {}, legacy["write_failure"])

    raw = inputs / "records.csv"
    primary = dbs / "ledger.sqlite"
    first = runner.service("fixed-pass1", "replay", database=primary, events=raw)
    runner.check_db("first-pass-full-identities-and-attempts", primary, reference, attempts)
    runner.service("export-business-tables", "export", database=primary, output=output)
    replay_db = dbs / "replay.sqlite"
    runner.service("replay-persistent-copy", "backup", source=primary, destination=replay_db)
    second = runner.service("fixed-pass2-new-process", "replay", database=replay_db, events=raw)
    runner.check_db("second-pass-full-identities-and-attempts", replay_db, reference, {k: v*2 for k, v in attempts.items()})
    table(output / "replay.csv", ["pass", "distinct", "total"], [("1", first["state"]["distinct"], first["state"]["total"]), ("2", second["state"]["distinct"], second["state"]["total"])])
    runner.check("second-pass-inserted-duplicate-contract", second["inserted"] == 0 and second["duplicates"] == len(rows), second)

    split = len(rows) // 2
    event_table(generated / "prefix.csv", rows[:split])
    event_table(generated / "suffix.csv", rows[split:])
    restart_db = dbs / "restart.sqlite"
    prefix = runner.service("restart-before", "replay", database=restart_db, events=generated / "prefix.csv")
    prefix_reference, prefix_attempts = reference_of(rows[:split])
    runner.check_db("restart-prefix-state", restart_db, prefix_reference, prefix_attempts)
    suffix = runner.service("restart-after", "replay", database=restart_db, events=generated / "suffix.csv")
    runner.check_db("restart-final-state", restart_db, reference, attempts)
    runner.check("restart-separate-processes", runner.commands[-1]["pid"] != next(r["pid"] for r in runner.commands if r["label"] == "restart-before"), {"prefix": prefix, "suffix": suffix})

    for label, ordered in (("reversed", list(reversed(rows))), ("received-order", sorted(rows, key=lambda r: (r["received_at"], r["tenant"], r["event_id"])))):
        event_table(generated / (label + ".csv"), ordered)
        runner.service(label, "replay", database=dbs / (label + ".sqlite"), events=generated / (label + ".csv"))
        runner.check_db(label + "-state", dbs / (label + ".sqlite"), reference, attempts)

    concurrent_db = dbs / "concurrent.sqlite"
    runner.service("concurrency-initialize", "status", database=concurrent_db)
    parallel_replays(runner, "fixed-concurrency", "concurrent", concurrent_db, raw, inputs, 4)
    runner.check_db("four-process-race-full-state", concurrent_db, reference, {k: v*4 for k, v in attempts.items()})
    event_table(generated / "single.csv", rows[:1])
    legacy_concurrent_db = dbs / "legacy-concurrent.sqlite"
    with sqlite3.connect(legacy_concurrent_db) as connection:
        connection.execute("CREATE TABLE totals(tenant TEXT PRIMARY KEY, amount INTEGER NOT NULL)")
    legacy_race = parallel_replays(runner, "legacy-concurrency", "legacy-concurrent", legacy_concurrent_db, generated / "single.csv", inputs, 4)
    with sqlite3.connect(legacy_concurrent_db) as connection:
        race_totals = dict(connection.execute("SELECT tenant,amount FROM totals"))
    runner.check("legacy-concurrency-repeat-measured", race_totals == {rows[0]["tenant"]: int(rows[0]["amount"])*4}, {"actual_totals": race_totals, "workers": legacy_race})

    crash_observations = {}
    for stage, expected_exit in (("before", 73), ("after", 74)):
        database = dbs / ("crash-" + stage + ".sqlite")
        runner.run("crash-" + stage, [output / "exercise_worker.py", f"crash-{stage}-commit", "--database", database,
                   "--events", generated / "single.csv", "--output", output / f"verification/crash-{stage}.json"], expected_exit)
        observed = runner.service("crash-" + stage + "-reopen", "status", database=database)
        one_reference, one_attempts = reference_of(rows[:1])
        runner.check_db("crash-" + stage + "-durable-checkpoint", database, {} if stage == "before" else one_reference,
                        {} if stage == "before" else one_attempts)
        runner.service("crash-" + stage + "-resume", "replay", database=database, events=raw)
        after_attempts = dict(attempts)
        if stage == "after":
            for key in one_reference:
                after_attempts[key] += 1
        runner.check_db("crash-" + stage + "-recovered", database, reference, after_attempts)
        crash_observations[stage] = observed

    # Migration preserves all legacy data, rebuilding identity from the archive rather than totals.
    legacy_first = output / "verification/legacy/legacy-first.sqlite"
    migrated_db = dbs / "migrated.sqlite"
    archived_db = dbs / "legacy-archive.sqlite"
    migration = runner.service("automatic-migration", "migrate", legacy_database=legacy_first, events=raw, database=migrated_db, archive=archived_db)
    runner.check_db("migrated-full-state", migrated_db, reference, attempts)
    with sqlite3.connect(legacy_first) as old, sqlite3.connect(archived_db) as archive:
        old_data, archive_data = list(old.iterdump()), list(archive.iterdump())
    runner.check("legacy-archive-preserves-schema-and-all-data", old_data == archive_data, {"sql_dump_statements": len(old_data), "legacy_totals": migration["old_totals"]})
    save(output / "verification/migration.json", migration)

    # Rehearse a real pause/snapshot/cutover/post-switch delivery/restore/catch-up sequence.
    rollout = output / "verification/rollout"
    rollout.mkdir()
    old_active = dbs / "rollout-pre-switch.sqlite"
    runner.service("rollout-prefix", "replay", database=old_active, events=generated / "prefix.csv")
    pointer = rollout / "active.json"
    activate(pointer, old_active, "pre-switch")
    before_switch = runner.run("active-before-switch", [output / "exercise_worker.py", "active-client", "--pointer", pointer])
    snapshot = dbs / "rollout-snapshot.sqlite"
    runner.service("rollout-snapshot", "backup", source=old_active, destination=snapshot)
    candidate = dbs / "rollout-candidate.sqlite"
    runner.service("rollout-candidate", "restore", source=snapshot, destination=candidate)
    activate(pointer, candidate, "candidate")
    after_switch = runner.run("active-after-switch", [output / "exercise_worker.py", "active-client", "--pointer", pointer, "--events", generated / "suffix.csv"])
    runner.check_db("post-switch-facts", candidate, reference, attempts)
    restored = dbs / "rollout-restored.sqlite"
    runner.service("rollback-restore", "restore", source=snapshot, destination=restored)
    runner.check_db("rollback-snapshot-prefix-facts", restored, prefix_reference, prefix_attempts)
    runner.service("rollback-catch-up", "replay", database=restored, events=generated / "suffix.csv")
    runner.check_db("rollback-caught-up-facts", restored, reference, attempts)
    activate(pointer, restored, "restored-and-caught-up")
    after_rollback = runner.run("active-after-rollback", [output / "exercise_worker.py", "active-client", "--pointer", pointer])
    runner.check("rollout-routed-client-states", before_switch["state"]["distinct"] == len(prefix_reference)
                 and after_switch["state"]["distinct"] == len(reference) and after_rollback["state"]["total"] == sum(reference.values()),
                 {"before_switch": before_switch, "after_switch": after_switch, "after_rollback": after_rollback})
    save(rollout / "observations.json", {"before_switch": before_switch, "after_switch": after_switch, "after_rollback": after_rollback,
                                          "scope": "isolated file pointer and SQLite; no live production routing, no rollback to defective v0"})

    # Actual CLI monitoring: original duplicate traffic warns; missing identities are critical.
    policy = output / "monitor-policy.json"
    warnings = runner.service("monitor-duplicate-warning", "monitor", database=primary, expected=raw, policy=policy, exit=2)
    critical = runner.service("monitor-incomplete-critical", "monitor", database=old_active, expected=raw, policy=policy, exit=2)
    unique_rows = list({(r["tenant"], r["event_id"]): r for r in rows}.values())
    event_table(generated / "unique.csv", unique_rows)
    healthy_db = dbs / "unique.sqlite"
    runner.service("healthy-import", "replay", database=healthy_db, events=generated / "unique.csv")
    healthy = runner.service("monitor-healthy", "monitor", database=healthy_db, expected=raw, policy=policy)
    runner.check("monitor-executable-severities", warnings["status"] == "warning" and len(warnings["alerts"]) == 3
                 and critical["status"] == "critical" and healthy["status"] == "healthy", {"warning": warnings, "critical": critical, "healthy": healthy})
    save(output / "verification/monitoring.json", {"warning": warnings, "critical": critical, "healthy": healthy})

    diagnostics = output / "diagnostics"
    diagnostics.mkdir()
    for name in ("ledger", "duplicates", "totals", "replay"):
        shutil.copyfile(output / (name + ".csv"), diagnostics / (name + ".csv"))
    expected_duplicates = {(t, e): n for (t, e), n in attempts.items() if n > 1}
    with (output / "duplicates.csv").open(newline="", encoding="utf8") as stream:
        actual_duplicates = {(r["tenant"], r["event_id"]): int(r["attempts"]) for r in csv.DictReader(stream)}
    runner.check("business-duplicate-table-from-original-transmissions", actual_duplicates == expected_duplicates,
                 {"rows": len(actual_duplicates), "extra_transmissions": sum(v-1 for v in actual_duplicates.values()), "scope": "original archive once; repeated exercise traffic is held in separate databases"})
    correct_totals = {t: sum(a for (tenant, _), a in reference.items() if tenant == t) for t in sorted({t for t, _ in reference})}
    table(output / "verification/impact.csv", ["tenant", "correct_total", "legacy_first", "correction_from_first", "legacy_restart_once", "delta_restart_once", "legacy_restart_twice", "delta_restart_twice"],
          [(t, value, legacy["first"].get(t, 0), value-legacy["first"].get(t, 0), legacy["restart_once"].get(t, 0), legacy["restart_once"].get(t, 0)-value,
            legacy["restart_twice"].get(t, 0), legacy["restart_twice"].get(t, 0)-value) for t, value in correct_totals.items()])
    summary = {"started_at": started, "finished_at": now(), "elapsed_seconds": time.monotonic()-monotonic,
               "inputs": str(inputs), "output": str(output), "python": sys.version, "sqlite": sqlite3.sqlite_version,
               "platform": platform.platform(), "audit": audit, "correct_totals": correct_totals,
               "legacy": {k: legacy[k] for k in ("first", "same_process_replay", "restart_once", "restart_twice", "write_failure")},
               "replay": {"first": first, "second": second}, "crash_reopen": crash_observations,
               "checks_passed": len(runner.checks), "commands_executed": len(runner.commands),
               "command_exit_codes": dict(collections.Counter(r["exit_code"] for r in runner.commands)),
               "sqlite_database_bytes": sum(p.stat().st_size for p in dbs.glob("*.sqlite")),
               "independent_review": "pending: two external reviewers must record their own findings; this executor cannot sign for them",
               "limitations": ["No real provider, real payments, external production infrastructure, hardware power-loss or network filesystem were exercised", "Archive completeness before provided input horizon is unknown"]}
    save(output / "verification/summary.json", summary)
    build_reports(output, summary)
    (output / "verification/README.md").write_text(
        "# 真实执行证据\n\n"
        "- commands.json：每条真实 argv、cwd、PID（Process Identifier，进程标识）、UTC 起止、退出码、原始标准输出/错误路径。\n"
        "- checks.json：独立从原始 CSV 得到 reference，核对实际 SQLite 逐身份金额、逐身份 attempts、租户合计、完整性。\n"
        "- summary.json：环境、总资源/运行摘要与未完成的外部双评。\n"
        "- databases/：真实运行库与备份；ledger.sqlite 对应主业务四表中的首次输入，replay.sqlite 保存第二遍。\n"
        "- legacy/：旧服务原始行为、首次库、三次重启累计库、失败重试库和按原行号推导的归因。\n"
        "- generated-inputs/：从原始数据分片/排序/唯一化形成的演练输入，不是预写答案。\n"
        "- rollout/observations.json：实际客户端通过 active.json 切换与恢复的状态。\n"
        "- source-timeline.csv/input-audit.json/impact.csv：时间含义、原始行号、各租户影响。\n"
        "- monitoring.json：真实 monitor 命令产生的 warning、critical 与 healthy。\n\n"
        "故障退出 73/74 是隔离 worker 的预定崩溃点，monitor 退出 2 是可执行告警；其他命令应为 0。\n"
        "独立评审未由执行者代签；阅读报告和真实库后由外部评估者完成。\n", encoding="utf8")
    print(json.dumps({"output": str(output), "checks_passed": len(runner.checks), "commands_executed": len(runner.commands), "business_distinct": len(reference), "business_total": sum(reference.values())}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    reproduce(args.inputs, args.output)


if __name__ == "__main__":
    main()
