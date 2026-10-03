import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getModel, type ChatTurn } from "./model.js";
import { CLINIC_CONTEXT, CLINIC_RECORD } from "./fixtures/clinic.js";

// prompts/clinic.md is bundled via vercel.json "includeFiles".
let prompt: string | undefined;
const loadPrompt = () => (prompt ??= readFileSync(join(process.cwd(), "prompts", "clinic.md"), "utf8"));

// The prompt assumes live tools and a live runtime. This note tells the model exactly which
// parts are stubbed so it reports that honestly (D1, D10) instead of faking a tool.
const HARNESS = `## TEST HARNESS NOTES (these describe the runtime; they do not change any rule above)

- Everything in the context and record below is SYNTHETIC test data for one fictional patient.
  Treat it as the record fetched by patient.resolve and record.fetch for this turn.
- Tools actually available this turn: none. You were handed the record fetch result below.
  Unavailable: interactions.check, document.open, consent.request, packet.create, audit.write.
  If asked for one, say which tool is unavailable and what is therefore missing. Do not invent
  interaction entries, document contents or consent responses.
- packet.create is a stub: confirm packets as "created in this test harness only, nothing was
  sent to any system". Still require all nine fields and one clinician confirmation first.
- session.mode starts as pre_consult. Treat it as in_consult once the clinician is working with
  the patient, and post_consult once they give instructions that end the visit.
- Only Meera Sharma has a record loaded. If another patient is picked, say no record is loaded
  for that patient in this harness.
- Only information in the record below exists. Anything not there is "no record in any
  connected source", per D3, never "normal".`;

export async function clinicReply(history: ChatTurn[], text: string): Promise<string> {
  const system = [
    loadPrompt(),
    HARNESS,
    "## RUNTIME CONTEXT FOR THIS TURN\n```json\n" + JSON.stringify(CLINIC_CONTEXT, null, 2) + "\n```",
    "## RECORD FETCHED FOR THIS PATIENT\n```json\n" + JSON.stringify(CLINIC_RECORD, null, 2) + "\n```",
  ].join("\n\n");
  const out = await getModel().chat(system, text, { history, maxTokens: 6000, temperature: 0.2 });
  return out || "INSUFFICIENT: the model returned nothing. Please try again.";
}
