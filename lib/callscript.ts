import type { Clock } from "./clock.js";

// The booking call used by /voice.html and the chat's transcript card. Saath's lines are spoken by
// Gnani TTS; the clinic's lines are what the person running the call reads aloud (transcribed by
// Gnani STT). No model is involved. Dates come from the real clock. Fictional clinic and patient.
export interface CallLine { who: "Saath" | "Clinic"; text: string; t: number }   // t = seconds into the call

export const CALL_META = {
  title: "Saath is calling Heartcare Clinic, Vijay Nagar",
  clinic: "Heartcare Clinic, Vijay Nagar",
  duration: "1:24",
};

export function callLines(c: Clock): CallLine[] {
  const when = c.appt.word === "tomorrow" ? "Tomorrow" : c.appt.weekday;
  return [
    { who: "Saath", t: 4, text: "Hello, this is Saath, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before." },
    { who: "Clinic", t: 14, text: "Yes, which day would you like?" },
    { who: "Saath", t: 19, text: "The earliest morning slot you have." },
    { who: "Clinic", t: 27, text: `${when} at 11:30 am is free.` },
    { who: "Saath", t: 36, text: `That works. ${c.appt.d} ${c.appt.monLong}, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports?` },
    { who: "Clinic", t: 52, text: "The fee is 800 rupees. Please bring his old reports." },
    { who: "Saath", t: 66, text: "Thank you. I'll send him the confirmation." },
    { who: "Clinic", t: 75, text: "Okay, thank you." },
  ];
}

export function outcome(c: Clock) {
  return { doctor: "Dr. Meera Kulkarni", date: `${c.appt.d} ${c.appt.monShort}`, time: "11:30 am", fee: "₹800", bring: "old reports" };
}
