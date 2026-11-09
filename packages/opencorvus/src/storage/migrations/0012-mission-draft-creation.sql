CREATE TRIGGER IF NOT EXISTS session_mission_draft_creation_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN NEW.kind = 'mission'
  AND json_type(NEW.metadata, '$.mission.draftCreation') IS NOT NULL
  AND (
    json_type(NEW.metadata, '$.mission.draftCreation') IS NOT 'object'
    OR json_type(NEW.metadata, '$.mission.draftCreation.version') IS NOT 'integer'
    OR json_extract(NEW.metadata, '$.mission.draftCreation.version') IS NOT 1
    OR json_type(NEW.metadata, '$.mission.draftCreation.requestID') IS NOT 'text'
    OR length(trim(json_extract(NEW.metadata, '$.mission.draftCreation.requestID'))) NOT BETWEEN 1 AND 200
    OR json_type(NEW.metadata, '$.mission.draftCreation.fingerprint') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.draftCreation.fingerprint')) != 64
    OR json_extract(NEW.metadata, '$.mission.draftCreation.fingerprint') GLOB '*[^0-9a-f]*'
    OR length(trim(NEW.title)) NOT BETWEEN 1 AND 200
    OR json_type(NEW.metadata, '$.mission.pendingPrompt.text') IS NOT 'text'
    OR length(trim(json_extract(NEW.metadata, '$.mission.pendingPrompt.text'))) NOT BETWEEN 1 AND 32000
  )
BEGIN
  SELECT RAISE(ABORT, 'session: Mission draft creation must contain its immutable binding, title and pending prompt');
END;

CREATE TRIGGER IF NOT EXISTS session_mission_draft_creation_immutable_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN OLD.kind = 'mission'
  AND json_extract(NEW.metadata, '$.mission.draftCreation') IS NOT json_extract(OLD.metadata, '$.mission.draftCreation')
BEGIN
  SELECT RAISE(ABORT, 'session: Mission draft creation binding is immutable');
END;
