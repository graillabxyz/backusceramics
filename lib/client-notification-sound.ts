let audioContext: AudioContext | null = null

export async function playNotificationChime() {
  if (typeof window === "undefined") return false

  try {
    audioContext ||= new AudioContext()
    if (audioContext.state === "suspended") await audioContext.resume()

    const now = audioContext.currentTime
    const gain = audioContext.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    gain.connect(audioContext.destination)

    for (const [frequency, delay] of [[659.25, 0], [783.99, 0.16]] as const) {
      const oscillator = audioContext.createOscillator()
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + 0.32)
    }

    return true
  } catch (error) {
    console.debug("Notification sound was blocked by the browser", error)
    return false
  }
}
