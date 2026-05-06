import { Button } from "@/components/ui/button"
import Link from "next/link"

export function AmbianceSection() {
  return (
    <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img 
          src="/ambiance.JPG" 
          alt="Studio Ambiance" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
        <h2 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl mb-6">
          The Soul of Ceramics
        </h2>
        <p className="text-xl sm:text-2xl mb-10 text-white/90 leading-relaxed">
          More than just a studio, we are a space for slow living, 
          creativity, and the quiet beauty of handmade art.
        </p>
        <Button asChild size="lg" variant="secondary" className="bg-white text-black hover:bg-white/90">
          <Link href="/contact">Visit Our Studio</Link>
        </Button>
      </div>
    </section>
  )
}
