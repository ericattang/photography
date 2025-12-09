import { isAuthenticated } from "@/lib/auth"
import { addImage } from "@/lib/storage"
import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

// Configure route to handle larger file uploads
export const runtime = "nodejs"
export const maxDuration = 60

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export async function POST(request: NextRequest) {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("Cloudinary not configured - missing environment variables")
      return NextResponse.json({ error: "Upload service not configured. Please configure Cloudinary environment variables." }, { status: 500 })
    }

    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check content type to determine parsing method
    const contentType = request.headers.get("content-type") || ""
    console.log("Content-Type:", contentType)

    let fileName = ""
    let fileType = "image/jpeg"
    let buffer: Buffer

    // Try FormData first (for multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        
        if (!file || !(file instanceof File)) {
          return NextResponse.json({ error: "No file provided in FormData" }, { status: 400 })
        }

        fileName = file.name
        fileType = file.type || "image/jpeg"
        const arrayBuffer = await file.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
      } catch (parseError) {
        console.error("FormData parse error:", parseError)
        const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parse error"
        return NextResponse.json({ 
          error: `Failed to parse FormData: ${errorMessage}`,
          suggestion: "Try using JSON format with base64 encoded data instead"
        }, { status: 400 })
      }
    } else {
      // Parse as JSON with base64 data
      let body
      try {
        body = await request.json()
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parse error"
        return NextResponse.json({ 
          error: `Invalid request body: ${errorMessage}`,
          suggestion: "Ensure the request body is valid JSON with filename, contentType, and data (base64) fields"
        }, { status: 400 })
      }

      const { filename, contentType: bodyContentType, data } = body

      if (!filename || !data) {
        return NextResponse.json({ error: "No file provided. Missing filename or data field." }, { status: 400 })
      }

      fileName = filename
      fileType = bodyContentType || "image/jpeg"

      try {
        buffer = Buffer.from(data, "base64")
      } catch (bufferError) {
        console.error("Buffer decode error:", bufferError)
        return NextResponse.json({ error: "Invalid image data. Base64 decoding failed." }, { status: 400 })
      }
    }

    console.log(`Uploading file: ${fileName}, size: ${buffer.length} bytes, type: ${fileType}`)

    // Check file size (15MB limit)
    if (buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 15MB." }, { status: 400 })
    }

    // Convert buffer to base64 for Cloudinary
    let base64String: string
    try {
      const base64Data = buffer.toString("base64")
      base64String = `data:${fileType};base64,${base64Data}`
      console.log(`Base64 conversion complete, length: ${base64String.length}`)
    } catch (base64Error) {
      console.error("Base64 conversion error:", base64Error)
      return NextResponse.json({ error: "Failed to convert image to base64" }, { status: 500 })
    }
    
    let result
    try {
      console.log("Starting Cloudinary upload...")
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
              console.error("Cloudinary error details:", {
                message: error.message,
                http_code: error.http_code,
                name: error.name,
              })
              reject(error)
            } else if (!result) {
              reject(new Error("Cloudinary returned no result"))
            } else {
              console.log("Cloudinary upload successful:", result.secure_url)
              resolve(result)
            }
          }
        )
      })
    } catch (cloudinaryError) {
      console.error("Cloudinary error (catch):", cloudinaryError)
      console.error("Cloudinary error stack:", cloudinaryError instanceof Error ? cloudinaryError.stack : "No stack trace")
      const errorMessage = cloudinaryError instanceof Error ? cloudinaryError.message : "Cloudinary upload failed"
      return NextResponse.json({ 
        error: `Upload failed: ${errorMessage}`,
        details: process.env.NODE_ENV === "development" ? (cloudinaryError instanceof Error ? cloudinaryError.stack : String(cloudinaryError)) : undefined
      }, { status: 500 })
    }

    if (!result || !result.secure_url) {
      console.error("Invalid Cloudinary result:", result)
      return NextResponse.json({ error: "Upload succeeded but no URL returned" }, { status: 500 })
    }

    // Save to database
    try {
      console.log("Saving image to database:", { fileName, url: result.secure_url })
      const image = await addImage(fileName, result.secure_url)
      console.log("Image saved successfully:", image.id)
      return NextResponse.json({ success: true, url: result.secure_url, id: image.id })
    } catch (dbError) {
      console.error("Database save error:", dbError)
      console.error("Database error stack:", dbError instanceof Error ? dbError.stack : "No stack trace")
      console.error("Database error details:", {
        name: dbError instanceof Error ? dbError.name : typeof dbError,
        message: dbError instanceof Error ? dbError.message : String(dbError),
      })
      // Image uploaded but failed to save metadata - still return success but log error
      return NextResponse.json({ 
        success: true, 
        url: result.secure_url, 
        warning: "Image uploaded but metadata save failed",
        error: process.env.NODE_ENV === "development" ? (dbError instanceof Error ? dbError.message : String(dbError)) : undefined
      })
    }
  } catch (error) {
    console.error("Upload error (unexpected):", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("Error details:", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    })
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ 
      error: message,
      details: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : String(error)) : undefined
    }, { status: 500 })
  }
}

