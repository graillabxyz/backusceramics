"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { setAuthReturnToCookie } from "@/lib/auth-redirect"
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

export function AuthModal() {
  const { isAuthModalOpen, authRedirectPath, closeAuthModal } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isFacebookLoading, setIsFacebookLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClient()

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    if (provider === "google") setIsGoogleLoading(true)
    if (provider === "facebook") setIsFacebookLoading(true)
    setError("")

    // Save current path to redirect back here after successful sign-in
    const callbackUrl = authRedirectPath || window.location.pathname + window.location.search
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

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="sm:max-w-[420px] border border-border/40 shadow-2xl rounded-3xl overflow-hidden p-8 gap-0 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="text-center pb-8">
          <div className="mx-auto w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center shadow-md mb-6">
            <span className="text-background font-heading font-black text-2xl tracking-tighter">B</span>
          </div>
          <DialogTitle className="font-heading font-bold text-3xl text-foreground tracking-tight">
            Welcome
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[15px] mt-2 leading-relaxed">
            Sign in to access classes, track orders, and view your residency profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <Alert variant="destructive" className="rounded-xl py-3 border-destructive/20 bg-destructive/5 text-destructive">
              <AlertDescription className="text-sm font-medium text-center">{error}</AlertDescription>
            </Alert>
          )}

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-[15px] font-medium gap-3 border-border/60 hover:bg-foreground hover:text-background rounded-xl transition-all duration-300"
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
            className="w-full h-12 text-[15px] font-medium gap-3 border-border/60 hover:bg-foreground hover:text-background rounded-xl transition-all duration-300"
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

          <p className="text-[12px] text-center text-muted-foreground leading-relaxed pt-5">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={closeAuthModal}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={closeAuthModal}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
