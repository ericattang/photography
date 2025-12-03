import { redirect } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import { AdminPanel } from "@/components/admin-panel"

export default async function AdminPage() {
  if (!(await isAuthenticated())) {
    redirect("/login")
  }

  return <AdminPanel />
}
