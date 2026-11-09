import json, pathlib, os, sqlite3
root=pathlib.Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b155"
data=root/"profile-before-ready"/"data"
saved=json.loads((root/"before-rows-private.json").read_text(encoding="utf-8"))
backups=list((data/"migration-backups").glob("opencorvus.db.v10-to-v11.*.sqlite"))
assert len(backups)==1,backups
def inspect(path,expected):
    with sqlite3.connect(path.as_uri()+"?mode=ro",uri=True) as db:
        db.row_factory=sqlite3.Row
        version=db.execute("pragma user_version").fetchone()[0]
        integrity=db.execute("pragma integrity_check").fetchone()[0]
        relations=db.execute("pragma foreign_key_check").fetchall()
        assert version==expected and integrity=="ok" and not relations
        row_counts={}
        for table, prior in saved.items():
            rows=[dict(row) for row in db.execute("select rowid as physicalRowID, * from "+table+" order by id")]
            assert rows==prior,table
            row_counts[table]=len(rows)
        assert db.execute("select count(*) from provider_usage_event").fetchone()[0]==0
        return {"version":version,"integrity":integrity,"foreignKeyIssues":len(relations),"rowsEqualIncludingAllFieldsAndRowIDs":row_counts}
facts={"backup":inspect(backups[0],10),"migrated":inspect(data/"opencorvus.db",11),"backupName":backups[0].name}
(root/"after-migration-integrity.json").write_text(json.dumps(facts,indent=2)+"\n",encoding="utf-8")
print(json.dumps(facts))