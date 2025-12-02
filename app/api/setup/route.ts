import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// One-time setup endpoint to create admin account
// DELETE THIS FILE after creating your account
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
