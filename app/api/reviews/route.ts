import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Review from "@/models/review";
import { z } from "zod";

const createReviewSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5),
  text: z.string().trim().min(1, "Review text is required").max(1000),
});

export async function GET() {
  await connectDB();

  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  await connectDB();

  const body = await req.json();
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const review = await Review.create(parsed.data);

  return NextResponse.json({ review }, { status: 201 });
}