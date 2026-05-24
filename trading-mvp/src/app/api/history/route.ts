import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.iamchart.com";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const market = searchParams.get("market") || "kospi";
  const period = searchParams.get("period") || "d";
  const code = searchParams.get("code") || "128820";
  const limit = searchParams.get("limit") || "200";

  const url = `${API_BASE}/stock/${market}/${period}/${code}/${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream API error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
