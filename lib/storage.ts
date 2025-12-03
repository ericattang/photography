import { kv } from "@vercel/kv"
import { promises as fs } from "fs"
import path from "path"

const IMAGES_KEY = "photography:images"
const DATA_DIR = path.join(process.cwd(), "data")
const IMAGES_DB = path.join(DATA_DIR, "images.json")

export interface ImageData {
  id: string
  url: string
  filename: string
  created_at: string
  order?: number
  column?: number
  position?: number
}

// Check if Vercel KV is configured
function isKVConfigured(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    process.env.KV_REST_API_URL !== "your_kv_url"
  )
}

// Local file storage fallback
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(IMAGES_DB)
  } catch {
    await fs.writeFile(IMAGES_DB, JSON.stringify([]), "utf-8")
  }
}

async function getImagesFromFile(): Promise<ImageData[]> {
  await ensureDataDir()
  const data = await fs.readFile(IMAGES_DB, "utf-8")
  return JSON.parse(data || "[]")
}

async function saveImagesToFile(images: ImageData[]) {
  await ensureDataDir()
  await fs.writeFile(IMAGES_DB, JSON.stringify(images, null, 2), "utf-8")
}

// Get all images
export async function getImages(): Promise<ImageData[]> {
  try {
    if (isKVConfigured()) {
      const images = await kv.get<ImageData[]>(IMAGES_KEY)
      if (!images) return []
      // Sort by order if available, otherwise by created_at (newest first)
      return images.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order
        }
        if (a.order !== undefined) return -1
        if (b.order !== undefined) return 1
        // Newest first (descending order)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    } else {
      // Fallback to local file storage
      const images = await getImagesFromFile()
      return images.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order
        }
        if (a.order !== undefined) return -1
        if (b.order !== undefined) return 1
        // Newest first (descending order)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
  } catch (error) {
    console.error("Error fetching images:", error)
    // Fallback to local storage on error
    try {
      const images = await getImagesFromFile()
      return images.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order
        }
        if (a.order !== undefined) return -1
        if (b.order !== undefined) return 1
        // Newest first (descending order)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    } catch {
      return []
    }
  }
}

// Add an image
export async function addImage(filename: string, url: string): Promise<ImageData> {
  const images = await getImages()
  
  // New images should appear first, so we'll insert at the beginning
  // Shift all existing orders by 1 and set new image to order 0
  const updatedImages = images.map((img, index) => ({
    ...img,
    order: (img.order ?? index) + 1
  }))
  
  // Generate UUID - use crypto.randomUUID() if available, otherwise fallback
  let imageId: string
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      imageId = crypto.randomUUID()
    } else {
      // Fallback for environments without crypto.randomUUID()
      imageId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    }
  } catch {
    // Fallback for environments without crypto.randomUUID()
    imageId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }
  
  const newImage: ImageData = {
    id: imageId,
    url,
    filename,
    created_at: new Date().toISOString(),
    order: 0, // New images get order 0 (appear first)
  }
  
  updatedImages.unshift(newImage) // Add to beginning
  const imagesToSave = updatedImages
  
  try {
    if (isKVConfigured()) {
      await kv.set(IMAGES_KEY, imagesToSave)
    } else {
      await saveImagesToFile(imagesToSave)
    }
  } catch (error) {
    console.error("Error saving image:", error)
    // Try fallback
    if (isKVConfigured()) {
      await saveImagesToFile(imagesToSave)
    } else {
      throw error
    }
  }
  
  return newImage
}

// Delete an image
export async function deleteImage(id: string): Promise<boolean> {
  const images = await getImages()
  const image = images.find((img) => img.id === id)
  
  if (!image) {
    return false
  }
  
  // Remove from database
  const filtered = images.filter((img) => img.id !== id)
  
  try {
    if (isKVConfigured()) {
      await kv.set(IMAGES_KEY, filtered)
    } else {
      await saveImagesToFile(filtered)
    }
  } catch (error) {
    console.error("Error deleting image:", error)
    // Try fallback
    if (isKVConfigured()) {
      await saveImagesToFile(filtered)
    } else {
      throw error
    }
  }
  
  return true
}

// Reorder images
export async function reorderImages(newOrder: { id: string; order: number; column?: number; position?: number }[]): Promise<boolean> {
  const images = await getImages()
  
  // Update order, column, and position for each image
  const orderMap = new Map(newOrder.map(item => [item.id, { order: item.order, column: item.column, position: item.position }]))
  const updatedImages = images.map(img => {
    const update = orderMap.get(img.id)
    return {
      ...img,
      order: update?.order ?? img.order,
      column: update?.column ?? img.column,
      position: update?.position ?? img.position,
    }
  })
  
  try {
    if (isKVConfigured()) {
      await kv.set(IMAGES_KEY, updatedImages)
    } else {
      await saveImagesToFile(updatedImages)
    }
    return true
  } catch (error) {
    console.error("Error reordering images:", error)
    // Try fallback
    if (isKVConfigured()) {
      await saveImagesToFile(updatedImages)
      return true
    }
    return false
  }
}
