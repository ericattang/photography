"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Upload, X, LogOut, GripVertical } from "lucide-react"
import useSWR, { mutate } from "swr"
import Image from "next/image"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface ImageData {
  id: string
  url: string
  filename: string
  created_at: string
  order?: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function SortableImageItem({
  image,
  onDelete,
  deleting,
  columnIndex,
  indexInColumn,
}: {
  image: ImageData
  onDelete: (image: ImageData) => void
  deleting: string | null
  columnIndex: number
  indexInColumn: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group cursor-move"
    >
      <Image
        src={image.url || "/placeholder.svg"}
        alt={image.filename}
        width={600}
        height={800}
        className="w-full h-auto object-cover transition-opacity group-hover:opacity-90"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded cursor-grab active:cursor-grabbing transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(image)
        }}
        disabled={deleting === image.id}
        className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm disabled:opacity-50 opacity-0 group-hover:opacity-100"
      >
        {deleting === image.id ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}

export function AdminPanel() {
  const router = useRouter()
  const { data, isLoading } = useSWR<{ images: ImageData[] }>("/api/images", fetcher)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [columns, setColumns] = useState<ImageData[][]>([[], [], []])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (data?.images) {
      // Distribute images across 3 columns (same as gallery)
      const cols: ImageData[][] = [[], [], []]
      data.images.forEach((img, i) => {
        cols[i % 3].push(img)
      })
      setColumns(cols)
    }
  }, [data])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
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

        // Convert file to base64
        const reader = new FileReader()
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            // Remove data:image/...;base64, prefix
            const base64 = result.split(",")[1]
            resolve(base64)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Upload to API
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            data: base64Data,
          }),
        })

        const result = await response.json()

        if (!response.ok || result.error) {
          throw new Error(result.error || "Upload failed")
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
        body: JSON.stringify({ id: image.id }),
      })
      mutate("/api/images")
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setDeleting(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !data?.images) return

    // Find which column the active image is in and its position
    let activeColumn = -1
    let activePosition = -1
    let overColumn = -1
    let overPosition = -1

    columns.forEach((col, colIdx) => {
      col.forEach((img, posIdx) => {
        if (img.id === active.id) {
          activeColumn = colIdx
          activePosition = posIdx
        }
        if (img.id === over.id) {
          overColumn = colIdx
          overPosition = posIdx
        }
      })
    })

    if (activeColumn === -1 || overColumn === -1) return

    // Create new column arrays
    const newColumns = columns.map((col) => [...col])

    // Remove from source column
    const [movedImage] = newColumns[activeColumn].splice(activePosition, 1)

    // Insert into target column
    if (activeColumn === overColumn) {
      // Moving within same column
      if (activePosition < overPosition) {
        // Moving down, adjust position
        newColumns[overColumn].splice(overPosition, 0, movedImage)
      } else {
        // Moving up
        newColumns[overColumn].splice(overPosition + 1, 0, movedImage)
      }
    } else {
      // Moving to different column - insert after the target
      newColumns[overColumn].splice(overPosition + 1, 0, movedImage)
    }

    // Flatten and create new order based on column positions
    const flattened: { id: string; order: number; column: number; position: number }[] = []
    newColumns.forEach((col, colIdx) => {
      col.forEach((img, posIdx) => {
        flattened.push({
          id: img.id,
          order: colIdx * 1000 + posIdx, // Use column * 1000 + position for ordering
          column: colIdx,
          position: posIdx,
        })
      })
    })

    try {
      const response = await fetch("/api/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOrder: flattened }),
      })

      if (response.ok) {
        mutate("/api/images")
      } else {
        console.error("Failed to reorder images")
      }
    } catch (error) {
      console.error("Reorder error:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-foreground/10">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">Admin Panel</span>
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

      <main className="p-4 md:p-8">
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map((column, colIndex) => (
                <SortableContext
                  key={colIndex}
                  items={column.map((img) => img.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-4">
                    {column.map((image, indexInColumn) => (
                      <SortableImageItem
                        key={image.id}
                        image={image}
                        onDelete={handleDelete}
                        deleting={deleting}
                        columnIndex={colIndex}
                        indexInColumn={indexInColumn}
                      />
                    ))}
                  </div>
                </SortableContext>
              ))}
            </div>
          </DndContext>
        )}
      </main>
    </div>
  )
}
