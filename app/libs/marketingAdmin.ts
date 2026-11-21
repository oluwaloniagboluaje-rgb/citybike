import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import { getUserFromRequest, resolveUserRole } from "@/libs/auth";
import User from "@/models/User";

export async function authorizeMarketingAdmin(
  request: NextRequest
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }
> {
  const auth = getUserFromRequest(request);
  if (!auth) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  await connectDB();
  const user = await User.findById(auth.userId)
    .select("email role isActive")
    .lean();

  if (
    !user ||
    user.isActive === false ||
    resolveUserRole(user.email, user.role) !== "admin"
  ) {
    return { ok: false, error: "Administrator access required", status: 403 };
  }

  return { ok: true, userId: user._id.toString() };
}

export function marketingAuthError(
  auth: { ok: false; error: string; status: number }
): NextResponse {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}
