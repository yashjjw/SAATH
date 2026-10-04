// The scripted booking call used by /voice.html. Saathi's lines are spoken by Gnani TTS; the
// clinic's lines are what the person running the demo reads aloud (transcribed by Gnani STT).
// No model is involved. Fictional mock data from the Feature 1 design doc.
export interface CallLine { who: "Saathi" | "Clinic"; text: string }

export const CALL = {
  title: "Scripted call: you play Heartcare Clinic reception, Saathi (AI) phones to book",
  clinic: "Heartcare Clinic, Vijay Nagar",
  lines: [
    { who: "Saathi", text: "Hello, this is Saathi, an AI assistant. I'm calling on behalf of Mr. Ramesh Sharma. Could I book an appointment with Dr. Kulkarni? He has visited your clinic before." },
    { who: "Clinic", text: "Yes, which day would you like?" },
    { who: "Saathi", text: "The earliest morning slot you have." },
    { who: "Clinic", text: "Tomorrow at 11:30 am is free." },
    { who: "Saathi", text: "That works. 6 October, 11:30 am, under the name Ramesh Sharma. What are the fees, and should he bring any reports?" },
    { who: "Clinic", text: "The fee is 800 rupees. Please bring his old reports." },
    { who: "Saathi", text: "Thank you. I'll send him the confirmation." },
    { who: "Clinic", text: "Okay, thank you." },
  ] as CallLine[],
};
