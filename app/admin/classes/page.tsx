import { redirect } from "next/navigation"

export default function LegacyAdminClassesPage() {
  redirect("/admin/bookings?view=calendar")
}
