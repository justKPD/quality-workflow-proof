# Quality Workflow Proof
Independent work sample for Bosch working-student vacancy REF276419K, quality management and AI process optimization, Bamberg.

Public walkthrough: https://quality-workflow-proof.vercel.app/

## Engineering question
Can a repeated delivery, stale review or incomplete write be mistaken for a completed process, and will the report still agree with the saved case?

The public page computes editable event replays. It distinguishes revision checks, approval decisions, destination writes and report state. It does not operate the Microsoft environment.
The intentionally shallow control omits review/version and idempotency guards. It is a diagnostic control, not Bosch's implementation or a competitive benchmark.

## Run
Serve the site folder using a static server:

    python -m http.server 8796 --directory site

No runtime dependency, cloud credential or tenant connection is needed for the public replay.

## Tests
    node --test test.mjs

Fifteen engine tests cover clean controls, partial writes/recovery, stale reviews, report mismatch/refresh, rejection, event order, optional schema extensions, renamed required fields, reviewer mismatch, timestamps and duplicate decisions.
Nine rollout checks are also executable in the page. These are conformance checks against the authored contract, not measured production improvements.

## Native Microsoft proof
A separate development environment contains a real Power App, Dataverse records and native Microsoft approval flows.
Actual human approval/rejection, stale-revision blocking, failed-write rollback/recovery and duplicate handling were verified.
Four synchronized native delivery submissions produced one approval decision and three AlreadyRecorded results.
A loaded Power BI Desktop model matched complete record-ID sets and all selected fields from a saved Dataverse snapshot: 16 cases, 15 requests, 12 decisions and 9 deliveries.
The populated Microsoft solution was exported with connection references and environment settings.
Only a sanitized summary is included in site/microsoft-evidence.json. No tenant identifiers, accounts, tokens or private solution exports are published here.

## Boundaries
Public browser replay is separate from actual Microsoft execution. The native proof uses one signed-in reviewer.
Power BI uses a saved import snapshot, not automatic source refresh. A second-environment import, large-load testing, production multi-user authorization, KNIME and Copilot Studio implementations are not established.
No Bosch systems, proprietary process data, safety certification or employer savings are claimed.
The precise internal project and data sources for the vacancy remain unconfirmed. Uwe Voll is the named functional contact.

## Sources
- Official vacancy: https://jobs.smartrecruiters.com/BoschGroup/744000157733301
- Official Bamberg Shopfloor Agent context: https://www.bosch.com/stories/agentic-ai-manufacturing-production/
- Related earlier work: https://github.com/justKPD/reuse-durability-lab

