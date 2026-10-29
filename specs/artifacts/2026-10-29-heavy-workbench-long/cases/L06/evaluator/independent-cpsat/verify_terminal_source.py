"""Only compare original persisted tool excerpts and their precise session linkage."""
import json
from pathlib import Path
import re
import shutil
import sys

ROOT=Path(__file__).resolve().parent
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029/v2/root-node-diagnostic-20261029')
DEST=ROOT/'terminal-addendum'

def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def main():
    DEST.mkdir(exist_ok=False)
    for n in ('cpsat-terminal-original-response.json','cpsat-terminal-origin.json','cpsat-terminal-receipt.json'):
        shutil.copy2(BASE/n,DEST/n)
    old_command=ROOT/'source-snapshot/execution/cpsat-full-command.json'
    shutil.copy2(old_command,DEST/'original-command-snapshot.json')
    response=load(DEST/'cpsat-terminal-original-response.json')
    origin=load(DEST/'cpsat-terminal-origin.json');receipt=load(DEST/'cpsat-terminal-receipt.json')
    command=load(DEST/'original-command-snapshot.json')
    json_outputs=[]
    for item in response['payload']['output']:
        if item['type']=='input_text':
            try:v=json.loads(item['text'])
            except ValueError:continue
            if isinstance(v,dict):json_outputs.append(v)
    terminal=next(v for v in json_outputs if v.get('chunk_id')=='069218')
    match=origin['matches'][0]
    checks={
      'original_record_is_tool_output':response['type']=='response_item' and response['payload']['type']=='custom_tool_call_output',
      'original_terminal_exit_zero':terminal['exit_code']==0,
      'extracted_terminal_entire_object_matches_original':terminal==receipt['terminal_tool_receipt'],
      'origin_timestamp_and_call_id_match_original':match['timestamp']==response['timestamp'] and match['call_id']==response['payload']['call_id'],
      'source_line_and_ordinal_agree':match['line_number']==response['ordinal']+1==7410,
      'receipt_timestamp_matches_original':receipt['observed_tool_record_timestamp']==response['timestamp'],
      'annotated_receipt_session_matches_original_command':receipt['session_id']==command['session_id']==87433,
      'old_command_snapshot_remains_same':old_command.read_bytes()==(BASE/'cpsat-full-command.json').read_bytes()
    }
    result={'scope':'terminal provenance only, no solver/business execution',
      'checks':checks,'all_compared_fields_match':all(checks.values()),
      'original_call_id':response['payload']['call_id'],'original_terminal':terminal,
      'original_tool_response_contains_session_identity':any('session_id' in v for v in json_outputs),
      'session_binding_requires_original_call_input':True,
      'session_binding_independently_confirmed':False,
      'reviewer_solver_calls':0,'reviewer_new_business_replays':0,
      'historical_gap_report_preserved':True}
    save(DEST/'initial-field-comparison.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))

def complete():
    shutil.copy2(BASE/'cpsat-terminal-original-call.json',DEST/'cpsat-terminal-original-call.json')
    call=load(DEST/'cpsat-terminal-original-call.json')
    response=load(DEST/'cpsat-terminal-original-response.json')
    old=load(DEST/'original-command-snapshot.json')
    initial=load(DEST/'initial-field-comparison.json')
    # Read literal original code only; never execute it.
    waits=re.findall(r'tools\.write_stdin\(\{session_id:(\d+),chars:"",\s*"max_output_tokens":500,\s*"yield_time_ms":1000\}\)',call['payload']['input'])
    terminal=json.loads(response['payload']['output'][-1]['text'])
    checks={
      'initial_original_response_fields_all_match':initial['all_compared_fields_match'],
      'original_call_type_and_status':call['type']=='response_item' and call['payload']['type']=='custom_tool_call' and call['payload']['status']=='completed',
      'original_call_and_response_same_call_id':call['payload']['call_id']==response['payload']['call_id']=='call_054ff60e55964000a816f7f83d0922de',
      'original_call_has_exactly_one_recorded_target_wait':waits==['87433'],
      'original_code_target_equals_original_command_session':int(waits[0])==old['session_id']==87433 if waits else False,
      'sequential_original_call_prints_target_wait_last':call['payload']['input'].strip().endswith('text(await tools.write_stdin({session_id:87433,chars:"","max_output_tokens":500,"yield_time_ms":1000}));'),
      'last_original_output_terminal_exit_zero':terminal==initial['original_terminal'] and terminal['chunk_id']=='069218' and terminal['exit_code']==0,
      'original_call_line_and_order':call['ordinal']+1==7405 and call['timestamp']<response['timestamp'],
      'original_command_still_unchanged':(ROOT/'source-snapshot/execution/cpsat-full-command.json').read_bytes()==(BASE/'cpsat-full-command.json').read_bytes()
    }
    result={'scope':'only original persisted call/response and session binding',
      'result':'provenance_gap_resolved' if all(checks.values()) else 'provenance_gap_pending',
      'all_checks_passed':all(checks.values()),'checks':checks,
      'original_session_id':old['session_id'],'original_call_id':call['payload']['call_id'],
      'call_timestamp':call['timestamp'],'call_source_line':call['ordinal']+1,
      'response_timestamp':response['timestamp'],'response_source_line':response['ordinal']+1,
      'terminal_chunk_id':terminal['chunk_id'],'terminal_exit_code':terminal['exit_code'],
      'new_receipt_session_annotation_used_as_binding_evidence':False,
      'original_command_and_historical_gap_snapshot_preserved':True,
      'reviewer_solver_calls':0,'reviewer_new_business_replays':0,'reviewer_model_calls':0,
      'reasoning_records_read':False,'scope_does_not_certify_heavy_freeze_hours_or_one_percent':True}
    save(DEST/'final-source-assessment.json',result)
    if all(checks.values()):
        current=load(ROOT/'stage-assessment.json')
        current['execution_receipt_gap_status']='resolved_from_original_persisted_call_and_response'
        current['execution_receipt_gap_addendum']='terminal-addendum/ADDENDUM.md'
        current['CP_original_command_exit_code']=0
        save(ROOT/'stage-assessment.json',current)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if not all(checks.values()):raise SystemExit(1)

if __name__=='__main__':
    if '--complete' in sys.argv:complete()
    else:main()
