import { describe, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { SCHEMA_DDL } from "../src/storage/ddl"

function currentDatabase(): SQLite {
  const db = new SQLite(":memory:")
  db.exec(SCHEMA_DDL)
  db.exec(`
    PRAGMA foreign_keys=ON;
    INSERT INTO project (id,worktree,time_created,time_updated,sandboxes,generation)
    VALUES ('prj_lineage','D:/lineage',1,1,'[]','00000000-0000-0000-0000-000000000000');
    INSERT INTO session (
      id,project_id,slug,directory,title,version,kind,time_created,time_updated
    ) VALUES (
      'ses_delay','prj_lineage','delay','D:/lineage','Delay','1','root',1,1
    );
    INSERT INTO session (
      id,project_id,slug,directory,title,version,kind,time_created,time_updated
    ) VALUES (
      'ses_creator','prj_lineage','creator','D:/lineage','Creator','1','orchestrator',1,1
    );
    INSERT INTO engine_task (
      id,project_id,source,product_pillar,title,request,system_artifacts,priority,time_created
    ) VALUES (
      'tsk_lineage','prj_lineage','test','code','Lineage Task','Validate lineage','[]','normal',1
    );
    INSERT INTO engine_task_root_ingress_policy (
      id,semantic_turn_limit,activation_limit,time_created
    ) VALUES ('pol_lineage',1,1,1);
  `)
  return db
}

function insertDelayDefinition(db: SQLite): void {
  db.run(`
    INSERT INTO automation (
      id,definition_id,revision,session_id,name,kind,prompt,status,due_at,time_created
    ) VALUES (
      'atm_delay','atm_delay',1,'ses_delay','delay','delay','resume','active',100,10
    )
  `)
}

function insertMessage(db: SQLite, input: { id: string; sessionID: string; data: Record<string, unknown> }): void {
  db.query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    input.id,
    input.sessionID,
    10,
    10,
    JSON.stringify(input.data),
  )
}

function insertToolBackedWaits(
  db: SQLite,
  input: {
    suffix: string
    waits: Array<{ id: string; dueAt: number; reason: string }>
  },
): void {
  const ingressID = `ing_creator_${input.suffix}`
  const activationID = `lease_creator_${input.suffix}`
  const messageID = `msg_creator_${input.suffix}`
  db.query(`
    INSERT INTO engine_task_root_ingress(
      id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).run(ingressID, "tsk_lineage", 1, 0, "inline", ingressID, '{"purpose":"Task wait creator"}', "pol_lineage", 5)
  db.query(`
    INSERT INTO engine_control_activation_lease(
      id,target,target_id,owner_occurrence_id,time_activated,expires_at
    ) VALUES (?,?,?,?,?,?)
  `).run(activationID, "task_root_ingress", ingressID, `owner:${input.suffix}`, 6, 1_000)
  insertMessage(db, {
    id: messageID,
    sessionID: "ses_creator",
    data: {
      role: "assistant",
      author: "orchestrator",
      activationID,
      parentID: `msg_control_${input.suffix}`,
    },
  })
  for (const wait of input.waits) {
    const toolPartID = `part_${wait.id}`
    db.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
      toolPartID,
      messageID,
      JSON.stringify({
        type: "tool-request",
        callID: `call_${wait.id}`,
        tool: "wait",
        input: { duration_ms: wait.dueAt - 10, reason: wait.reason },
        time: { start: 7 },
      }),
      7,
    )
    db.query(`
      INSERT INTO engine_task_wait_registration(
        id,task_id,execution_epoch,due_at,reason,tool_part_id,
        creator_ingress_id,creator_activation_id,input_digest,time_created
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      wait.id,
      "tsk_lineage",
      1,
      wait.dueAt,
      wait.reason,
      toolPartID,
      ingressID,
      activationID,
      `digest:${wait.id}`,
      10,
    )
  }
}

describe("scheduling occurrence DDL lineage", () => {
  test("uses the immutable dispatch lineage index as virtual workflow node admission", () => {
    const db = currentDatabase()
    try {
      const plan = db
        .query<{ detail: string }, []>(`
          EXPLAIN QUERY PLAN
          SELECT id
          FROM engine_artifact
          WHERE task_id='tsk_lineage'
            AND kind='dispatch_lineage'
            AND json_extract(payload,'$.workflow_binding.kind')='virtual_workflow'
            AND json_extract(payload,'$.workflow_binding.workflow_id')='workflow-a'
            AND json_extract(payload,'$.workflow_node_id')='node-a'
            AND json_type(payload,'$.continuation_of_dispatch_id') IS NULL
            AND json_type(payload,'$.coordination_action_id') IS NULL
        `)
        .all()
        .map((row) => row.detail)
      expect(plan).toEqual([
        expect.stringContaining("engine_dispatch_lineage_initial_workflow_node_idx"),
      ])
    } finally {
      db.close(true)
    }
  })

  test("uses Session and Fire frontier indexes instead of scanning unrelated immutable history", () => {
    const db = currentDatabase()
    try {
      insertDelayDefinition(db)
      const insert = db.query(`
        INSERT INTO automation(
          id,definition_id,revision,session_id,name,kind,prompt,status,due_at,time_created
        ) VALUES(?,?,?,?,?,'delay','resume','active',100,10)
      `)
      db.exec("BEGIN")
      try {
        for (let index = 0; index < 500; index += 1) {
          insert.run(
            `atm_external_${index}`,
            `atm_external_${index}`,
            1,
            `ses_external_${index}`,
            `external ${index}`,
          )
        }
        db.exec("COMMIT")
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      } finally {
        insert.finalize()
      }
      const definitions = db.query<{ id: string }, []>(`
        SELECT current.id
        FROM automation AS current
        WHERE current.session_id='ses_delay'
          AND current.kind='delay'
          AND current.status='active'
          AND NOT EXISTS (
            SELECT 1 FROM automation AS candidate
            WHERE candidate.definition_id=current.definition_id
              AND (
                candidate.revision>current.revision
                OR (candidate.revision=current.revision AND candidate.id>current.id)
              )
          )
          AND NOT EXISTS (
            SELECT 1 FROM automation_definition_tombstone AS tombstone
            WHERE tombstone.definition_id=current.definition_id
              AND tombstone.revision>=current.revision
          )
      `).all()
      const sessionPlan = db.query<{ detail: string }, []>(`
        EXPLAIN QUERY PLAN
        SELECT current.id
        FROM automation AS current
        WHERE current.session_id='ses_delay'
          AND current.kind='delay'
          AND current.status='active'
          AND NOT EXISTS (
            SELECT 1 FROM automation AS candidate
            WHERE candidate.definition_id=current.definition_id
              AND candidate.revision>current.revision
          )
      `).all().map((row) => row.detail)
      expect(definitions).toEqual([{ id: "atm_delay" }])
      expect(sessionPlan.some((detail) =>
        detail.includes("SEARCH current") && detail.includes("automation_session_delay_frontier_idx"),
      )).toBe(true)
      expect(sessionPlan.some((detail) => detail.startsWith("SCAN current"))).toBe(false)

      db.exec(`
        INSERT INTO automation_fire(id,automation_revision_id,scheduled_due_at,origin,time_created)
        VALUES ('cal_frontier','atm_delay',100,'scheduled',100);
      `)
      const firePlan = db.query<{ detail: string }, []>(`
        EXPLAIN QUERY PLAN
        SELECT fire.id
        FROM automation_fire AS fire
        JOIN automation AS definition ON definition.id=fire.automation_revision_id
        WHERE definition.definition_id='atm_delay'
          AND fire.origin='scheduled'
        ORDER BY fire.scheduled_due_at DESC,fire.time_created DESC,fire.id DESC
        LIMIT 1
      `).all().map((row) => row.detail)
      expect(
        firePlan.some(
          (detail) =>
            detail.includes("automation_fire_revision_frontier_idx") ||
            detail.includes("automation_fire_scheduled_occurrence_idx"),
        ),
      ).toBe(true)
    } finally {
      db.close(true)
    }
  })

  test("accepts a Session delay settlement only from its exact persisted assistant batch", () => {
    const db = currentDatabase()
    try {
      insertDelayDefinition(db)
      insertMessage(db, {
        id: "msg_input",
        sessionID: "ses_delay",
        data: { role: "user", author: "user" },
      })
      insertMessage(db, {
        id: "msg_other",
        sessionID: "ses_delay",
        data: { role: "user", author: "user" },
      })

      expect(() =>
        db
          .query(`
            INSERT INTO automation_delay_settlement(
              definition_id,disposition,assistant_message_id,accepted_input_message_ids,time_created
            ) VALUES (?,?,?,?,?)
          `)
          .run("atm_delay", "input_accepted", "msg_missing", '["msg_input"]', 20),
      ).toThrow("automation_delay_settlement: invalid Session delay admission lineage")

      insertMessage(db, {
        id: "msg_assistant",
        sessionID: "ses_delay",
        data: {
          role: "assistant",
          author: "primary",
          parentID: "msg_input",
          acceptedInputMessageIDs: ["msg_input"],
        },
      })
      expect(() =>
        db
          .query(`
            INSERT INTO automation_delay_settlement(
              definition_id,disposition,assistant_message_id,accepted_input_message_ids,time_created
            ) VALUES (?,?,?,?,?)
          `)
          .run("atm_delay", "input_accepted", "msg_assistant", '["msg_other"]', 21),
      ).toThrow("automation_delay_settlement: invalid Session delay admission lineage")

      db.query(`
        INSERT INTO automation_delay_settlement(
          definition_id,disposition,assistant_message_id,accepted_input_message_ids,time_created
        ) VALUES (?,?,?,?,?)
      `).run("atm_delay", "input_accepted", "msg_assistant", '["msg_input"]', 22)
      expect(
        db.query<{ assistant_message_id: string }, []>(
          "SELECT assistant_message_id FROM automation_delay_settlement WHERE definition_id='atm_delay'",
        ).get(),
      ).toEqual({ assistant_message_id: "msg_assistant" })
    } finally {
      db.close(true)
    }
  })

  test("binds a due Session delay settlement to one exact scheduler wake Fire and run", () => {
    const db = currentDatabase()
    try {
      insertDelayDefinition(db)
      db.exec(`
        INSERT INTO automation_fire(
          id,automation_revision_id,scheduled_due_at,origin,time_created
        ) VALUES
          ('cal_exact','atm_delay',100,'scheduled',20),
          ('cal_other','atm_delay',101,'scheduled',21);
        INSERT INTO automation_run(
          id,automation_revision_id,fire_id,started_at
        ) VALUES
          ('atr_exact','atm_delay','cal_exact',20),
          ('atr_other','atm_delay','cal_other',21);
      `)
      insertMessage(db, {
        id: "msg_wake",
        sessionID: "ses_delay",
        data: {
          role: "user",
          author: "orchestrator",
          extra: {
            wake_reason: {
              source: "scheduler.automation",
              jobID: "atm_delay",
              jobName: "delay",
              fireID: "cal_exact",
              scope: "session",
              recurrence: null,
            },
          },
        },
      })
      insertMessage(db, {
        id: "msg_due_assistant",
        sessionID: "ses_delay",
        data: {
          role: "assistant",
          author: "primary",
          parentID: "msg_wake",
          acceptedInputMessageIDs: ["msg_wake"],
        },
      })

      expect(() =>
        db
          .query(`
            INSERT INTO automation_delay_settlement(
              definition_id,disposition,assistant_message_id,accepted_input_message_ids,fire_id,time_created
            ) VALUES (?,?,?,?,?,?)
          `)
          .run("atm_delay", "due_accepted", "msg_due_assistant", '["msg_wake"]', "cal_other", 30),
      ).toThrow("automation_delay_settlement: invalid Session delay admission lineage")

      db.query(`
        INSERT INTO automation_delay_settlement(
          definition_id,disposition,assistant_message_id,accepted_input_message_ids,fire_id,time_created
        ) VALUES (?,?,?,?,?,?)
      `).run("atm_delay", "due_accepted", "msg_due_assistant", '["msg_wake"]', "cal_exact", 31)
      expect(
        db.query<{ fire_id: string }, []>(
          "SELECT fire_id FROM automation_delay_settlement WHERE definition_id='atm_delay'",
        ).get(),
      ).toEqual({ fire_id: "cal_exact" })
    } finally {
      db.close(true)
    }
  })

  test("rejects an ordinary Task ingress posing as the exact due wait ingress", () => {
    const db = currentDatabase()
    try {
      insertToolBackedWaits(db, {
        suffix: "settlement",
        waits: [
          { id: "wait_exact", dueAt: 100, reason: "exact" },
          { id: "wait_wrong_fire", dueAt: 100, reason: "wrong fire" },
          { id: "wait_wrong_due", dueAt: 100, reason: "wrong due" },
          { id: "wait_early", dueAt: 100, reason: "early" },
        ],
      })
      db.exec(`
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,policy_id,time_accepted
        ) VALUES (
          'ing_ordinary','tsk_lineage',1,1,'message','msg_ordinary','pol_lineage',20
        );
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_wrong_job','tsk_lineage',1,2,'inline','wait_other',
          '{"taskWaitWake":{"jobID":"wait_other","fireID":"wait_other","dueAt":100}}',
          'pol_lineage',121
        );
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_wrong_fire','tsk_lineage',1,3,'inline','wait_wrong_fire',
          '{"taskWaitWake":{"jobID":"wait_wrong_fire","fireID":"cal_wrong","dueAt":100}}',
          'pol_lineage',122
        );
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_wrong_due','tsk_lineage',1,4,'inline','wait_wrong_due',
          '{"taskWaitWake":{"jobID":"wait_wrong_due","fireID":"wait_wrong_due","dueAt":101}}',
          'pol_lineage',122
        );
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_early','tsk_lineage',1,5,'inline','wait_early',
          '{"taskWaitWake":{"jobID":"wait_early","fireID":"wait_early","dueAt":100}}',
          'pol_lineage',99
        );
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_due','tsk_lineage',1,6,'inline','wait_exact',
          '{"taskWaitWake":{"jobID":"wait_exact","fireID":"wait_exact","dueAt":100}}',
          'pol_lineage',123
        );
      `)

      expect(() =>
        db
          .query(`
            INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
            VALUES (?,?,?,?)
          `)
          .run("wait_exact", "ing_ordinary", "due_ingress_accepted", 30),
      ).toThrow("engine_task_wait_settlement: wait and ingress lineage must match")

      expect(() =>
        db
          .query(`
            INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
            VALUES (?,?,?,?)
          `)
          .run("wait_exact", "ing_wrong_job", "due_ingress_accepted", 30),
      ).toThrow("engine_task_wait_settlement: wait and ingress lineage must match")

      for (const [waitID, ingressID] of [
        ["wait_wrong_fire", "ing_wrong_fire"],
        ["wait_wrong_due", "ing_wrong_due"],
        ["wait_early", "ing_early"],
      ] as const) {
        expect(() =>
          db
            .query(`
              INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
              VALUES (?,?,?,?)
            `)
            .run(waitID, ingressID, "due_ingress_accepted", 130),
        ).toThrow("engine_task_wait_settlement: wait and ingress lineage must match")
      }

      expect(
        db.query<Record<string, unknown>, []>(`
          SELECT ingress.source_id AS sourceID,
            json_type(ingress.inline_payload,'$.taskWaitWake') AS wakeType,
            json_extract(ingress.inline_payload,'$.taskWaitWake.jobID')=wait.id AS jobMatches,
            json_extract(ingress.inline_payload,'$.taskWaitWake.fireID')=wait.id AS fireMatches,
            json_extract(ingress.inline_payload,'$.taskWaitWake.dueAt')=wait.due_at AS dueMatches,
            ingress.time_accepted>=wait.due_at AS afterDue
          FROM engine_task_wait_registration AS wait
          JOIN engine_task_root_ingress AS ingress ON ingress.id='ing_due'
          WHERE wait.id='wait_exact'
        `).get(),
      ).toEqual({
        sourceID: "wait_exact",
        wakeType: "object",
        jobMatches: 1,
        fireMatches: 1,
        dueMatches: 1,
        afterDue: 1,
      })

      db.query(`
        INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
        VALUES (?,?,?,?)
      `).run("wait_exact", "ing_due", "due_ingress_accepted", 131)
      expect(
        db.query<{ ingress_id: string }, []>(
          "SELECT ingress_id FROM engine_task_wait_settlement WHERE wait_id='wait_exact'",
        ).get(),
      ).toEqual({ ingress_id: "ing_due" })
    } finally {
      db.close(true)
    }
  })

  test("binds a Tool-backed Task wait to its creator assistant activation and ingress", () => {
    const db = currentDatabase()
    try {
      db.exec(`
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES (
          'ing_creator','tsk_lineage',1,1,'inline','creator',
          '{"purpose":"Task wait creator"}','pol_lineage',10
        );
        INSERT INTO engine_control_activation_lease(
          id,target,target_id,owner_occurrence_id,time_activated,expires_at
        ) VALUES
          ('lease_creator','task_root_ingress','ing_creator','owner:creator',11,100),
          ('lease_other','task_root_ingress','ing_creator','owner:other',12,100);
      `)
      insertMessage(db, {
        id: "msg_creator",
        sessionID: "ses_creator",
        data: {
          role: "assistant",
          author: "orchestrator",
          activationID: "lease_creator",
          parentID: "msg_control",
        },
      })
      db.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
        "part_wait",
        "msg_creator",
        JSON.stringify({
          type: "tool-request",
          callID: "call_wait",
          tool: "wait",
          input: { duration_ms: 10, reason: "lineage" },
          time: { start: 13 },
        }),
        13,
      )

      expect(() =>
        db
          .query(`
            INSERT INTO engine_task_wait_registration(
              id,task_id,execution_epoch,due_at,reason,tool_part_id,
              creator_ingress_id,creator_activation_id,input_digest,time_created
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
          `)
          .run(
            "wait_wrong_creator",
            "tsk_lineage",
            1,
            100,
            "lineage",
            "part_wait",
            "ing_creator",
            "lease_other",
            "digest",
            20,
          ),
      ).toThrow("engine_task_wait_registration: invalid Tool creator lineage")

      db.query(`
        INSERT INTO engine_task_wait_registration(
          id,task_id,execution_epoch,due_at,reason,tool_part_id,
          creator_ingress_id,creator_activation_id,input_digest,time_created
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(
        "wait_exact_creator",
        "tsk_lineage",
        1,
        100,
        "lineage",
        "part_wait",
        "ing_creator",
        "lease_creator",
        "digest",
        20,
      )
      db.exec(`
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,policy_id,time_accepted
        ) VALUES
          ('ing_before_creator','tsk_lineage',1,0,'message','msg_before','pol_lineage',21),
          ('ing_after_creator','tsk_lineage',1,2,'message','msg_after','pol_lineage',22);
      `)
      expect(() =>
        db.query(`
          INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
          VALUES (?,?,?,?)
        `).run("wait_exact_creator", "ing_before_creator", "superseded", 23),
      ).toThrow("engine_task_wait_settlement: wait and ingress lineage must match")
      db.query(`
        INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
        VALUES (?,?,?,?)
      `).run("wait_exact_creator", "ing_after_creator", "superseded", 24)
      expect(
        db.query<{ id: string }, []>(
          "SELECT id FROM engine_task_wait_registration ORDER BY id",
        ).all(),
      ).toEqual([{ id: "wait_exact_creator" }])
    } finally {
      db.close(true)
    }
  })

  test("retention deletes scheduled and settled waits with their owning Task", () => {
    const db = currentDatabase()
    try {
      insertToolBackedWaits(db, {
        suffix: "retention",
        waits: [
          { id: "wait_scheduled", dueAt: 500, reason: "scheduled" },
          { id: "wait_due", dueAt: 100, reason: "due" },
          { id: "wait_superseded", dueAt: 500, reason: "superseded" },
        ],
      })
      db.exec(`
        INSERT INTO engine_task_root_ingress(
          id,task_id,execution_epoch,sequence,source,source_id,inline_payload,policy_id,time_accepted
        ) VALUES
          ('ing_due','tsk_lineage',1,1,'inline','wait_due',
           '{"taskWaitWake":{"jobID":"wait_due","fireID":"wait_due","dueAt":100}}','pol_lineage',100),
          ('ing_supersede','tsk_lineage',1,2,'message','msg_new',NULL,'pol_lineage',101);
        INSERT INTO engine_task_wait_settlement(wait_id,ingress_id,disposition,time_created)
        VALUES
          ('wait_due','ing_due','due_ingress_accepted',100),
          ('wait_superseded','ing_supersede','superseded',101);
        DELETE FROM engine_task WHERE id='tsk_lineage';
      `)
      expect({
        tasks: db.query<{ count: number }, []>("SELECT count(*) AS count FROM engine_task").get()!.count,
        waits: db.query<{ count: number }, []>("SELECT count(*) AS count FROM engine_task_wait_registration").get()!.count,
        settlements: db.query<{ count: number }, []>("SELECT count(*) AS count FROM engine_task_wait_settlement").get()!.count,
        ingresses: db.query<{ count: number }, []>("SELECT count(*) AS count FROM engine_task_root_ingress").get()!.count,
        foreignKeys: db.query<Record<string, unknown>, []>("PRAGMA foreign_key_check").all(),
      }).toEqual({ tasks: 0, waits: 0, settlements: 0, ingresses: 0, foreignKeys: [] })
    } finally {
      db.close(true)
    }
  })
})
