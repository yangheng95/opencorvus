import {expect,test} from 'bun:test'
import {resolveOwnedStreamAction} from './network-action'
test('a consumed action maps to its retired receipt after the selected Task changes',()=>{
 expect(resolveOwnedStreamAction({name:'calibration',taskID:'task-original',mode:'response-error'},{selectedTaskID:'task-current',allowedActions:['calibration','browser'],consumed:new Set(['calibration']),mode:'response-error'})).toEqual({kind:'retired',name:'calibration'})
})
test('a current action maps to the admitted Task and transport mode',()=>{
 expect(resolveOwnedStreamAction({name:'browser',taskID:'task-current',mode:'response-error'},{selectedTaskID:'task-current',allowedActions:['calibration','browser'],consumed:new Set(['calibration']),mode:'response-error'})).toEqual({kind:'admitted',name:'browser',taskID:'task-current',mode:'response-error'})
})
