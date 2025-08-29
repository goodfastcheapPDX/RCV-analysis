import { NextResponse } from "next/server";
import { handleManifestRequest } from "./handler";

export async function GET() {
  const result = await handleManifestRequest();

  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
}
