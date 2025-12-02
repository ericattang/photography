import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminPanel } from "@/components/admin-panel"

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  return <AdminPanel userEmail={user.email || ""} />
}
