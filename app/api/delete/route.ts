import { isAuthenticated } from "@/lib/auth"
import { deleteImage, getImages } from "@/lib/storage"
import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function DELETE(request: NextRequest) {
  // Check authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    // Get image to find Cloudinary public_id
    const images = await getImages()
    const image = images.find((img) => img.id === id)

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const urlParts = image.url.split("/")
    const uploadIndex = urlParts.findIndex((part) => part === "upload")
    if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
      // Get everything after "upload" and before the file extension
      const pathAfterUpload = urlParts.slice(uploadIndex + 1).join("/")
      const publicId = pathAfterUpload.replace(/\.[^/.]+$/, "") // Remove file extension
      
      // Delete from Cloudinary
      try {
        await cloudinary.uploader.destroy(publicId)
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError)
        // Continue even if Cloudinary delete fails
      }
    }

    // Delete from database
    const success = await deleteImage(id)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete from database" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
