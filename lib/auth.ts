import { cookies } from "next/headers"
import { compare, hash } from "bcryptjs"

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ""
const SESSION_COOKIE = "photography_session"

// Simple password-based auth
export async function verifyPassword(password: string): Promise<boolean> {
  if (!ADMIN_PASSWORD_HASH) {
    // If no hash is set, use a default password (you should change this!)
    // Default password is "admin" - hash it with: node -e "require('bcryptjs').hash('admin', 10).then(console.log)"
    const defaultHash = "$2a$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZq"
    return password === "admin" // For development only
  }
  
  try {
    return await compare(password, ADMIN_PASSWORD_HASH)
  } catch {
    return false
  }
}

export async function createSession() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return session?.value === "authenticated"
}



