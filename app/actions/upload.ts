"use server"

import { createClient } from "@/lib/supabase/server"

export async function uploadImage(formData: FormData) {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Unauthorized" }
  }

  const file = formData.get("file") as File
  if (!file) {
    return { error: "No file provided" }
  }

  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File too large. Maximum size is 10MB." }
  }

  try {
    // Upload directly using fetch to Vercel Blob API
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const response = await fetch(`https://blob.vercel-storage.com/${file.name}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        "Content-Type": file.type || "image/jpeg",
        "x-api-version": "7",
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Blob upload failed:", errorText)
      return { error: "Failed to upload image" }
    }

    const blob = await response.json()

    // Save to database
    const { error: dbError } = await supabase.from("images").insert({
      url: blob.url,
      filename: file.name,
    })

    if (dbError) {
      console.error("[v0] Database error:", dbError)
      return { error: "Failed to save image metadata" }
    }

    return { success: true, url: blob.url }
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return { error: error instanceof Error ? error.message : "Upload failed" }
  }
}
