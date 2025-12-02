"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Upload, X, LogOut } from "lucide-react"
import useSWR, { mutate } from "swr"
import Image from "next/image"
import { uploadImage } from "@/app/actions/upload"

interface ImageData {
  id: string
  url: string
  filename: string
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function AdminPanel({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const { data, isLoading } = useSWR<{ images: ImageData[] }>("/api/images", fetcher)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const totalFiles = files.length
      let completedFiles = 0

      for (const file of Array.from(files)) {
        // Check file size client-side
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size is 10MB.`)
          continue
        }

        // Create FormData and call server action
        const formData = new FormData()
        formData.append("file", file)

        const result = await uploadImage(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        completedFiles++
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100))
      }

      mutate("/api/images")
    } catch (err) {
      console.error("Upload failed:", err)
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setUploadProgress(0)
      e.target.value = ""
    }
  }, [])

  const handleDelete = async (image: ImageData) => {
    setDeleting(image.id)
    try {
      await fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: image.url, id: image.id }),
      })
      mutate("/api/images")
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">{userEmail}</span>
          <div className="flex items-center gap-2">
            <label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? `${uploadProgress}% Uploading...` : "Upload"}
                </span>
              </Button>
            </label>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {error && (
          <div className="px-4 pb-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </header>

      <main className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : !data?.images?.length ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-4">
            <p>No photos yet</p>
            <label>
              <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
              <Button variant="outline" asChild>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload your first photo
                </span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.images.map((image) => (
              <div key={image.id} className="relative group aspect-square">
                <Image
                  src={image.url || "/placeholder.svg"}
                  alt={image.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 16vw"
                />
                <button
                  onClick={() => handleDelete(image)}
                  disabled={deleting === image.id}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                >
                  {deleting === image.id ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
