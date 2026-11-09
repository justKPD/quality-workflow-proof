import test from "node:test";import assert from "node:assert/strict";import{run,presets,copy}from"./engine.mjs";
test("clean control reaches the same final state under both policies",()=>{const a=run(presets.clean.events),b=run(presets.clean.events,{guarded:false});assert.deepEqual(a.cases,b.cases);assert.equal(a.writes,1);});
test("failed destination write does not become completion",()=>{const r=run(presets.retry.events);assert.equal(r.trace[2].decisionCount,0);assert.equal(r.trace[2].cases[0].status,"Pending");assert.equal(r.failures,1);assert.equal(r.writes,1);assert.equal(r.duplicates,1);});
test("old approval cannot authorize the new revision",()=>{const r=run(presets.stale.events);assert.equal(r.writes,0);assert.equal(r.trace[2].result,"STALE");assert.equal(r.cases[0].status,"Pending");assert.equal(run(presets.stale.events,{guarded:false}).cases[0].status,"Approved");});
test("report mismatch remains visible until refresh",()=>{const events=copy(presets.report.events);let r=run(events);assert.equal(r.trace.at(-1).result,"MISMATCH");assert.equal(r.mismatches.length,1);events.push({type:"reconcile",caseId:"Q-104",repairReport:true});assert.equal(run(events).mismatches.length,0);});
test("explicit rejection is a saved outcome",()=>{const r=run(presets.reject.events);assert.equal(r.cases[0].status,"Rejected");assert.equal(r.decisionCount,1);});
test("out of order delivery needs a later retry",()=>{const r=run(presets.outOfOrder.events);assert.equal(r.trace[1].result,"BLOCKED");assert.equal(r.writes,1);});
test("unknown optional field is a benign schema extension",()=>{const e=copy(presets.clean.events);e[2].description="optional metadata";assert.equal(run(e).writes,1);});
test("renamed required identity fails visibly",()=>{const e=copy(presets.clean.events);e[2].requestId=e[2].requestKey;delete e[2].requestKey;assert.equal(run(e).trace[2].result,"INVALID");assert.equal(run(e).writes,0);});
test("revoked reviewer authority blocks a new review",()=>{const e=copy(presets.clean.events);e[1].actor="other-user";assert.equal(run(e).writes,0);});
test("ambiguous local time is rejected",()=>{const e=copy(presets.clean.events);e[1].timestamp="2026-11-09T09:00:00";assert.equal(run(e).trace[1].result,"INVALID");});
test("UTC timestamp passes",()=>{const e=copy(presets.clean.events);e[1].timestamp="2026-11-09T09:00:00Z";assert.equal(run(e).writes,1);});
test("duplicate operation cannot create a second decision",()=>{const e=copy(presets.clean.events);e.push(copy(e[2]));const r=run(e);assert.equal(r.decisionCount,1);assert.equal(r.trace[3].result,"DUPLICATE");assert.equal(run(e,{guarded:false}).writes,2);});
test("rejection cannot be overwritten under the same request",()=>{const e=copy(presets.reject.events);e.splice(2,0,{...e[1],outcome:"Approve"});assert.equal(run(e).cases[0].status,"Rejected");});
test("old recorded request cannot rewrite a revised case",()=>{const e=copy(presets.clean.events);e.push({type:"revise",caseId:"Q-101",payload:{procedure:"new",limit:4}},{...e[2],operationKey:"new-delivery"});const r=run(e);assert.equal(r.cases[0].status,"Pending");assert.equal(r.decisionCount,1);});
test("case identity mismatch blocks reuse across cases",()=>{const e=copy(presets.clean.events);e.splice(2,0,{type:"create",caseId:"other",payload:{v:1}});e[3].caseId="other";assert.equal(run(e).writes,0);});

