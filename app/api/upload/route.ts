import { isAuthenticated } from "@/lib/auth"
import { addImage } from "@/lib/storage"
import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { filename, contentType, data } = body

    if (!filename || !data) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Decode base64 to buffer
    let buffer
    try {
      buffer = Buffer.from(data, "base64")
    } catch (bufferError) {
      console.error("Buffer decode error:", bufferError)
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 })
    }

    // Check file size (10MB limit)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    // Upload to Cloudinary
    const base64String = `data:${contentType || "image/jpeg"};base64,${data}`
    
    let result
    try {
      result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload(
          base64String,
          {
            folder: "photography-portfolio",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error)
              reject(error)
            } else if (!result) {
              reject(new Error("Cloudinary returned no result"))
            } else {
              resolve(result)
            }
          }
        )
      })
    } catch (cloudinaryError) {
      console.error("Cloudinary error:", cloudinaryError)
      const errorMessage = cloudinaryError instanceof Error ? cloudinaryError.message : "Cloudinary upload failed"
      return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 })
    }

    if (!result || !result.secure_url) {
      console.error("Invalid Cloudinary result:", result)
      return NextResponse.json({ error: "Upload succeeded but no URL returned" }, { status: 500 })
    }

    // Save to database
    try {
      const image = await addImage(filename, result.secure_url)
      return NextResponse.json({ success: true, url: result.secure_url, id: image.id })
    } catch (dbError) {
      console.error("Database save error:", dbError)
      // Image uploaded but failed to save metadata - still return success but log error
      return NextResponse.json({ 
        success: true, 
        url: result.secure_url, 
        warning: "Image uploaded but metadata save failed" 
      })
    }
  } catch (error) {
    console.error("Upload error (unexpected):", error)
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
