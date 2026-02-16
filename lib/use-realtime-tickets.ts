"use client"

import { useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

interface UseRealtimeTicketsOptions {
  supabase: SupabaseClient
  userId: string | null
  enabled: boolean
  onLabelChange: (ticketId: string, label: string | null, eventType: string) => void
  onRepliedStatusChange: (ticketId: number, repliedByUserId: string, repliedAt: string) => void
  onNewTicketDetected: (count: number) => void
}

export function useRealtimeTickets({
  supabase,
  userId,
  enabled,
  onLabelChange,
  onRepliedStatusChange,
  onNewTicketDetected,
}: UseRealtimeTicketsOptions) {
  const knownTicketIds = useRef<Set<number> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callbacksRef = useRef({ onLabelChange, onRepliedStatusChange, onNewTicketDetected })

  // Keep callbacks fresh without re-subscribing
  callbacksRef.current = { onLabelChange, onRepliedStatusChange, onNewTicketDetected }

  useEffect(() => {
    if (!enabled || !userId) return

    // ─── Supabase Realtime subscriptions ───

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_labels" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { ticket_id?: string }
            if (old.ticket_id) {
              callbacksRef.current.onLabelChange(old.ticket_id, null, "DELETE")
            }
          } else {
            const row = payload.new as { ticket_id: string; label: string }
            callbacksRef.current.onLabelChange(row.ticket_id, row.label, payload.eventType)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_replied_status" },
        (payload) => {
          const row = payload.new as { user_id: string; ticket_id: number; replied_at: string }
          // Only notify if a colleague replied (not self)
          if (row.user_id !== userId) {
            callbacksRef.current.onRepliedStatusChange(row.ticket_id, row.user_id, row.replied_at)
          }
        }
      )
      .subscribe()

    // ─── Poll for new Gorgias tickets every 60s ───

    async function pollNewTickets() {
      try {
        const res = await fetch("/api/gorgias/tickets")
        if (!res.ok) return
        const data = await res.json()
        const tickets: { id: number }[] = data.tickets || data || []
        const currentIds = new Set(tickets.map(t => t.id))

        if (knownTicketIds.current === null) {
          // First poll — just initialize, don't notify
          knownTicketIds.current = currentIds
          return
        }

        // Find new ticket IDs
        const newIds: number[] = []
        currentIds.forEach(id => {
          if (!knownTicketIds.current!.has(id)) newIds.push(id)
        })

        if (newIds.length > 0) {
          knownTicketIds.current = currentIds
          callbacksRef.current.onNewTicketDetected(newIds.length)
        } else {
          knownTicketIds.current = currentIds
        }
      } catch {
        // Silent fail — network issues
      }
    }

    // Initial poll (silent)
    pollNewTickets()
    pollRef.current = setInterval(pollNewTickets, 60_000)

    return () => {
      supabase.removeChannel(channel)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [supabase, userId, enabled])
}
