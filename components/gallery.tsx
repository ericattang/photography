"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface ImageData {
  id: string
  url: string
  filename: string
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Gallery() {
  const { data, isLoading } = useSWR<{ images: ImageData[] }>("/api/images", fetcher)
  const [columns, setColumns] = useState<ImageData[][]>([[], [], []])
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)

  useEffect(() => {
    if (data?.images) {
      // Distribute images across 3 columns
      // If images have saved column/position, use those; otherwise distribute evenly
      const cols: ImageData[][] = [[], [], []]
      
      data.images.forEach((img) => {
        if (img.column !== undefined && img.column >= 0 && img.column < 3) {
          // Use saved column
          cols[img.column].push(img)
        } else {
          // Fallback to round-robin distribution
          const index = data.images.indexOf(img)
          cols[index % 3].push(img)
        }
      })
      
      // Sort each column by position if available
      cols.forEach((col) => {
        col.sort((a, b) => {
          if (a.position !== undefined && b.position !== undefined) {
            return a.position - b.position
          }
          return 0
        })
      })
      
      setColumns(cols)
    }
  }, [data])

  // Handle keyboard navigation
  useEffect(() => {
    if (!selectedImage || !data?.images) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null)
      } else if (e.key === "ArrowLeft") {
        const currentIndex = data.images.findIndex((img) => img.id === selectedImage.id)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : data.images.length - 1
        setSelectedImage(data.images[prevIndex])
      } else if (e.key === "ArrowRight") {
        const currentIndex = data.images.findIndex((img) => img.id === selectedImage.id)
        const nextIndex = currentIndex < data.images.length - 1 ? currentIndex + 1 : 0
        setSelectedImage(data.images[nextIndex])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedImage, data?.images])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.images?.length) {
    return <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">No photos yet</div>
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-4">
            {column.map((image) => (
              <div
                key={image.id}
                className="relative group cursor-pointer"
                onClick={() => setSelectedImage(image)}
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
              </div>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-transparent border-none shadow-none flex items-center justify-center"
          showCloseButton={false}
        >
          {selectedImage && (
            <div className="relative inline-flex items-center justify-center">
              <div className="relative">
                <Image
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  width={1920}
                  height={1080}
                  className="max-w-[95vw] max-h-[95vh] w-auto h-auto object-contain"
                  sizes="95vw"
                  priority
                />
                <DialogClose className="absolute top-2 right-2 z-50 rounded-full bg-black/60 hover:bg-black/80 text-white p-2.5 transition-colors backdrop-blur-sm">
                  <X className="w-5 h-5" />
                </DialogClose>
                
                {/* Navigation arrows */}
                {data.images && data.images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const currentIndex = data.images.findIndex((img) => img.id === selectedImage.id)
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : data.images.length - 1
                        setSelectedImage(data.images[prevIndex])
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/60 hover:bg-black/80 text-white p-3 transition-colors backdrop-blur-sm"
                      aria-label="Previous image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const currentIndex = data.images.findIndex((img) => img.id === selectedImage.id)
                        const nextIndex = currentIndex < data.images.length - 1 ? currentIndex + 1 : 0
                        setSelectedImage(data.images[nextIndex])
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/60 hover:bg-black/80 text-white p-3 transition-colors backdrop-blur-sm"
                      aria-label="Next image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
