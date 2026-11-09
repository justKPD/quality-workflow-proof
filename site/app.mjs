import{run,presets,copy}from"./engine.mjs";
const $=id=>document.getElementById(id);let results,events=[],idx=0,guarded=true,timer=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const stop=()=>{clearInterval(timer);timer=null;$("play").textContent="▶ Play";};
function safe(fn){return(...a)=>{try{$("error").hidden=true;return fn(...a);}catch(e){stop();$("error").hidden=false;$("error").textContent=e.message;}};}
for(const [key,p]of Object.entries(presets))$("scenario").append(new Option(p.title,key));
function load(){stop();$("events").value=JSON.stringify(presets[$("scenario").value].events,null,2);$("description").textContent=presets[$("scenario").value].title;execute();}
function execute(){stop();events=JSON.parse($("events").value);results={guarded:run(events,{reviewer:$("reviewer").value}),shallow:run(events,{guarded:false,reviewer:$("reviewer").value})};idx=0;$("scrub").max=events.length-1;render();}
function render(){
 const r=guarded?results.guarded:results.shallow;const row=r.trace[idx];if(!row)return;
 $("guarded").classList.toggle("selected",guarded);$("shallow").classList.toggle("selected",!guarded);
 $("run-title").textContent=guarded?"Computed guarded workflow":"Computed shallow control";
 $("verdict").textContent=row.result;
 const names=[["request","Request"],["approval","Review"],["write","Write"],["record","Record"],["report","Report"],["reconcile","Compare"]];
 $("diagram").replaceChildren(...names.map(([id,label],i)=>{const n=el("div",undefined,"stage");n.append(el("strong",String(i+1).padStart(2,"0")),el("span",label));if(id===row.stage)n.classList.add("active");if(id===row.stage&&["BLOCKED","STALE","INVALID","FAILED_WRITE","MISMATCH","REPORT_STALE"].includes(row.result))n.classList.add("bad");return n;}));
 const c=row.cases.find(c=>c.id===row.event?.caseId),s=row.reports.find(c=>c.id===row.event?.caseId);
 $("saved-state").textContent=c?.status||"Not created";$("report-state").textContent=s?.status||"No record";
 $("saved-revision").textContent=c?"Revision "+c.revision+" · "+c.id:"";$("report-revision").textContent=s?"Revision "+s.revision+" · "+s.id:"";
 $("writes").textContent=row.writes;$("decisions").textContent=row.decisionCount;$("failures").textContent=row.failures;$("mismatches").textContent=row.mismatches.length;
 $("observation").replaceChildren(el("b",row.result.replaceAll("_"," ")+" · "),document.createTextNode(row.detail));
 $("scrub").value=idx;$("step-label").textContent=(idx+1)+" / "+r.trace.length;
 $("timeline").replaceChildren(...r.trace.map((step,i)=>{const b=el("button",undefined,i===idx?"selected":"");b.append(el("span",String(i+1)),el("span",step.event?.type+" · "+(step.event?.caseId||"invalid case")),el("span",step.result,"outcome"));b.onclick=()=>{stop();idx=i;render();};return b;}));
}
$("scenario").onchange=safe(load);$("run").onclick=safe(execute);
$("guarded").onclick=()=>{stop();guarded=true;render();};$("shallow").onclick=()=>{stop();guarded=false;render();};
$("scrub").oninput=()=>{stop();idx=Number($("scrub").value);render();};
$("play").onclick=()=>{if(timer){stop();return;}if(idx===events.length-1)idx=0;render();$("play").textContent="Ⅱ Pause";timer=setInterval(()=>{if(idx>=events.length-1){stop();return;}idx++;render();},1050);};
$("refresh").onclick=safe(()=>{const e=JSON.parse($("events").value);const last=e.at(-1);if(!last?.caseId)throw Error("A case ID is needed before report refresh.");e.push({type:"reconcile",caseId:last.caseId,repairReport:true});$("events").value=JSON.stringify(e,null,2);execute();idx=e.length-1;render();});
$("export").onclick=safe(()=>{const payload={format:"quality-workflow-proof/1",created:new Date().toISOString(),mode:"Independent browser simulation, not Microsoft execution",reviewer:$("reviewer").value,events,guarded:results.guarded,shallow:results.shallow};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=el("a");a.href=url;a.download="quality-workflow-evidence.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function rollout(){
 const checks=[];const c=copy(presets.clean.events),changed=copy(c);changed[2].optionalComment="benign extension";
 checks.push(["Optional schema extension",run(changed).writes===1]);
 const renamed=copy(c);renamed[2].requestId=renamed[2].requestKey;delete renamed[2].requestKey;checks.push(["Required field renamed",run(renamed).trace[2].result==="INVALID"]);
 const wrong=copy(c);wrong[1].actor="unassigned";checks.push(["Unassigned review actor",run(wrong).writes===0]);
 const time=copy(c);time[1].timestamp="2026-11-09T09:00:00";checks.push(["Ambiguous local timestamp",run(time).trace[1].result==="INVALID"]);
 checks.push(["Failed write remains uncommitted",run(presets.retry.events).trace[2].decisionCount===0]);
 checks.push(["Retry creates one decision",run(presets.retry.events).decisionCount===1]);
 checks.push(["Old revision is blocked",run(presets.stale.events).writes===0]);
 checks.push(["Stale report is detected",run(presets.report.events).mismatches.length===1]);
 checks.push(["Clean case needs no extra write",run(c).writes===run(c,{guarded:false}).writes]);
 $("regression").replaceChildren(...checks.map(([label,pass])=>{const r=el("div",undefined,"check");r.append(el("span",label),el("b",pass?"PASS":"FAIL"));return r;}));
 $("regression").dataset.passed=String(checks.filter(x=>x[1]).length);return checks;
}
$("regression-run").onclick=safe(rollout);
async function evidence(){
 const response=await fetch("microsoft-evidence.json");if(!response.ok)throw Error("Recorded Microsoft evidence could not load.");const proof=await response.json();
 $("proof-grid").replaceChildren(...proof.checks.map(c=>{const n=el("div",undefined,"card");n.append(el("strong","VERIFIED MICROSOFT RESULT"),el("h3",c.title),el("p",c.result),el("small",c.limit,"muted"));return n;}));
 $("bi-counts").replaceChildren(...Object.entries(proof.power_bi.counts).map(([name,count])=>{const n=el("div");n.append(el("small",name),el("strong",String(count)));return n;}));
 $("bi-counts").dataset.verified="true";
 $("source-link").href=proof.source;$("source-link").textContent="Source & verification ↗";
}
$("scenario").value="retry";load();rollout();evidence().catch(e=>{$("error").hidden=false;$("error").textContent=e.message;});

