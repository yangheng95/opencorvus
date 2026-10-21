import assert from 'node:assert/strict'
export function resolveOwnedStreamAction(action:any,input:{selectedTaskID:string;allowedActions:string[];consumed:ReadonlySet<string>;mode:'native-idle'|'response-error'}) {
 if(input.consumed.has(action.name))return {kind:'retired' as const,name:action.name}
 assert.equal(action.taskID,input.selectedTaskID)
 assert(input.allowedActions.includes(action.name))
 if(input.mode==='native-idle')assert.equal(action.timeoutSeconds,1)
 else assert.equal(action.mode,'response-error')
 return {kind:'admitted' as const,name:action.name,taskID:action.taskID,mode:input.mode}
}
