import { NextResponse } from "next/server"
import { imagekit } from "@/lib/imagekit"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const params = imagekit.getAuthenticationParameters()
    return NextResponse.json(params)
  } catch (error) {
    console.error("ImageKit auth error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
