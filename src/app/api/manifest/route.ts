import { NextResponse } from "next/server";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

export async function GET() {
  try {
    const manifest = await loadManifestFromFs();
    return NextResponse.json(manifest);
  } catch (error) {
    console.error("Failed to load manifest:", error);
    return NextResponse.json(
      { error: "Failed to load manifest" },
      { status: 500 },
    );
  }
}
