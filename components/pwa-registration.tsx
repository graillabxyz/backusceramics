"use client"

import { useEffect } from "react"

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker.register("/push-worker.js", { scope: "/" }).catch((error) => {
        console.error("Backus app service worker registration failed", error)
      })
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
