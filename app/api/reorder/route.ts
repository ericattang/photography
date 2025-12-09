import { isAuthenticated } from "@/lib/auth"
import { reorderImages } from "@/lib/storage"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  // Check authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { newOrder } = body

    if (!Array.isArray(newOrder)) {
      return NextResponse.json({ error: "Invalid request: newOrder must be an array" }, { status: 400 })
    }

    const success = await reorderImages(newOrder)

    if (!success) {
      return NextResponse.json({ error: "Failed to reorder images" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reorder error:", error)
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 })
  }
}



