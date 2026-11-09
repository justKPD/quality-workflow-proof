export const copy=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>JSON.stringify((function normalize(v){return Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;})(x));
export const presets={
clean:{title:"Clean approval",events:[{type:"create",caseId:"Q-101",payload:{procedure:"seal-check",limit:8}},{type:"review",caseId:"Q-101",requestKey:"R-101",revision:1,actor:"reviewer",outcome:"Approve"},{type:"deliver",caseId:"Q-101",requestKey:"R-101",operationKey:"D-1"}]},
retry:{title:"Failed write, then retry",events:[{type:"create",caseId:"Q-102",payload:{procedure:"seal-check",limit:8}},{type:"review",caseId:"Q-102",requestKey:"R-102",revision:1,actor:"reviewer",outcome:"Approve"},{type:"deliver",caseId:"Q-102",requestKey:"R-102",operationKey:"D-2",failWrite:true},{type:"deliver",caseId:"Q-102",requestKey:"R-102",operationKey:"D-3"},{type:"deliver",caseId:"Q-102",requestKey:"R-102",operationKey:"D-4"}]},
stale:{title:"Approval arrives after a revision",events:[{type:"create",caseId:"Q-103",payload:{procedure:"seal-check",limit:8}},{type:"revise",caseId:"Q-103",payload:{procedure:"seal-check",limit:6}},{type:"review",caseId:"Q-103",requestKey:"R-103",revision:1,actor:"reviewer",outcome:"Approve"},{type:"deliver",caseId:"Q-103",requestKey:"R-103",operationKey:"D-5"}]},
report:{title:"Write succeeds, report update fails",events:[{type:"create",caseId:"Q-104",payload:{procedure:"dimension-check",limit:3}},{type:"review",caseId:"Q-104",requestKey:"R-104",revision:1,actor:"reviewer",outcome:"Approve"},{type:"deliver",caseId:"Q-104",requestKey:"R-104",operationKey:"D-6",failReport:true},{type:"reconcile",caseId:"Q-104"}]},
reject:{title:"Rejected quality action",events:[{type:"create",caseId:"Q-105",payload:{procedure:"inspection",limit:4}},{type:"review",caseId:"Q-105",requestKey:"R-105",revision:1,actor:"reviewer",outcome:"Reject"},{type:"deliver",caseId:"Q-105",requestKey:"R-105",operationKey:"D-7"}]},
outOfOrder:{title:"Delivery before approval",events:[{type:"create",caseId:"Q-106",payload:{procedure:"inspection",limit:4}},{type:"deliver",caseId:"Q-106",requestKey:"R-106",operationKey:"D-8"},{type:"review",caseId:"Q-106",requestKey:"R-106",revision:1,actor:"reviewer",outcome:"Approve"},{type:"deliver",caseId:"Q-106",requestKey:"R-106",operationKey:"D-9"}]}
};
export function run(events,{guarded=true,reviewer="reviewer"}={}){
 if(!Array.isArray(events)||events.length<1||events.length>100)throw Error("Provide 1–100 events.");
 const cases=new Map(),reviews=new Map(),decisions=new Map(),operations=new Set(),reports=new Map(),trace=[];
 let writes=0,failures=0,duplicates=0,blocked=0;
 const mismatch=()=>[...cases].filter(([id,c])=>{const r=reports.get(id);return !r||r.revision!==c.revision||r.status!==c.status}).map(([id])=>id);
 for(const [index,e] of events.entries()){
  let result="OBSERVED",detail="",stage="request";
  try{
   if(!e||typeof e!=="object"||Array.isArray(e))throw Error("Event must be an object.");
   if(typeof e.caseId!=="string"||!e.caseId.trim()||e.caseId.length>80)throw Error("caseId is required.");
   if(e.timestamp!==undefined&&(typeof e.timestamp!=="string"||!e.timestamp.endsWith("Z")||!Number.isFinite(Date.parse(e.timestamp))))throw Error("timestamp must be an explicit UTC instant ending in Z.");
   if(e.type==="create"){
    if(cases.has(e.caseId))throw Error("Case already exists.");
    if(!e.payload||typeof e.payload!=="object"||Array.isArray(e.payload))throw Error("A structured payload is required.");
    const c={revision:1,status:"Pending",identity:canonical(e.payload)};cases.set(e.caseId,c);reports.set(e.caseId,copy(c));result="CREATED";detail="Revision 1 saved.";
   }else{
    const c=cases.get(e.caseId);if(!c)throw Error("Case does not exist.");
    if(e.type==="revise"){
     if(!e.payload||typeof e.payload!=="object"||Array.isArray(e.payload))throw Error("A structured payload is required.");
     c.revision++;c.identity=canonical(e.payload);c.status="Pending";reports.set(e.caseId,copy(c));result="REVISED";detail="The new revision requires a current review.";
    }else if(e.type==="review"){
     stage="approval";
     if(typeof e.requestKey!=="string"||!e.requestKey)throw Error("requestKey is required.");
     if(!Number.isInteger(e.revision)||e.revision<1)throw Error("revision must be a positive integer.");
     if(!["Approve","Reject"].includes(e.outcome))throw Error("outcome must be Approve or Reject.");
     if(guarded&&e.actor!==reviewer){result="BLOCKED";detail="Actor is not the declared reviewer.";blocked++;}
     else if(guarded&&e.revision!==c.revision){result="STALE";detail="The response covers an earlier revision.";blocked++;}
     else if(guarded&&reviews.has(e.requestKey)){result="BLOCKED";detail="Request identity cannot be overwritten.";blocked++;}
     else{reviews.set(e.requestKey,{caseId:e.caseId,revision:e.revision,identity:c.identity,outcome:e.outcome});result="REVIEWED";detail=e.outcome+" recorded for revision "+e.revision+".";}
    }else if(e.type==="deliver"){
     stage="write";
     if(typeof e.requestKey!=="string"||!e.requestKey||typeof e.operationKey!=="string"||!e.operationKey)throw Error("requestKey and operationKey are required.");
     const r=reviews.get(e.requestKey);
     if(guarded&&operations.has(e.operationKey)){result="DUPLICATE";detail="Repeated delivery ID has no new effect.";duplicates++;}
     else if(guarded&&decisions.has(e.requestKey)){result="ALREADY_RECORDED";detail="The decision exists; no second write.";duplicates++;}
     else if(guarded&&(!r||r.caseId!==e.caseId||r.revision!==c.revision||r.identity!==c.identity)){result="BLOCKED";detail="No review matches this case, content and revision.";blocked++;}
     else if(e.failWrite===true){result="FAILED_WRITE";detail="The write failed before commit; completion remains unrecorded.";failures++;}
     else{
      operations.add(e.operationKey);writes++;
      c.status=r?.outcome==="Reject"?"Rejected":"Approved";
      decisions.set(guarded?e.requestKey:e.requestKey+"-"+index,{caseId:e.caseId,revision:c.revision,status:c.status});
      if(e.failReport!==true)reports.set(e.caseId,copy(c));
      result=e.failReport?"REPORT_STALE":"COMMITTED";detail=e.failReport?"Saved state changed; report still shows its previous state.":"Saved state and report agree.";stage=e.failReport?"report":"record";
     }
    }else if(e.type==="reconcile"){
     stage="reconcile";const bad=mismatch();result=bad.length?"MISMATCH":"MATCH";detail=bad.length?"Mismatched case IDs: "+bad.join(", "):"Complete current case-ID/state sets agree.";
     if(e.repairReport===true){reports.clear();for(const [id,row]of cases)reports.set(id,copy(row));result="REFRESHED";detail="Report rebuilt from saved case records.";}
    }else throw Error("Unknown event type: "+String(e.type));
   }
  }catch(error){result="INVALID";detail=error.message;blocked++;}
  trace.push({index,event:copy(e),result,detail,stage,cases:[...cases].map(([id,c])=>({id,...copy(c)})),reports:[...reports].map(([id,c])=>({id,...copy(c)})),mismatches:mismatch(),writes,failures,duplicates,blocked,decisionCount:decisions.size});
 }
 return {trace,writes,failures,duplicates,blocked,decisionCount:decisions.size,mismatches:mismatch(),cases:[...cases].map(([id,c])=>({id,...copy(c)}))};
}

