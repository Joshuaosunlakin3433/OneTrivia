import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type QuestionInput = {
  question_text: string;
  options: string[];
  correct_index: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      onchain_game_id?: unknown;
      questions?: unknown;
    };

    const { onchain_game_id, questions } = body;

    if (typeof onchain_game_id !== "string" || !onchain_game_id.trim()) {
      return NextResponse.json(
        { error: "onchain_game_id is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "questions must be a non-empty array" },
        { status: 400 },
      );
    }

    // Validate question shape
    for (const q of questions as QuestionInput[]) {
      if (
        typeof q.question_text !== "string" ||
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        typeof q.correct_index !== "number"
      ) {
        return NextResponse.json(
          { error: "Invalid question shape in array" },
          { status: 400 },
        );
      }
    }

    // Mark any existing active games as completed so the new one surfaces first
    await prisma.game.updateMany({
      where: { status: "active" },
      data: { status: "completed" },
    });

    const game = await prisma.game.create({
      data: {
        onchain_game_id: onchain_game_id.trim(),
        status: "active",
        questions: {
          create: (questions as QuestionInput[]).map((q) => ({
            question_text: q.question_text,
            options: q.options,
            correct_index: q.correct_index,
          })),
        },
      },
      include: { questions: true },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Failed to create arena game:", error);
    return NextResponse.json(
      { error: "Failed to create arena game" },
      { status: 500 },
    );
  }
}
