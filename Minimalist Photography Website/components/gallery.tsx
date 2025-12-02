"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import useSWR from "swr"

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

  useEffect(() => {
    if (data?.images) {
      // Distribute images across 3 columns
      const cols: ImageData[][] = [[], [], []]
      data.images.forEach((img, i) => {
        cols[i % 3].push(img)
      })
      setColumns(cols)
    }
  }, [data])

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 md:p-8">
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-4">
          {column.map((image) => (
            <div key={image.id} className="relative group">
              <Image
                src={image.url || "/placeholder.svg"}
                alt={image.filename}
                width={600}
                height={800}
                className="w-full h-auto object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
