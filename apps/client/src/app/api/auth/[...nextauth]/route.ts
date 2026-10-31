import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const target = callbackUrl.startsWith("/") ? `${origin}${callbackUrl}` : callbackUrl;
  return NextResponse.redirect(target);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
