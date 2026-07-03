"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { sanitizeAuthReturnTo, setAuthReturnToCookie } from "@/lib/auth-redirect"
import { canAccessAdmin } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import Link from "next/link"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function LoginForm() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isFacebookLoading, setIsFacebookLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, supabaseUser, user, isLoading: authLoading } = useAuth()
  const requestedCallbackUrl = searchParams.get("callbackUrl")
  const callbackUrl = sanitizeAuthReturnTo(requestedCallbackUrl, "/account") || "/account"
  const supabase = createClient()

  // Redirect if already authenticated
  useEffect(() => {
    if (requestedCallbackUrl && (isAuthenticated || supabaseUser)) {
      router.replace(callbackUrl)
      return
    }

    if (!authLoading && isAuthenticated) {
      if (canAccessAdmin(user?.role) && !requestedCallbackUrl) {
        router.replace("/admin")
      } else {
        router.replace(callbackUrl)
      }
    }
  }, [isAuthenticated, supabaseUser, authLoading, user, router, callbackUrl, requestedCallbackUrl])

  // Check for error in URL
  useEffect(() => {
    const urlError = searchParams.get("error")
    if (urlError === "auth_failed") {
      setError("Sign in failed. Please try again.")
    }
  }, [searchParams])

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    if (provider === "google") setIsGoogleLoading(true)
    if (provider === "facebook") setIsFacebookLoading(true)
    setError("")
    setAuthReturnToCookie(callbackUrl)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsGoogleLoading(false)
      setIsFacebookLoading(false)
    }
  }

  if (authLoading) {
    const loadingMessage = supabaseUser
      ? "Finishing sign in..."
      : "Checking your sign-in..."

    return (
      <main className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-sm font-medium text-foreground">{loadingMessage}</p>
          <p className="mt-1 text-xs text-muted-foreground">You will be returned to your booking automatically.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-heading font-bold text-2xl">B</span>
            </div>
          </Link>
          <h1 className="font-heading font-bold text-2xl text-foreground mt-4">
            Backus Ceramics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign in to your account
          </p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-heading font-bold text-xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to access classes, track orders, and more
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium gap-3 border-border hover:bg-muted/50 transition-all duration-200"
              onClick={() => handleOAuthLogin("google")}
              disabled={isGoogleLoading || isFacebookLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
              Continue with Google
            </Button>

            {/* Facebook OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium gap-3 border-border hover:bg-muted/50 transition-all duration-200"
              onClick={() => handleOAuthLogin("facebook")}
              disabled={isGoogleLoading || isFacebookLoading}
            >
              {isFacebookLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FacebookIcon className="h-5 w-5" />
              )}
              Continue with Facebook
            </Button>

            <p className="text-xs text-center text-muted-foreground leading-relaxed pt-2">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="pt-2 text-center">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to website
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
