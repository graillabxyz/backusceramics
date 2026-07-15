import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { BrandClosingSection } from "@/components/brand-closing-section"
import { ClassesCalendar } from "@/components/classes/classes-calendar"

export default function ClassesCalendarPage() {
  return (
    <>
      <Navigation />
      <ClassesCalendar />
      <BrandClosingSection
        eyebrow="Choosing a class"
        title="Find a time that gives the clay room to work."
        body="Single sessions are a gentle beginning, while longer workshops give your pieces time to move through forming, resting, trimming, and finishing. If you are unsure, start with the date that feels easiest."
      />
      <Footer />
    </>
  )
}
