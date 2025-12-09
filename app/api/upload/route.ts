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

    // Upload to Cloudinary
    console.log(`Uploading to Cloudinary: ${fileName}, ${buffer.length} bytes`)
    
    // For smaller files, use base64. For larger files, we could use upload_stream
    // but base64 should work fine for files under 15MB
    const base64Data = buffer.toString("base64")
    const base64String = `data:${fileType};base64,${base64Data}`
    
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
              console.error("Error message:", error.message)
              console.error("Error http_code:", error.http_code)
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
      console.error("Cloudinary error caught:", cloudinaryError)
      console.error("Error type:", typeof cloudinaryError)
      console.error("Error stack:", cloudinaryError instanceof Error ? cloudinaryError.stack : "No stack trace")
      
      // Extract more detailed error information
      let errorMessage = "Cloudinary upload failed"
      let errorCode = undefined
      
      if (cloudinaryError instanceof Error) {
        errorMessage = cloudinaryError.message
        // Check if it's a Cloudinary error object
        if ('http_code' in cloudinaryError) {
          errorCode = (cloudinaryError as any).http_code
          errorMessage = `Cloudinary error (${errorCode}): ${errorMessage}`
        }
      } else if (typeof cloudinaryError === 'object' && cloudinaryError !== null) {
        errorMessage = JSON.stringify(cloudinaryError)
      } else {
        errorMessage = String(cloudinaryError)
      }
      
      const errorDetails = cloudinaryError instanceof Error ? cloudinaryError.stack : String(cloudinaryError)
      
      return NextResponse.json({ 
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === "development" ? errorDetails : undefined
      }, { status: 500 })
    }

    if (!result || !result.secure_url) {
      console.error("Invalid Cloudinary result:", result)
      return NextResponse.json({ error: "Upload succeeded but no URL returned" }, { status: 500 })
    }

    // Save to database
    try {
      console.log("Saving image to database...")
      const image = await addImage(fileName, result.secure_url)
      console.log("Image saved successfully with ID:", image.id)
      return NextResponse.json({ success: true, url: result.secure_url, id: image.id })
    } catch (dbError) {
      console.error("Database save error:", dbError)
      console.error("Error stack:", dbError instanceof Error ? dbError.stack : "No stack trace")
      const errorDetails = dbError instanceof Error ? dbError.stack : String(dbError)
      // Image uploaded but failed to save metadata - still return success but log error
      return NextResponse.json({ 
        success: true, 
        url: result.secure_url, 
        warning: "Image uploaded but metadata save failed",
        error: process.env.NODE_ENV === "development" ? errorDetails : undefined
      })
    }
  } catch (error) {
    console.error("Upload error (unexpected):", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    const message = error instanceof Error ? error.message : "Upload failed"
    const errorDetails = error instanceof Error ? error.stack : String(error)
    return NextResponse.json({ 
      error: message,
      details: process.env.NODE_ENV === "development" ? errorDetails : undefined
    }, { status: 500 })
  }
}

