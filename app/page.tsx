import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/home/hero-section"
import { ClassesPreview } from "@/components/home/classes-preview"
import { ResidencyPreview } from "@/components/home/residency-preview"
import { ShopPreview } from "@/components/home/shop-preview"
import { CustomOrdersPreview } from "@/components/home/custom-orders-preview"
import { AmbianceSection } from "@/components/home/ambiance-section"
import { BirthdayPreview } from "@/components/home/birthday-preview"
import { ContactSection } from "@/components/home/contact-section"

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <HeroSection />
      <ClassesPreview />
      <ResidencyPreview />
      <BirthdayPreview />
      <ShopPreview />
      <AmbianceSection />
      <CustomOrdersPreview />
      <ContactSection />
      <Footer />
    </main>
  )
}
