import pytest
import json
import csv
import io
from sqlite_utils import Database
from click.testing import CliRunner
from sqlite_utils.cli import cli




# Local native adaptation: explicit SQLite state and process error contracts.
def _user_state(db, names):
    placeholders = ','.join('?' for _ in names)
    objects = [tuple(row) for row in db.execute(
        'SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN ('+placeholders+') ORDER BY type,name', names
    ).fetchall()]
    tables = [x[1] for x in objects if x[0] == 'table']
    rows = {}
    for name in tables:
        quoted = name.replace('"', '""')
        rows[name] = sorted([tuple(r) for r in db.execute('SELECT * FROM "'+quoted+'"').fetchall()], key=repr)
    return {'objects': objects, 'rows': rows}

def _cli_contract(result):
    if result.exit_code == 0:
        return {'status': 'committed', 'native_exit': result.exit_code}
    if isinstance(result.exit_code, int) and 1 <= result.exit_code <= 255:
        return {'status': 'operation_error', 'native_exit': result.exit_code, 'response': result.output, 'exception_type': type(result.exception).__name__}
    raise AssertionError('Native CLI response outside documented process code domain: '+repr(result.exit_code))

from contextlib import contextmanager
@contextmanager
def _expect_named_error(expected):
    try:
        yield
    except Exception as error:
        assert expected in [base.__name__ for base in type(error).__mro__]
    else:
        raise AssertionError('Expected explicit error contract '+expected)


def test_enable_safe_import():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})

    db.enable_safe_import()
    checkpoint_id = db.create_import_checkpoint()

    assert isinstance(checkpoint_id, str) and len(checkpoint_id) > 0



def test_disable_safe_import():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})

    db.enable_safe_import()
    db.disable_safe_import()

    with _expect_named_error('SafeImportNotEnabledError'):
        db.create_import_checkpoint()



def test_safe_import_creates_checkpoint():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()

    assert isinstance(checkpoint_id, str) and len(checkpoint_id) > 0
    assert len(checkpoint_id) > 0



def test_rollback_to_checkpoint():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})

    db.rollback_to_checkpoint(checkpoint_id)

    rows = list(db["users"].rows)
    assert len(rows) == 1
    assert rows[0]["name"] == "Alice"



def test_commit_checkpoint():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})

    db.commit_checkpoint(checkpoint_id)

    assert len(list(db["users"].rows)) == 2



def test_add_import_invariant():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) <= 100")

    invariants = db.list_import_invariants("users")
    assert len(invariants) == 1



def test_remove_import_invariant():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    invariant_id = db.add_import_invariant("users", "COUNT(*) <= 100")
    db.remove_import_invariant("users", invariant_id)

    invariants = db.list_import_invariants("users")
    assert len(invariants) == 0



def test_list_import_invariants():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) <= 100")
    db.add_import_invariant("users", "MIN(id) >= 0")

    invariants = db.list_import_invariants("users")
    assert len(invariants) == 2



def test_validate_import_invariants_success():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) <= 100")

    result = db.validate_import_invariants("users")
    assert result["valid"] is True
    assert len(result["failures"]) == 0



def test_validate_import_invariants_failure():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) = 0")

    result = db.validate_import_invariants("users")
    assert result["valid"] is False
    assert len(result["failures"]) > 0



def test_safe_bulk_insert_with_validation_success():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) <= 100")

    result = db.safe_bulk_insert("users", [{"id": 2, "name": "Bob"}])

    assert result["success"] is True
    assert len(list(db["users"].rows)) == 2



def test_safe_bulk_insert_with_validation_failure():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) = 1")

    result = db.safe_bulk_insert("users", [{"id": 2, "name": "Bob"}])

    assert result["success"] is False
    assert len(list(db["users"].rows)) == 1
    assert "failures" in result



def test_safe_bulk_insert_rollback_on_error():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"}, pk="id")
    db.enable_safe_import()

    with pytest.raises(Exception):
        db.safe_bulk_insert("users", [{"id": 1, "name": "Bob"}], strict=True)

    assert len(list(db["users"].rows)) == 1
    assert list(db["users"].rows)[0]["name"] == "Alice"



def test_safe_bulk_upsert_with_validation():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"}, pk="id")
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) <= 100")

    result = db.safe_bulk_upsert("users", [{"id": 1, "name": "Alice Updated"}], pk="id")

    assert result["success"] is True
    assert list(db["users"].rows)[0]["name"] == "Alice Updated"



def test_safe_bulk_upsert_with_validation_failure():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"}, pk="id")
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) = 1")

    result = db.safe_bulk_upsert("users", [{"id": 2, "name": "Bob"}], pk="id")

    assert result["success"] is False
    assert "checkpoint_id" in result
    assert "failures" in result
    assert len(result["failures"]) > 0
    assert "error_report" in result
    assert db["users"].count == 1
    assert list(db["users"].rows)[0]["name"] == "Alice"



def test_safe_bulk_upsert_rollback_on_error():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice", "email": "alice@example.com"}, pk="id")
    db.enable_safe_import()

    with pytest.raises(Exception):
        db.safe_bulk_upsert("users", [{"id": 1, "invalid_column": "value"}], pk="id", strict=True)

    assert list(db["users"].rows)[0]["name"] == "Alice"
    assert list(db["users"].rows)[0]["email"] == "alice@example.com"



def test_safe_bulk_upsert_strict_mode_with_invariant_failure():
    """Test safe_bulk_upsert with strict=True raises exception on invariant violation."""
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice", "age": 30}, pk="id")
    db.enable_safe_import()
    db.add_import_invariant("users", "age >= 18")

    with pytest.raises(Exception) as excinfo:
        db.safe_bulk_upsert("users", [{"id": 2, "name": "Minor", "age": 15}], pk="id", strict=True)

    exc_msg = str(excinfo.value).lower()
    assert "valid" in exc_msg or "invariant" in exc_msg, (
        f"Expected invariant/validation wording in exception, got: {excinfo.value!r}"
    )
    assert db["users"].count == 1
    assert list(db["users"].rows)[0]["id"] == 1



def test_import_csv_with_safe_mode():
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) <= 10")

    csv_data = "id,name\n1,Alice\n2,Bob"
    result = db.import_csv("data", io.StringIO(csv_data), safe_mode=True)

    assert result["success"] is True
    assert len(list(db["data"].rows)) == 2



def test_import_csv_with_safe_mode_failure():
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) = 0")
    original_state = _user_state(db, ("data",))

    csv_data = "id,name\n1,Alice\n2,Bob"
    result = db.import_csv("data", io.StringIO(csv_data), safe_mode=True)

    assert result["success"] is False
    assert "checkpoint_id" in result
    assert "failures" in result
    assert len(result["failures"]) > 0
    assert "error_report" in result
    assert _user_state(db, ("data",)) == original_state



def test_import_csv_with_file_path():
    """Test import_csv with file handle opened from path in safe mode."""
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "test.csv")
        with open(csv_path, "w") as f:
            f.write("id,name\n1,Alice\n2,Bob")

        db_path = os.path.join(tmpdir, "test.db")
        db = Database(db_path)
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) <= 10")

        with open(csv_path, "r") as f:
            result = db.import_csv("data", f, safe_mode=True)

        assert result["success"] is True
        assert len(list(db["data"].rows)) == 2
        assert db["data"].count == 2
        db.close()



def test_import_csv_with_string_path():
    """Test import_csv accepts a string file path directly."""
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "test.csv")
        with open(csv_path, "w") as f:
            f.write("id,name\n1,Alice\n2,Bob")

        db = Database(memory=True)
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) <= 10")

        result = db.import_csv("data", csv_path, safe_mode=True)

        assert result["success"] is True
        assert db["data"].count == 2
        names = {row["name"] for row in db["data"].rows}
        assert names == {"Alice", "Bob"}



def test_import_json_with_safe_mode():
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) <= 10")

    json_data = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    result = db.import_json("data", json_data, safe_mode=True)

    assert result["success"] is True
    assert len(list(db["data"].rows)) == 2



def test_import_json_with_safe_mode_failure():
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) = 0")
    original_state = _user_state(db, ("data",))

    json_data = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    result = db.import_json("data", json_data, safe_mode=True)

    assert result["success"] is False
    assert "checkpoint_id" in result
    assert "failures" in result
    assert len(result["failures"]) > 0
    assert "error_report" in result
    assert _user_state(db, ("data",)) == original_state



def test_error_report_contains_details():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) = 1")

    result = db.safe_bulk_insert("users", [{"id": 2, "name": "Bob"}])

    assert "error_report" in result
    assert "failures" in result
    assert "checkpoint_id" in result



def test_multiple_invariants_validation():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("users", "COUNT(*) <= 100")
    db.add_import_invariant("users", "MIN(id) >= 0")

    result = db.validate_import_invariants("users")

    assert result["valid"] is True



def test_checkpoint_cleanup():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()
    db.cleanup_checkpoint(checkpoint_id)

    with _expect_named_error('CheckpointNotFoundError'):
        db.rollback_to_checkpoint(checkpoint_id)



def test_cli_enable_safe_import():
    runner = CliRunner()
    with runner.isolated_filesystem():
        result = runner.invoke(cli, ["enable-safe-import", "test.db"])
        assert result.exit_code == 0



def test_cli_disable_safe_import():
    runner = CliRunner()
    with runner.isolated_filesystem():
        runner.invoke(cli, ["enable-safe-import", "test.db"])
        result = runner.invoke(cli, ["disable-safe-import", "test.db"])
        assert result.exit_code == 0



def test_cli_add_import_invariant():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1})
        db.close()

        result = runner.invoke(cli, [
            "add-import-invariant",
            "test.db",
            "users",
            "COUNT(*) <= 100"
        ])
        assert result.exit_code == 0



def test_cli_remove_import_invariant():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1})
        db.enable_safe_import()
        invariant_id = db.add_import_invariant("users", "COUNT(*) <= 100")
        db.close()

        result = runner.invoke(cli, [
            "remove-import-invariant",
            "test.db",
            "users",
            str(invariant_id)
        ])
        assert result.exit_code == 0



def test_cli_list_import_invariants():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1})
        db.enable_safe_import()
        inv_id = db.add_import_invariant("users", "COUNT(*) <= 100")
        db.close()

        result = runner.invoke(cli, ["list-import-invariants", "test.db", "users"])
        assert result.exit_code == 0
        assert str(inv_id) in result.output
        assert "COUNT(*) <= 100" in result.output



def test_cli_validate_import_invariants():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1})
        db.enable_safe_import()
        db.add_import_invariant("users", "COUNT(*) <= 100")
        db.close()

        result = runner.invoke(cli, ["validate-import-invariants", "test.db", "users"])
        assert result.exit_code == 0
        output_lower = result.output.lower()
        assert any(word in output_lower for word in ("valid", "ok", "success", "pass")), (
            f"Expected a success indicator in output, got: {result.output!r}"
        )



def test_cli_validate_import_invariants_with_failure():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1})
        db.enable_safe_import()
        inv_id = db.add_import_invariant("users", "COUNT(*) = 0")
        db.close()

        result = runner.invoke(cli, ["validate-import-invariants", "test.db", "users"])
        assert result.exit_code == 0, (
            f"validate-import-invariants must always exit 0, even on failure; got {result.exit_code}"
        )
        assert str(inv_id) in result.output
        output_lower = result.output.lower()
        assert any(word in output_lower for word in ("invalid", "fail", "error", "violation")), (
            f"Expected a failure indicator in output, got: {result.output!r}"
        )



def test_cli_insert_with_safe_mode():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1, "name": "Alice"})
        db.enable_safe_import()
        db.add_import_invariant("users", "COUNT(*) <= 100")
        db.close()

        result = runner.invoke(cli, [
            "insert",
            "test.db",
            "users",
            "-",
            "--safe-mode"
        ], input='{"id": 2, "name": "Bob"}')
        assert result.exit_code == 0



def test_cli_insert_csv_with_safe_mode():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) <= 10")
        db.close()

        result = runner.invoke(cli, [
            "insert",
            "test.db",
            "data",
            "-",
            "--csv",
            "--safe-mode"
        ], input="id,name\n1,Alice\n2,Bob")
        assert result.exit_code == 0

        db = Database("test.db")
        assert db["data"].count >= 1



def test_cli_insert_csv_from_file_with_safe_mode():
    """Test CLI insert --csv with actual file path in safe mode."""
    runner = CliRunner()
    with runner.isolated_filesystem():
        with open("test.csv", "w") as f:
            f.write("id,name\n1,Alice\n2,Bob")

        db = Database("test.db")
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) <= 10")
        db.close()

        result = runner.invoke(cli, [
            "insert",
            "test.db",
            "data",
            "test.csv",
            "--csv",
            "--safe-mode"
        ])
        assert result.exit_code == 0

        db = Database("test.db")
        assert db["data"].count == 2
        db.close()



def test_cli_insert_csv_with_safe_mode_failure():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) = 0")
        db.close()

        result = runner.invoke(cli, [
            "insert",
            "test.db",
            "data",
            "-",
            "--csv",
            "--safe-mode"
        ], input="id,name\n1,Alice\n2,Bob")
        assert _cli_contract(result)['status'] == 'operation_error'

        db = Database("test.db")
        if "data" in db.table_names():
            assert db["data"].count == 0, "Rollback failed: data still exists"
        else:
            pass



def test_safe_import_with_foreign_key_validation():
    db = Database(memory=True)
    db["departments"].insert({"id": 1, "name": "Engineering"})
    db["employees"].insert({"id": 1, "dept_id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("employees",
        "(SELECT COUNT(*) FROM employees WHERE dept_id NOT IN (SELECT id FROM departments)) = 0")

    result = db.safe_bulk_insert("employees", [{"id": 2, "dept_id": 1, "name": "Bob"}])
    assert result["success"] is True



def test_safe_import_with_foreign_key_violation():
    db = Database(memory=True)
    db["departments"].insert({"id": 1, "name": "Engineering"})
    db["employees"].insert({"id": 1, "dept_id": 1, "name": "Alice"})
    db.enable_safe_import()
    db.add_import_invariant("employees",
        "(SELECT COUNT(*) FROM employees WHERE dept_id NOT IN (SELECT id FROM departments)) = 0")

    result = db.safe_bulk_insert("employees", [{"id": 2, "dept_id": 999, "name": "Bob"}])
    assert result["success"] is False
    assert db["employees"].count == 1



def test_nested_checkpoint_handling():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    cp1 = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})

    cp2 = db.create_import_checkpoint()
    db["users"].insert({"id": 3, "name": "Charlie"})

    db.rollback_to_checkpoint(cp2)
    assert db["users"].count == 2

    db.rollback_to_checkpoint(cp1)
    assert db["users"].count == 1



def test_safe_import_performance_invariant():
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) <= 1000")

    large_dataset = [{"id": i, "value": f"value_{i}"} for i in range(500)]
    result = db.safe_bulk_insert("data", large_dataset)

    assert result["success"] is True
    assert db["data"].count == 500



def test_cli_bulk_import_with_safe_mode():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["data"].insert({"id": 0})
        db.enable_safe_import()
        db.add_import_invariant("data", "COUNT(*) <= 10")
        db.close()

        result = runner.invoke(cli, [
            "bulk",
            "test.db",
            "INSERT INTO data (id) VALUES (:id)",
            "-",
            "--safe-mode"
        ], input='[{"id": 1}, {"id": 2}]')
        assert result.exit_code == 0



def test_dropped_table_restoration_on_rollback():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db["products"].insert({"id": 1, "name": "Widget"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()

    db["products"].drop()

    db.rollback_to_checkpoint(checkpoint_id)

    assert "products" in db.table_names()
    assert db["products"].count == 1
    assert list(db["products"].rows)[0]["name"] == "Widget"



def test_schema_changes_rolled_back():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()

    db["users"].add_column("email", str)
    assert "email" in [col.name for col in db["users"].columns]

    db.rollback_to_checkpoint(checkpoint_id)

    columns = [col.name for col in db["users"].columns]
    assert set(columns) == {"id", "name"}



def test_cli_insert_with_invariant_violation_prevents_write():
    runner = CliRunner()
    with runner.isolated_filesystem():
        db = Database("test.db")
        db["users"].insert({"id": 1, "name": "Alice"})
        db.enable_safe_import()
        db.add_import_invariant("users", "COUNT(*) = 1")
        db.close()

        result = runner.invoke(cli, [
            "insert",
            "test.db",
            "users",
            "-",
            "--safe-mode"
        ], input='{"id": 2, "name": "Bob"}')

        assert _cli_contract(result)['status'] == 'operation_error'

        db = Database("test.db")
        rows = list(db["users"].rows)
        assert len(rows) == 1, "Rollback failed: Bob was written despite invariant violation"
        assert rows[0]["name"] == "Alice"



def test_nested_savepoints():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    cp1 = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})
    assert db["users"].count == 2

    cp2 = db.create_import_checkpoint()
    db["users"].insert({"id": 3, "name": "Charlie"})
    assert db["users"].count == 3

    db.rollback_to_checkpoint(cp2)
    assert db["users"].count == 2
    names = {row["name"] for row in db["users"].rows}
    assert names == {"Alice", "Bob"}

    db.rollback_to_checkpoint(cp1)
    assert db["users"].count == 1
    assert list(db["users"].rows)[0]["name"] == "Alice"



def test_index_and_trigger_preserved_on_rollback():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.execute("CREATE INDEX idx_name ON users(name)")
    db.execute("""
        CREATE TRIGGER update_timestamp
        AFTER INSERT ON users
        BEGIN
            SELECT 1;
        END
    """)
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()

    db.execute("DROP INDEX idx_name")
    db.execute("DROP TRIGGER update_timestamp")

    indexes = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_name'").fetchall()]
    triggers = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='update_timestamp'").fetchall()]

    db.rollback_to_checkpoint(checkpoint_id)

    indexes = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_name'").fetchall()]
    triggers = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='update_timestamp'").fetchall()]
    assert len(indexes) == 1
    assert len(triggers) == 1



def test_expression_vs_select_invariants():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) <= 100")
    result = db.validate_import_invariants("users")
    assert result["valid"] is True

    db.add_import_invariant("users", "SELECT COUNT(*) >= 1 FROM users")
    result = db.validate_import_invariants("users")
    assert result["valid"] is True

    db.add_import_invariant("users", "COUNT(*) = 0")
    result = db.validate_import_invariants("users")
    assert result["valid"] is False
    assert len(result["failures"]) > 0



def test_consistent_failure_schema():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"}, pk="id")
    db.enable_safe_import()

    db.add_import_invariant("users", "COUNT(*) = 1")
    result = db.safe_bulk_insert("users", [{"id": 2, "name": "Bob"}])

    assert result["success"] is False
    assert "checkpoint_id" in result
    assert "failures" in result
    assert "error_report" in result
    assert isinstance(result["failures"], list)

    result2 = db.safe_bulk_insert("users", [{"id": 1, "name": "Alice2"}])

    assert result2["success"] is False
    assert "checkpoint_id" in result2
    assert "failures" in result2
    assert "error_report" in result2
    assert isinstance(result2["failures"], list)



def test_checkpoint_not_active_after_rollback():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})
    db.rollback_to_checkpoint(checkpoint_id)

    with _expect_named_error('CheckpointNotActiveError'):
        db.rollback_to_checkpoint(checkpoint_id)



def test_rollback_nonexistent_checkpoint():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    with _expect_named_error('CheckpointNotFoundError'):
        db.rollback_to_checkpoint("nonexistent_checkpoint_id")



def test_commit_nonexistent_checkpoint():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    with _expect_named_error('CheckpointNotFoundError'):
        db.commit_checkpoint("nonexistent_checkpoint_id")



def test_strict_mode_with_invariant_failure():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice", "age": 30}, pk="id")
    db.enable_safe_import()
    db.add_import_invariant("users", "SELECT COUNT(*) = 0 FROM users WHERE age < 18")

    with pytest.raises(Exception) as exc_info:
        db.safe_bulk_insert(
            "users",
            [{"id": 2, "name": "Minor", "age": 15}],
            strict=True
        )

    assert "valid" in str(exc_info.value).lower() or "invariant" in str(exc_info.value).lower()
    assert len(list(db["users"].rows)) == 1



def test_checkpoint_inactive_after_commit():
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice"})
    db.enable_safe_import()

    checkpoint_id = db.create_import_checkpoint()
    db["users"].insert({"id": 2, "name": "Bob"})
    db.commit_checkpoint(checkpoint_id)

    with _expect_named_error('CheckpointNotActiveError'):
        db.rollback_to_checkpoint(checkpoint_id)

    with _expect_named_error('CheckpointNotActiveError'):
        db.commit_checkpoint(checkpoint_id)



def test_cli_upsert_safe_mode():
    """Test CLI upsert command with --safe-mode flag."""
    runner = CliRunner()
    with runner.isolated_filesystem():

        db = Database("test.db")
        db["users"].insert({"id": 1, "name": "Alice", "age": 30}, pk="id")
        db.enable_safe_import()
        db.add_import_invariant("users", "SELECT COUNT(*) = 0 FROM users WHERE age < 18")
        db.conn.commit()
        db.conn.close()

        result = runner.invoke(cli, [
            "upsert", "test.db", "users", "-",
            "--pk", "id",
            "--safe-mode"
        ], input='[{"id": 1, "name": "Alice Updated", "age": 35}]')

        assert result.exit_code == 0

        db = Database("test.db")
        rows = list(db["users"].rows)
        assert len(rows) == 1
        assert rows[0]["name"] == "Alice Updated"
        db.conn.close()

        db = Database("test.db")
        db.enable_safe_import()
        db.add_import_invariant("users", "SELECT COUNT(*) = 0 FROM users WHERE age < 18")
        db.conn.commit()
        db.conn.close()

        result = runner.invoke(cli, [
            "upsert", "test.db", "users", "-",
            "--pk", "id",
            "--safe-mode"
        ], input='[{"id": 2, "name": "Minor", "age": 15}]')

        assert _cli_contract(result)['status'] == 'operation_error'

        db = Database("test.db")
        rows = list(db["users"].rows)
        assert len(rows) == 1
        assert rows[0]["id"] == 1



def test_bulk_safe_mode_with_update():
    """Test bulk --safe-mode with UPDATE statement (not just INSERT)."""
    runner = CliRunner()
    with runner.isolated_filesystem():

        db = Database("test.db")
        db["users"].insert_all([
            {"id": 1, "name": "Alice", "age": 30},
            {"id": 2, "name": "Bob", "age": 25}
        ], pk="id")
        db.enable_safe_import()
        db.add_import_invariant("users", "SELECT COUNT(*) = 0 FROM users WHERE age < 18")
        db.conn.commit()
        db.conn.close()

        result = runner.invoke(cli, [
            "bulk", "test.db",
            "UPDATE users SET age = :age WHERE id = :id",
            "-",
            "--safe-mode"
        ], input='[{"id": 1, "age": 31}, {"id": 2, "age": 26}]')

        assert result.exit_code == 0


        db = Database("test.db")
        rows = list(db["users"].rows_where(order_by="id"))
        assert rows[0]["age"] == 31
        assert rows[1]["age"] == 26
        db.conn.close()


        db = Database("test.db")
        db.enable_safe_import()
        db.add_import_invariant("users", "SELECT COUNT(*) = 0 FROM users WHERE age < 18")
        db.conn.commit()
        db.conn.close()

        result = runner.invoke(cli, [
            "bulk", "test.db",
            "UPDATE users SET age = :age WHERE id = :id",
            "-",
            "--safe-mode"
        ], input='[{"id": 1, "age": 15}]')

        assert _cli_contract(result)['status'] == 'operation_error'


        db = Database("test.db")
        rows = list(db["users"].rows_where(order_by="id"))
        assert rows[0]["age"] == 31
        assert rows[1]["age"] == 26



def test_expression_invariant_checks_all_rows():
    """Test that expression invariants check all rows, not just the first one."""
    db = Database(memory=True)

    db["users"].insert_all([
        {"id": 1, "name": "Alice", "age": 30},
        {"id": 2, "name": "Bob", "age": 25},
        {"id": 3, "name": "Charlie", "age": 15}
    ], pk="id")

    db.enable_safe_import()

    db.add_import_invariant("users", "age >= 18")


    validation = db.validate_import_invariants("users")
    assert validation["valid"] is False
    assert len(validation["failures"]) > 0



def test_expression_invariant_first_row_passes_later_fails():
    """Test safe_bulk_insert with invariant where first row passes but later row fails."""
    db = Database(memory=True)
    db["users"].insert({"id": 1, "name": "Alice", "age": 30}, pk="id")

    db.enable_safe_import()

    db.add_import_invariant("users", "age >= 18")


    result = db.safe_bulk_insert("users", [
        {"id": 2, "name": "Bob", "age": 25},
        {"id": 3, "name": "Charlie", "age": 15}
    ])

    assert result["success"] is False
    assert len(result["failures"]) > 0


    rows = list(db["users"].rows_where(order_by="id"))
    assert len(rows) == 1
    assert rows[0]["id"] == 1



def test_import_csv_with_strict_mode():
    """Test import_csv with strict=True raises exception on invariant failure."""
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) = 0")
    original_state = _user_state(db, ("data",))

    csv_data = "id,name\n1,Alice\n2,Bob"

    with pytest.raises(Exception) as excinfo:
        db.import_csv("data", io.StringIO(csv_data), safe_mode=True, strict=True)

    exc_msg = str(excinfo.value).lower()
    assert "valid" in exc_msg or "invariant" in exc_msg, (
        f"Expected invariant/validation wording in exception, got: {excinfo.value!r}"
    )
    assert _user_state(db, ("data",)) == original_state



def test_import_json_with_strict_mode():
    """Test import_json with strict=True raises exception on invariant failure."""
    db = Database(memory=True)
    db.enable_safe_import()
    db.add_import_invariant("data", "COUNT(*) = 0")
    original_state = _user_state(db, ("data",))

    json_data = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]

    with pytest.raises(Exception) as excinfo:
        db.import_json("data", json_data, safe_mode=True, strict=True)

    exc_msg = str(excinfo.value).lower()
    assert "valid" in exc_msg or "invariant" in exc_msg, (
        f"Expected invariant/validation wording in exception, got: {excinfo.value!r}"
    )
    assert _user_state(db, ("data",)) == original_state

