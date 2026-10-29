"""Private constructive v2 witness. Public task and formal rubric remain unfrozen."""
import argparse
from datetime import datetime,timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
from l04_request import RequestError,is_identity,load_request,validate_write_request


class ContractError(ValueError):pass


def canonical(value):return json.dumps(value,ensure_ascii=False,sort_keys=True)


def legacy_minor(text):
    if not isinstance(text,str) or re.fullmatch(r'-?[0-9]+(?:\.[0-9]+)?',text) is None:raise ContractError('invalid_amount')
    if '.' in text and len(text.rsplit('.',1)[1])>2:raise ContractError('amount_scale')
    value=int(Decimal(text)*100)
    if not -(2**63)<=value<2**63:raise ContractError('amount_range')
    return value


def checkpoint(name,requested,connection):
    if name==requested:
        print(json.dumps({'event':'checkpoint','name':name,'pid':os.getpid(),'transaction_open':connection.in_transaction}),flush=True)
        if sys.stdin.readline()!='\n':raise ContractError('checkpoint_release_required')


def upgrade(connection,authority,pause_at):
    connection.execute('BEGIN IMMEDIATE')
    version=connection.execute('SELECT max(version) FROM schema_migrations').fetchone()[0]
    epoch=connection.execute('SELECT epoch FROM control WHERE singleton=1').fetchone()[0]
    if version==2:
        connection.rollback();return {'status':'already_current','version':2,'epoch':epoch}
    if version!=1:raise ContractError('unsupported_schema')
    source_customers=[dict(row) for row in connection.execute('SELECT * FROM legacy_customers ORDER BY customer_id')]
    source_entries=[dict(row) for row in connection.execute('SELECT * FROM legacy_entries ORDER BY entry_id')]
    old_receipts=[dict(row) for row in connection.execute('SELECT * FROM write_receipts')]
    if any(not is_identity(row['op_key']) for row in old_receipts):raise ContractError('unresolved_receipt_identity')
    if any(not is_identity(row['entry_id']) for row in source_entries):raise ContractError('unresolved_entry_identity')
    statements=[
        "CREATE TABLE customers(customer_key TEXT PRIMARY KEY NOT NULL CHECK(typeof(customer_key)='text' AND length(trim(customer_key))>0),display_name TEXT NOT NULL,email TEXT NOT NULL)",
        'CREATE TABLE customer_aliases(legacy_id INTEGER PRIMARY KEY,customer_key TEXT NOT NULL REFERENCES customers(customer_key),raw_json TEXT NOT NULL)',
        "CREATE TABLE entries(entry_id TEXT PRIMARY KEY NOT NULL CHECK(typeof(entry_id)='text' AND length(trim(entry_id))>0),customer_key TEXT NOT NULL REFERENCES customers(customer_key),currency TEXT NOT NULL CHECK(currency IN ('USD','CNY')),amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer'),reversal_of TEXT REFERENCES entries(entry_id) DEFERRABLE INITIALLY DEFERRED,fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fee_minor)='integer' AND fee_minor>=0),legacy_raw_json TEXT,CHECK((reversal_of IS NULL AND amount_minor>=0) OR (reversal_of IS NOT NULL AND amount_minor<0)))",
        'CREATE INDEX entries_customer_currency ON entries(customer_key,currency)',
        'CREATE TABLE quarantine(kind TEXT NOT NULL,legacy_key TEXT NOT NULL,reason TEXT NOT NULL,raw_json TEXT NOT NULL,PRIMARY KEY(kind,legacy_key))',
    ]
    for statement in statements:connection.execute(statement)
    mapping={}
    def quarantine(kind,key,reason,row):
        connection.execute('INSERT INTO quarantine VALUES(?,?,?,?)',(kind,str(key),reason,canonical(row)))
    used_customers=set()
    for row in source_customers:
        key=authority['legacy_to_customer'].get(str(row['customer_id']))
        if key is None:
            quarantine('customer',row['customer_id'],'unmapped_customer',row);continue
        if key not in used_customers:
            facts=authority['customers'][key]
            connection.execute('INSERT INTO customers VALUES(?,?,?)',(key,facts['display_name'],facts['email']))
            used_customers.add(key)
        mapping[row['customer_id']]=key
        connection.execute('INSERT INTO customer_aliases VALUES(?,?,?)',(row['customer_id'],key,canonical(row)))
    prepared={};reasons={}
    for row in source_entries:
        identity=row['entry_id']
        try:
            if row['customer_id'] not in mapping:raise ContractError('unmapped_customer')
            if row['currency'] not in ('USD','CNY'):raise ContractError('unsupported_currency')
            amount=legacy_minor(row['amount'])
            prepared[identity]=(mapping[row['customer_id']],row['currency'],amount,row['reversal_of'])
        except ContractError as error:reasons[identity]=str(error)
    for identity,(customer,currency,amount,reversal) in prepared.items():
        if reversal is None:
            if amount<0:reasons[identity]='invalid_reversal'
        else:
            parent=prepared.get(reversal)
            if amount>=0 or parent is None or parent[0:2]!=(customer,currency) or parent[2]<=0 or parent[3] is not None:
                reasons[identity]='invalid_reversal'
    for row in source_entries:
        identity=row['entry_id']
        if identity in reasons:quarantine('entry',identity,reasons[identity],row)
        else:
            customer,currency,amount,reversal=prepared[identity]
            connection.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,?)',(identity,customer,currency,amount,reversal,0,canonical(row)))
    connection.execute("CREATE TABLE receipts_next(op_key TEXT PRIMARY KEY NOT NULL CHECK(typeof(op_key)='text' AND length(trim(op_key))>0),command_json TEXT NOT NULL,result_json TEXT NOT NULL)")
    connection.execute('INSERT INTO receipts_next SELECT * FROM write_receipts')
    connection.execute('DROP TABLE write_receipts')
    connection.execute('ALTER TABLE receipts_next RENAME TO write_receipts')
    connection.execute('DROP TABLE legacy_entries');connection.execute('DROP TABLE legacy_customers')
    connection.execute("CREATE TRIGGER entry_audit AFTER INSERT ON entries BEGIN INSERT INTO audit_events(entry_id,source_schema,payload) VALUES(NEW.entry_id,2,json_object('customer_key',NEW.customer_key,'currency',NEW.currency,'amount_minor',NEW.amount_minor,'reversal_of',NEW.reversal_of,'fee_minor',NEW.fee_minor)); END")
    connection.execute('INSERT INTO schema_migrations VALUES(?,?,?)',(2,'canonical_customers_integer_money',datetime.now(timezone.utc).isoformat()))
    connection.execute('UPDATE control SET epoch=? WHERE singleton=1',(epoch+1,))
    checkpoint('before_commit',pause_at,connection)
    connection.commit()
    checkpoint('after_commit',pause_at,connection)
    return {'status':'upgraded','version':2,'epoch':epoch+1}


def write(connection,request):
    validate_write_request(request,2)
    connection.execute('BEGIN IMMEDIATE')
    epoch=connection.execute('SELECT epoch FROM control WHERE singleton=1').fetchone()[0]
    if request['epoch']!=epoch:
        connection.rollback();return {'status':'stale_epoch','current_epoch':epoch}
    if connection.execute('SELECT max(version) FROM schema_migrations').fetchone()[0]!=2:raise ContractError('unsupported_schema')
    encoded=canonical(request)
    previous=connection.execute('SELECT command_json,result_json FROM write_receipts WHERE op_key=?',(request['op_key'],)).fetchone()
    if previous:
        connection.rollback();return {'status':'duplicate','receipt':json.loads(previous[1])} if previous[0]==encoded else {'status':'operation_conflict'}
    reversal=request.get('reversal_of');amount=request['amount_minor']
    if reversal is None:
        if amount<0:raise ContractError('invalid_reversal')
    else:
        parent=connection.execute('SELECT customer_key,currency,amount_minor,reversal_of FROM entries WHERE entry_id=?',(reversal,)).fetchone()
        if amount>=0 or parent is None or tuple(parent[0:2])!=(request['customer_key'],request['currency']) or parent[2]<=0 or parent[3] is not None:
            raise ContractError('invalid_reversal')
    connection.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,NULL)',(request['entry_id'],request['customer_key'],request['currency'],amount,reversal,request['fee_minor']))
    response={'status':'accepted','entry_id':request['entry_id'],'epoch':epoch,'source_schema':2}
    connection.execute('INSERT INTO write_receipts VALUES(?,?,?)',(request['op_key'],encoded,canonical(response)))
    connection.commit();return response


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--db',type=Path,required=True);parser.add_argument('--authority',type=Path)
    parser.add_argument('--action',choices=['upgrade','write','get','receipt'],required=True);parser.add_argument('--request',type=Path)
    parser.add_argument('--id');parser.add_argument('--pause-at',choices=['before_commit','after_commit']);args=parser.parse_args()
    connection=sqlite3.connect(args.db,isolation_level=None,timeout=15);connection.row_factory=sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON');connection.execute('PRAGMA synchronous=FULL')
    try:
        if args.action=='upgrade':response=upgrade(connection,json.loads(args.authority.read_text(encoding='utf-8')),args.pause_at)
        elif args.action=='write':response=write(connection,load_request(args.request))
        elif args.action=='receipt':
            row=connection.execute('SELECT result_json FROM write_receipts WHERE op_key=?',(args.id,)).fetchone()
            response={'status':'ok','receipt':json.loads(row[0])} if row else {'status':'unknown_receipt'}
        else:
            if connection.execute('SELECT max(version) FROM schema_migrations').fetchone()[0]!=2:raise ContractError('unsupported_schema')
            row=connection.execute('SELECT entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor FROM entries WHERE entry_id=?',(args.id,)).fetchone()
            response={'status':'ok','entry':dict(row)} if row else {'status':'unknown_entry'}
    except RequestError as error:
        connection.rollback();response={'status':'invalid_request','field':error.field}
    except ContractError as error:
        connection.rollback();response={'status':str(error)}
    except sqlite3.IntegrityError as error:
        connection.rollback();response={'status':'constraint_error','sqlite_errorname':error.sqlite_errorname}
    finally:connection.close()
    print(json.dumps(response,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
