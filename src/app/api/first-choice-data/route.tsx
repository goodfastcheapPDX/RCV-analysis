export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { handleFirstChoiceDataRequest } from "./handler";

export async function GET(request: NextRequest) {
  // Get election and contest from query params
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId") || undefined;
  const contestId = searchParams.get("contestId") || undefined;

  const result = await handleFirstChoiceDataRequest({ electionId, contestId });

  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
}
