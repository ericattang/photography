import { put } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  console.log("[v0] Upload route called")

  try {
    const supabase = await createClient()
    console.log("[v0] Supabase client created")

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("[v0] Auth check:", { user: user?.email, error: authError?.message })

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Parsing request body")
    const body = await request.json()
    const { filename, contentType, data } = body
    console.log("[v0] Parsed body:", { filename, contentType, dataLength: data?.length })

    if (!filename || !data) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Decode base64 to buffer
    console.log("[v0] Decoding base64")
    const buffer = Buffer.from(data, "base64")
    console.log("[v0] Buffer size:", buffer.length)

    // Check file size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    console.log("[v0] Uploading to Vercel Blob")
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: contentType || "image/jpeg",
    })
    console.log("[v0] Blob uploaded:", blob.url)

    // Save to database
    console.log("[v0] Saving to database")
    const { error: dbError } = await supabase.from("images").insert({
      url: blob.url,
      filename: filename,
    })

    if (dbError) {
      console.error("[v0] Database error:", dbError)
      return NextResponse.json({ error: "Failed to save image metadata" }, { status: 500 })
    }

    console.log("[v0] Upload complete")
    return NextResponse.json({ success: true, url: blob.url })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
