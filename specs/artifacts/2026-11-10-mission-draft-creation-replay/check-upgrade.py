from pathlib import Path
import json, os, sqlite3
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b156"
data=root/"profile-after"/"data"
old=json.loads((root/"before-rows-private.json").read_text(encoding="utf-8"))
backups=list((data/"migration-backups").glob("opencorvus.db.v11-to-v12.*.sqlite"))
assert len(backups)==1
def inspect(file,expected):
    with sqlite3.connect(file.as_uri()+"?mode=ro",uri=True) as cx:
        cx.row_factory=sqlite3.Row
        version=cx.execute("pragma user_version").fetchone()[0]
        integrity=cx.execute("pragma integrity_check").fetchone()[0]
        relations=cx.execute("pragma foreign_key_check").fetchall()
        assert version==expected and integrity=="ok" and not relations
        for table,rows in old.items():
            assert [dict(x) for x in cx.execute("select rowid as physicalRowID,* from "+table+" order by id")]==rows,table
        return {"version":version,"integrity":integrity,"foreignKeyIssues":len(relations),"rowsEqualIncludingAllFieldsAndRowIDs":{table:len(rows) for table,rows in old.items()}}
facts={"backup":inspect(backups[0],11),"migrated":inspect(data/"opencorvus.db",12),"backupName":backups[0].name}
(root/"after-upgrade.json").write_text(json.dumps(facts,indent=2)+"\n",encoding="utf-8")
print(json.dumps(facts))
