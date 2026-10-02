import Anthropic from "@anthropic-ai/sdk";
import { EXTRACT_TOOL } from "../schema.js";
import type { Model } from "../model.js";

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const modelId = () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export const anthropicModel: Model = {
  async chat(system, userText) {
    const res = await getClient().messages.create({
      model: modelId(),
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userText }],
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  },

  async extract(system, imageBase64, mime, caption) {
    const res = await getClient().messages.create({
      model: modelId(),
      max_tokens: 2000,
      system,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: imageBase64 } },
            { type: "text", text: `Extract the medication lines from this image.${caption ? ` User note: ${caption}` : ""}` },
          ],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Model returned no structured extraction");
    return block.input;
  },
};
