import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { BrandClosingSection } from "@/components/brand-closing-section"
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
      <BrandClosingSection
        eyebrow="Choosing a class"
        title="Find a time that gives the clay room to work."
        body="Single sessions are a gentle beginning, while longer workshops give your pieces time to move through forming, resting, trimming, and finishing. If you are unsure, start with the date that feels easiest."
      />
      <Footer />
    </>
  )
}
