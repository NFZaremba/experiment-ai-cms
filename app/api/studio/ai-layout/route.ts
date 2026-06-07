import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isStudioAuthed } from "@/lib/studio/auth";
import { clientIp, rateLimit } from "@/lib/studio/rate-limit";
import { isLayoutPath, isValidLayout, layoutFieldFor } from "@/lib/content/layout-vocab";

export const runtime = "nodejs";

/**
 * Translate a natural-language layout instruction into ONE allowed layout value.
 *
 * Safety: the model is forced (tool-use + enum input schema) to return a value
 * from this field's allowlist, and the server RE-VALIDATES with isValidLayout
 * before responding. The AI can never produce an out-of-vocabulary value or any
 * code — it's purely a natural-language front-end to the same constrained set of
 * options the panel's buttons expose.
 */
export async function POST(req: Request) {
  if (!(await isStudioAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(`ai-layout:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many AI requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI isn't configured. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    path?: unknown;
    instruction?: unknown;
    currentValue?: unknown;
  };
  if (typeof body.path !== "string" || !isLayoutPath(body.path)) {
    return NextResponse.json({ error: "Unknown layout field." }, { status: 400 });
  }
  if (typeof body.instruction !== "string" || !body.instruction.trim()) {
    return NextResponse.json({ error: "Instruction is required." }, { status: 400 });
  }
  const field = layoutFieldFor(body.path)!;
  const allowed = field.options.map((o) => o.value);
  const current = typeof body.currentValue === "string" ? body.currentValue : field.default;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      // Force the model to call the tool, whose input enum is the allowlist.
      tool_choice: { type: "tool", name: "set_layout" },
      tools: [
        {
          name: "set_layout",
          description: `Choose the value for the "${field.label}" layout control. Only the allowed enum values may be used.`,
          input_schema: {
            type: "object",
            properties: {
              value: {
                type: "string",
                enum: allowed,
                description: field.options.map((o) => `${o.value} = ${o.label}`).join("; "),
              },
            },
            required: ["value"],
          },
        },
      ],
      system:
        "You map a short natural-language layout instruction to exactly one allowed value. " +
        "You MUST call set_layout with a value from the provided enum. Never invent values. " +
        "If the instruction is unclear, keep the current value.",
      messages: [
        {
          role: "user",
          content:
            `Control: "${field.label}". Current value: "${current}". ` +
            `Allowed values: ${field.options.map((o) => `${o.value} (${o.label})`).join(", ")}. ` +
            `Instruction: "${body.instruction}". Pick the single best allowed value.`,
        },
      ],
    });

    const tool = msg.content.find((b) => b.type === "tool_use");
    const value = tool && "input" in tool ? (tool.input as { value?: unknown }).value : undefined;

    // Server-authoritative re-validation — the AI cannot escape the allowlist.
    if (!isValidLayout(body.path, value)) {
      return NextResponse.json(
        { error: "AI returned an invalid value.", detail: String(value) },
        { status: 422 }
      );
    }
    return NextResponse.json({ path: body.path, value });
  } catch (e) {
    return NextResponse.json({ error: "AI request failed.", detail: String(e) }, { status: 500 });
  }
}
