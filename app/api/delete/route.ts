import { del } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { url, id } = await request.json()

    if (!url || !id) {
      return NextResponse.json({ error: "Missing url or id" }, { status: 400 })
    }

    // Delete from Vercel Blob
    await del(url)

    // Delete from Supabase
    const { error: dbError } = await supabase.from("images").delete().eq("id", id)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
