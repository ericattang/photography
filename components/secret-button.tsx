"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export function SecretButton() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
    }
    checkAuth()
  }, [])

  const handleClick = () => {
    if (isLoggedIn) {
      router.push("/admin")
    } else {
      router.push("/login")
    }
  }

  return (
    <button
      onClick={handleClick}
      className="fixed top-4 right-4 w-8 h-8 opacity-0 hover:opacity-100 transition-opacity duration-300 z-50"
      aria-label="Admin access"
    >
      <span className="sr-only">Admin</span>
    </button>
  )
}
