"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function SecretButton() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated via cookie-based auth
        const response = await fetch("/api/auth/check", { method: "GET" })
        if (response.ok) {
          const data = await response.json()
          setIsLoggedIn(data.authenticated || false)
        }
      } catch (error) {
        // If auth check fails, assume not logged in
        setIsLoggedIn(false)
      }
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
