import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type GeneratedQuestion = {
  question_text: string;
  options: string[];
  correct_index: number;
};

function extractMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown generation error";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim()
    ? message
    : "Unknown generation error";
}

function parseRetrySeconds(message: string): number | null {
  const m = message.match(/Please retry in\s+([0-9.]+)s/i);
  if (!m) return null;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}

function sanitizeModelJson(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

function isValidQuestionArray(value: unknown): value is GeneratedQuestion[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((q) => {
    if (!q || typeof q !== "object") return false;
    const question = q as Record<string, unknown>;
    if (
      typeof question.question_text !== "string" ||
      !question.question_text.trim()
    ) {
      return false;
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      return false;
    }
    if (
      !question.options.every((opt) => typeof opt === "string" && opt.trim())
    ) {
      return false;
    }
    if (typeof question.correct_index !== "number") return false;
    return (
      question.correct_index >= 0 &&
      question.correct_index < question.options.length
    );
  });
}

async function generateWithModel(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
): Promise<GeneratedQuestion[]> {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const rawText = result?.response?.text() || "";
  const cleaned = sanitizeModelJson(rawText);
  const parsed = JSON.parse(cleaned) as unknown;

  if (!isValidQuestionArray(parsed)) {
    throw new Error(`Model ${modelName} returned invalid question payload`);
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set" },
        { status: 500 },
      );
    }

    if (typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const primaryModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
    const configuredFallbacks = (process.env.GEMINI_MODEL_FALLBACKS || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const modelCandidates = [
      primaryModel,
      ...configuredFallbacks,
      "gemma-3-1b-it",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash-001",
    ].filter((model, idx, arr) => arr.indexOf(model) === idx);

    const prompt = `Generate 3 trivia questions about: ${topic.trim()}. Return ONLY a valid JSON array format exactly like this: [{"question_text": "...", "options": ["A","B","C","D"], "correct_index": 0}]. Random seed: ${Date.now()}`;

    const errors: string[] = [];

    for (const modelName of modelCandidates) {
      try {
        const questions = await generateWithModel(genAI, modelName, prompt);
        return NextResponse.json(questions);
      } catch (error) {
        errors.push(`${modelName}: ${extractMessage(error)}`);
      }
    }

    const lastError = errors[errors.length - 1] || "All Gemini models failed";
    const isQuotaError = /quota|429|rate limit|too many requests/i.test(
      lastError,
    );
    const retryAfterSeconds = parseRetrySeconds(lastError);

    if (isQuotaError) {
      return NextResponse.json(
        {
          error:
            retryAfterSeconds !== null
              ? `Gemini quota exceeded. Please retry in about ${retryAfterSeconds}s.`
              : "Gemini quota exceeded. Please retry shortly.",
          modelAttempts: errors,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Failed to generate valid questions from all configured AI models.",
        modelAttempts: errors,
      },
      { status: 502 },
    );
  } catch (err: unknown) {
    let message = "Internal error";
    if (err && typeof err === "object" && "message" in err) {
      message = (err as { message?: string }).message || message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
