import { isAuthenticated } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  // Protect admin route
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next({ request })
}
