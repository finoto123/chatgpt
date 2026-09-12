import test from 'node:test'
import assert from 'node:assert/strict'
import {addOperationalBusinessDays,aggregatePurchaseSuggestions,calculateAvailableStock,calculateBomRequirement,calculateDeterministicSafeDate,calculateReservation,capacityUtilization,deriveRouting} from './operations.ts'

test('BOM inclui desperdício configurável',()=>assert.equal(calculateBomRequirement(100,0.4,5),42))
test('BOM rejeita desperdício inválido',()=>assert.throws(()=>calculateBomRequirement(10,1,101)))
test('estoque disponível desconta reserva sem ficar negativo',()=>{assert.equal(calculateAvailableStock(30,12),18);assert.equal(calculateAvailableStock(5,8),0)})
test('reserva parcial preserva a falta',()=>assert.deepEqual(calculateReservation(100,0,70),{reservedNow:70,shortage:30,complete:false}))
test('reserva idempotente considera quantidade já reservada',()=>assert.deepEqual(calculateReservation(100,70,30),{reservedNow:30,shortage:0,complete:true}))
test('sugestões agregam material e unidade sem misturá-los',()=>assert.deepEqual(aggregatePurchaseSuggestions([{materialId:'pv',unit:'kg',shortage:10,orderId:'2'},{materialId:'pv',unit:'kg',shortage:14,orderId:'1'},{materialId:'pv',unit:'meter',shortage:4,orderId:'3'}]),[{materialId:'pv',unit:'kg',quantity:24,orderIds:['1','2']},{materialId:'pv',unit:'meter',quantity:4,orderIds:['3']}]))
test('capacidade identifica sobrecarga',()=>assert.equal(capacityUtilization(470,450),104.4))
test('dias úteis pulam fim de semana e feriado',()=>assert.equal(addOperationalBusinessDays('2026-12-31',1,new Set(['2027-01-01'])),'2027-01-04'))
test('roteamento deriva sequência por personalização',()=>assert.deepEqual(deriveRouting('Bordado'),['cut','embroidery','sewing','finishing','dispatch']))
test('prazo seguro explica fila e classifica alto risco',()=>{const result=calculateDeterministicSafeDate({today:'2026-09-10',requested:'2026-09-15',artRequired:false,artApproved:false,steps:[{name:'Corte',durationDays:1},{name:'Bordado',durationDays:2,queueDays:2},{name:'Acabamento',durationDays:1}],safetyBufferDays:1});assert.equal(result.earliestSafeDate,'2026-09-21');assert.equal(result.riskLevel,'high_risk');assert.match(result.explanation[2].detail,/Fila/)})
test('arte pendente torna cálculo impossível e explicável',()=>{const result=calculateDeterministicSafeDate({today:'2026-09-10',artRequired:true,artApproved:false,steps:[],safetyBufferDays:0});assert.equal(result.riskLevel,'impossible');assert.equal(result.blockingReasons[0].code,'art_pending')})
