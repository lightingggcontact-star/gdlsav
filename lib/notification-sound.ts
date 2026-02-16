"use client"

let audioContext: AudioContext | null = null

/**
 * Play a pleasant two-tone chime notification sound (iMessage-like)
 * Uses Web Audio API — no external file needed.
 */
export function playNotificationSound() {
  try {
    if (!audioContext) audioContext = new AudioContext()
    const ctx = audioContext

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume()

    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)

    // First tone: C5 (523 Hz)
    const osc1 = ctx.createOscillator()
    osc1.type = "sine"
    osc1.frequency.value = 523.25
    osc1.connect(gain)
    osc1.start(now)
    osc1.stop(now + 0.15)

    // Second tone: E5 (659 Hz) — slightly higher, pleasant interval
    const osc2 = ctx.createOscillator()
    osc2.type = "sine"
    osc2.frequency.value = 659.25
    osc2.connect(gain)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)
  } catch {
    // Silent fail — audio not supported or blocked
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const result = await Notification.requestPermission()
  return result === "granted"
}

export function showDesktopNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "gdl-sav-" + Date.now(),
  })
}
