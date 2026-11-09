CREATE TRIGGER IF NOT EXISTS task_operator_message_request_insert
BEFORE INSERT ON message
FOR EACH ROW
WHEN json_type(NEW.data, '$.extra.task_root_message.operatorRequest') IS NOT NULL
  AND (
    json_extract(NEW.data, '$.role') IS NOT 'user'
    OR json_extract(NEW.data, '$.author') IS NOT 'user'
    OR json_extract(NEW.data, '$.extra.task_root_message.protocol') IS NOT 'task-root-message'
    OR json_extract(NEW.data, '$.extra.task_root_message.kind') IS NOT 'operator'
    OR json_type(NEW.data, '$.extra.task_root_message.schedulerDelivery') IS NOT NULL
    OR json_type(NEW.data, '$.extra.task_root_message.operatorRequest') IS NOT 'object'
    OR json_type(NEW.data, '$.extra.task_root_message.operatorRequest.version') IS NOT 'integer'
    OR json_extract(NEW.data, '$.extra.task_root_message.operatorRequest.version') IS NOT 1
    OR json_type(NEW.data, '$.extra.task_root_message.operatorRequest.requestID') IS NOT 'text'
    OR length(trim(json_extract(NEW.data, '$.extra.task_root_message.operatorRequest.requestID'))) NOT BETWEEN 1 AND 200
    OR json_type(NEW.data, '$.extra.task_root_message.operatorRequest.fingerprint') IS NOT 'text'
    OR length(json_extract(NEW.data, '$.extra.task_root_message.operatorRequest.fingerprint')) != 64
    OR json_extract(NEW.data, '$.extra.task_root_message.operatorRequest.fingerprint') GLOB '*[^0-9a-f]*'
    OR NOT EXISTS (
      SELECT 1 FROM engine_task t JOIN session s ON s.id=t.session_id
      WHERE t.id=json_extract(NEW.data, '$.extra.task_root_message.taskID')
        AND s.id=NEW.session_id AND s.project_id=t.project_id AND s.kind='root'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'message: invalid Task operator request binding');
END;

CREATE TRIGGER IF NOT EXISTS task_operator_message_request_immutable_update
BEFORE UPDATE ON message
FOR EACH ROW
WHEN json_extract(NEW.data, '$.extra.task_root_message.operatorRequest')
  IS NOT json_extract(OLD.data, '$.extra.task_root_message.operatorRequest')
BEGIN
  SELECT RAISE(ABORT, 'message: Task operator request binding is immutable');
END;
