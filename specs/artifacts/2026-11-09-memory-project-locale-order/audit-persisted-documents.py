import pathlib,sqlite3,json
b=pathlib.Path(r"C:\Users\hengu\AppData\Local\Temp\opencorvus-iteration-20261109-b38")
p=b/"owned-project-after-check.json"
report=json.loads(p.read_text(encoding="utf-8"))
http=json.loads((b/"live-tcp-schema-check.json").read_text(encoding="utf-8"))
conn=sqlite3.connect("file:"+(b/"profile-after/data/opencorvus.db").as_posix()+"?mode=ro",uri=True)
rows=conn.execute("select f.project_id,f.id,c.content from memory_file f join memory_chunk c on c.file_id=f.id where f.kind=?",("project_context",)).fetchall()
conn.close()
by_project={project_id:(file_id,json.loads(content)) for project_id,file_id,content in rows}
requests=[item for item in http["results"] if item["operation"]=="experimental.projectMemory.get"]
assert set(by_project)=={item["project"]["id"] for item in requests}
checks=[]
for item in requests:
 project=item["project"]
 file_id,envelope=by_project[project["id"]]
 body=item["body"]
 assert envelope["markdown"]==body["content"]
 assert envelope["revision"]==body["revision"]
 assert envelope["timeCreated"]==body["timeCreated"]
 checks.append({"projectID":project["id"],"name":project["name"],"storedFileID":file_id,"revision":body["revision"],"timeCreated":body["timeCreated"],"httpTimeUpdated":body["timeUpdated"],"storedTimeUpdated":envelope["timeUpdated"],"observedAvailabilityGeneration":envelope["availabilityGeneration"],"ownedContentRevisionAndCreationExact":True})
report["after"]["memoryResponsePersistenceChecks"]=checks
report["qualification"]["checkerCorrection"]="An optional audit first equated the final mutable timeUpdated with an earlier HTTP read. Config invalidation legitimately increments availabilityGeneration and updates that timestamp. The corrected check verifies exact owned content/revision/immutable creation and records current metadata; it does not gate on mutable timestamp equality. The precise notifying config event was not traced."
p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(b/"document-metadata-observation.json").write_text(json.dumps({"checks":checks,"qualification":report["qualification"]["checkerCorrection"]},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"ownedDocuments":len(checks),"contentRevisionCreationExact":True,"mutableMetadataRecorded":True}))
