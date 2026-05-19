import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import Link from "next/link"

export const metadata = {
  title: "Data Deletion | Backus Ceramics",
  description:
    "Learn how to request deletion of your personal data from Backus Ceramics.",
}

export default function DataDeletionPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-background pt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-2">
            Data Deletion Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: May 19, 2026
          </p>

          <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground mt-0">Your Right to Data Deletion</h2>
              <p>
                At Backus Ceramics, we respect your right to control your personal data. You may request the deletion of your account and all associated personal information at any time. This page explains what data we store, how to request its deletion, and what happens when you do.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">What Data We Store</h2>
              <p>When you create an account on backusceramics.com, we store:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Profile information</strong> — your name, email address, and profile photo (received from Google or Facebook sign-in)</li>
                <li><strong>Account data</strong> — your user role and account creation date</li>
                <li><strong>Order data</strong> — custom order inquiries you have submitted, including contact details and order specifications</li>
                <li><strong>Booking data</strong> — class bookings and residency applications</li>
              </ul>
              <p>
                We do not store your Google or Facebook passwords, nor do we have access to your social media accounts beyond the profile information listed above.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">How to Request Data Deletion</h2>
              <p>You can request deletion of your data in one of the following ways:</p>

              <div className="bg-muted/50 border border-border rounded-xl p-6 my-4 space-y-4">
                <div>
                  <h3 className="font-medium text-foreground text-base">Option 1: Email Request</h3>
                  <p className="mt-1">
                    Send an email to{" "}
                    <a href="mailto:info@backusceramics.com" className="text-primary hover:underline">
                      info@backusceramics.com
                    </a>{" "}
                    with the subject line <strong>"Data Deletion Request"</strong>. Include the email address associated with your account so we can locate your data.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-foreground text-base">Option 2: Contact Form</h3>
                  <p className="mt-1">
                    Use our{" "}
                    <Link href="/contact" className="text-primary hover:underline">
                      contact form
                    </Link>{" "}
                    and select "Data Deletion" as the subject. We will process your request and confirm via email.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">What Happens When You Request Deletion</h2>
              <p>Upon receiving a valid deletion request, we will:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Verify your identity</strong> — we will confirm your request via the email address on file.
                </li>
                <li>
                  <strong>Delete your account</strong> — your profile, login credentials, and account data will be permanently removed from our database.
                </li>
                <li>
                  <strong>Delete associated data</strong> — order inquiries, booking records, and any other personal data linked to your account will be deleted.
                </li>
                <li>
                  <strong>Revoke third-party access</strong> — your Supabase authentication session will be terminated.
                </li>
              </ol>
              <p className="mt-4">
                <strong>Processing time:</strong> We aim to process all deletion requests within <strong>30 days</strong> of receipt. You will receive a confirmation email once the deletion is complete.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">Data We May Retain</h2>
              <p>
                In certain cases, we may be required to retain limited data for legal, tax, or regulatory obligations. Any retained data will be minimized and stored securely. This may include:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Transaction records required for tax compliance</li>
                <li>Data necessary to resolve disputes or enforce our terms</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">Revoking Social Login Access</h2>
              <p>
                In addition to requesting data deletion from us, you may also want to revoke our app's access from your social account:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Google:</strong> Go to{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Account Permissions
                  </a>{" "}
                  and remove access for Backus Ceramics.
                </li>
                <li>
                  <strong>Facebook:</strong> Go to{" "}
                  <a
                    href="https://www.facebook.com/settings?tab=applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Facebook App Settings
                  </a>{" "}
                  and remove Backus Ceramics from your connected apps.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading font-semibold text-xl text-foreground">Contact</h2>
              <p>
                For any questions about data deletion, please contact us at{" "}
                <a href="mailto:info@backusceramics.com" className="text-primary hover:underline">
                  info@backusceramics.com
                </a>
                . See also our{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{" "}
                for more details on how we handle your data.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
