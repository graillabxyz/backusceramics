import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { ClassesCalendar } from "@/components/classes/classes-calendar"

interface ClassesCalendarPageProps {
  searchParams: Promise<{ class?: string }>
}

export default async function ClassesCalendarPage({ searchParams }: ClassesCalendarPageProps) {
  const params = await searchParams

  return (
    <>
      <Navigation />
      <ClassesCalendar initialClass={params.class} />
      <Footer />
    </>
  )
}
