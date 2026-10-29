"""Cooperating, independently executed v1 writer; no v2 data compatibility path."""
import argparse
import json
from pathlib import Path
import sqlite3
import os
import sys
from l04_request import RequestError,load_request,validate_write_request


def execute(db,request,announce=False):
    try:validate_write_request(request,1)
    except RequestError as error:return {'status':'invalid_request','field':error.field}
    connection=sqlite3.connect(db,isolation_level=None,timeout=15)
    connection.execute('PRAGMA synchronous=FULL')
    try:
        if announce:print(json.dumps({'event':'write_attempt','pid':os.getpid()}),file=sys.stderr,flush=True)
        connection.execute('BEGIN IMMEDIATE')
        epoch=connection.execute('SELECT epoch FROM control WHERE singleton=1').fetchone()[0]
        if request['epoch']!=epoch:
            connection.rollback();return {'status':'stale_epoch','current_epoch':epoch}
        version=connection.execute('SELECT max(version) FROM schema_migrations').fetchone()[0]
        if version!=1:
            connection.rollback();return {'status':'unsupported_schema','current_version':version}
        encoded=json.dumps(request,sort_keys=True,ensure_ascii=False)
        previous=connection.execute('SELECT command_json,result_json FROM write_receipts WHERE op_key=?',(request['op_key'],)).fetchone()
        if previous:
            connection.rollback()
            return {'status':'duplicate','receipt':json.loads(previous[1])} if previous[0]==encoded else {'status':'operation_conflict'}
        connection.execute('INSERT INTO legacy_entries VALUES(?,?,?,?,?)',
            (request['entry_id'],request['customer_id'],request['currency'],request['amount'],request.get('reversal_of')))
        response={'status':'accepted','entry_id':request['entry_id'],'epoch':epoch,'source_schema':1}
        connection.execute('INSERT INTO write_receipts VALUES(?,?,?)',(request['op_key'],encoded,json.dumps(response,sort_keys=True)))
        connection.commit()
        return response
    except sqlite3.IntegrityError as error:
        connection.rollback();return {'status':'entry_conflict','sqlite_errorname':error.sqlite_errorname}
    finally:connection.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--db',type=Path,required=True);parser.add_argument('--request',type=Path,required=True)
    parser.add_argument('--announce-attempt',action='store_true')
    args=parser.parse_args()
    try:response=execute(args.db,load_request(args.request),args.announce_attempt)
    except RequestError as error:response={'status':'invalid_request','field':error.field}
    print(json.dumps(response,ensure_ascii=False),flush=True)
