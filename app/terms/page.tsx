import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import Link from "next/link"

export const metadata = {
  title: "Terms of Service | Backus Ceramics",
  description:
    "Terms of Service for Backus Ceramics — our terms governing use of backusceramics.com and our services.",
}

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: May 19, 2026
          </p>

          <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground mt-0">1. Acceptance of Terms</h2>
              <p>
                By accessing or using backusceramics.com (the "Site"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, please do not use the Site. These Terms apply to all visitors, users, and others who access the Site.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">2. Description of Service</h2>
              <p>
                Backus Ceramics is a ceramics studio based in Bali, Indonesia. Through this Site, we offer information about our pottery classes, residency programs, custom order inquiries, and handcrafted ceramic products. Users may create accounts to manage bookings, track orders, and interact with studio services.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">3. User Accounts</h2>
              <p>
                To access certain features of the Site, you may need to create an account using Google OAuth sign-in. You are responsible for maintaining the confidentiality of your account and agree to accept responsibility for all activities that occur under your account. You must provide accurate and complete information during registration.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">4. Bookings and Orders</h2>
              <p>
                Class bookings and custom order inquiries submitted through the Site are subject to availability and confirmation by Backus Ceramics. Submitting a booking or inquiry does not guarantee acceptance. Prices displayed are in Indonesian Rupiah (IDR) and are subject to change without prior notice.
              </p>
              <p>
                Class bookings are non-refundable within 7 days of the scheduled session because reserved seats are difficult to refill on short notice. Reschedule requests made 7 or more days in advance are subject to studio availability. Refund policies for custom orders will be communicated on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">5. Intellectual Property</h2>
              <p>
                All content on this Site — including text, images, logos, and design — is the property of Backus Ceramics and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any content without our prior written consent.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">6. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Site for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any part of the Site</li>
                <li>Interfere with or disrupt the Site or its servers</li>
                <li>Submit false or misleading information</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">7. Limitation of Liability</h2>
              <p>
                Backus Ceramics provides the Site "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Site or our services.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">8. Privacy</h2>
              <p>
                Your use of the Site is also governed by our{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                . Please review it to understand how we collect, use, and protect your information.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">9. Modifications</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the Site after changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">10. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the Republic of Indonesia, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">11. Contact</h2>
              <p>
                If you have questions about these Terms, please contact us at{" "}
                <a
                  href="mailto:info@backusceramics.com"
                  className="text-primary hover:underline"
                >
                  info@backusceramics.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
