import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import Link from "next/link"

export const metadata = {
  title: "Privacy Policy | Backus Ceramics",
  description:
    "Privacy Policy for Backus Ceramics — how we collect, use, and protect your personal information.",
}

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: May 19, 2026
          </p>

          <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground mt-0">1. Introduction</h2>
              <p>
                Backus Ceramics ("we", "our", "us") operates backusceramics.com (the "Site"). This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you visit our Site or use our services.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">2. Information We Collect</h2>

              <h3 className="font-medium text-foreground text-base mt-4">2.1 Information from Social Sign-In</h3>
              <p>
                When you sign in using Google or Facebook, we receive the following information from your account:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Name</strong> — your display name</li>
                <li><strong>Email address</strong> — your account email</li>
                <li><strong>Profile picture</strong> — your profile photo URL</li>
              </ul>
              <p>We do not access your passwords, contacts, posts, friends lists, or any other account data beyond the basic profile information listed above.</p>

              <h3 className="font-medium text-foreground text-base mt-4">2.2 Information You Provide</h3>
              <p>We may collect additional information that you voluntarily provide, including:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Contact details when submitting booking or order inquiries</li>
                <li>Messages sent through our contact form</li>
                <li>Custom order specifications and preferences</li>
              </ul>

              <h3 className="font-medium text-foreground text-base mt-4">2.3 Automatically Collected Information</h3>
              <p>
                When you visit the Site, we may automatically collect standard server log data including your IP address, browser type, pages viewed, and access times. This information is used for operational and security purposes.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Create and manage your account</li>
                <li>Process class bookings and custom order inquiries</li>
                <li>Communicate with you about your orders and bookings</li>
                <li>Improve and maintain the Site</li>
                <li>Respond to your inquiries and support requests</li>
              </ul>
              <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">4. Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Google OAuth</strong> — for secure user authentication</li>
                <li><strong>Facebook Login</strong> — for secure user authentication</li>
                <li><strong>Supabase</strong> — for authentication infrastructure and session management</li>
                <li><strong>Resend</strong> — for transactional email delivery (e.g., order confirmations)</li>
              </ul>
              <p>
                Each of these services has its own privacy policy governing their use of your data. We encourage you to review their policies.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">5. Data Storage and Security</h2>
              <p>
                Your data is stored securely using industry-standard encryption. We use Supabase for authentication data and maintain our own database for application-specific information (bookings, orders, preferences).
              </p>
              <p>
                While we implement reasonable security measures, no method of electronic storage is 100% secure. We cannot guarantee absolute security of your data.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">6. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide you with our services. You may request deletion of your account and associated data at any time (see our{" "}
                <Link href="/data-deletion" className="text-primary hover:underline">
                  Data Deletion Policy
                </Link>
                ).
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal data</li>
                <li>Withdraw consent for data processing</li>
                <li>Export your data in a portable format</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:info@backusceramics.com" className="text-primary hover:underline">
                  info@backusceramics.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">8. Cookies</h2>
              <p>
                We use essential cookies to maintain your authentication session and ensure the Site functions correctly. We do not use tracking or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">9. Children's Privacy</h2>
              <p>
                The Site is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will promptly delete it.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with a revised "Last updated" date. We encourage you to review this page periodically.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">11. Contact Us</h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please contact us at{" "}
                <a href="mailto:info@backusceramics.com" className="text-primary hover:underline">
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
