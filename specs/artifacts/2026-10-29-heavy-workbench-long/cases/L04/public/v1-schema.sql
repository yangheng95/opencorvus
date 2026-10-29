CREATE INDEX legacy_entries_customer ON legacy_entries(customer_id);

CREATE TABLE audit_events(event_id INTEGER PRIMARY KEY AUTOINCREMENT,entry_id TEXT NOT NULL,source_schema INTEGER NOT NULL,payload TEXT NOT NULL);

CREATE TABLE control(singleton INTEGER PRIMARY KEY CHECK(singleton=1), epoch INTEGER NOT NULL);

CREATE TABLE legacy_customers(customer_id INTEGER PRIMARY KEY,display_name TEXT,email TEXT);

CREATE TABLE legacy_entries(entry_id TEXT PRIMARY KEY,customer_id INTEGER NOT NULL,currency TEXT NOT NULL,amount TEXT NOT NULL,reversal_of TEXT);

CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL);

CREATE TABLE write_receipts(op_key TEXT PRIMARY KEY,command_json TEXT NOT NULL,result_json TEXT NOT NULL);

CREATE TRIGGER legacy_entry_audit AFTER INSERT ON legacy_entries BEGIN INSERT INTO audit_events(entry_id,source_schema,payload) VALUES(NEW.entry_id,1,json_object('customer_id',NEW.customer_id,'currency',NEW.currency,'amount',NEW.amount,'reversal_of',NEW.reversal_of)); END;
