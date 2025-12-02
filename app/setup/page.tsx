"use client"

import { useState } from "react"

// One-time setup page - DELETE after creating your account
export default function SetupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function createAccount() {
    setStatus("loading")

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "ericahu801@gmail.com",
        password: "InhaleExhaleM0ment",
      }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus("success")
      setMessage("Account created! You can now delete this setup page and log in.")
    } else {
      setStatus("error")
      setMessage(data.error || "Failed to create account")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-2xl font-light">Setup Admin Account</h1>

        {status === "idle" && (
          <button
            onClick={createAccount}
            className="px-6 py-2 bg-foreground text-background rounded hover:opacity-80 transition-opacity"
          >
            Create Account
          </button>
        )}

        {status === "loading" && <p className="text-muted-foreground">Creating account...</p>}

        {status === "success" && <p className="text-green-600">{message}</p>}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-red-600">{message}</p>
            <button
              onClick={createAccount}
              className="px-6 py-2 bg-foreground text-background rounded hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
