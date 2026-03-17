import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const game = await prisma.game.findFirst({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
      include: { questions: true },
    });

    if (!game) {
      return NextResponse.json(
        { message: "No active arena games" },
        { status: 404 },
      );
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error("Failed to fetch active arena game:", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error:
            "Database connection failed. Check DATABASE_URL and DB network access.",
        },
        { status: 503 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return NextResponse.json(
        {
          error:
            "Arena tables are missing. Run Prisma db push or migrations for the web app.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch active arena game" },
      { status: 500 },
    );
  }
}
