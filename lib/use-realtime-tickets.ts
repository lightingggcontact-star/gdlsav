"use client"

import { useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

interface UseRealtimeTicketsOptions {
  supabase: SupabaseClient
  userId: string | null
  enabled: boolean
  onLabelChange: (ticketId: string, label: string | null, eventType: string) => void
  onRepliedStatusChange: (ticketId: string, repliedByUserId: string, repliedAt: string) => void
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
  const callbacksRef = useRef({ onLabelChange, onRepliedStatusChange, onNewTicketDetected })

  // Keep callbacks fresh without re-subscribing
  callbacksRef.current = { onLabelChange, onRepliedStatusChange, onNewTicketDetected }

  useEffect(() => {
    if (!enabled || !userId) return

    const channel = supabase
      .channel("tickets-realtime")
      // Labels
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
      // Replied status from colleagues
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_replied_status" },
        (payload) => {
          const row = payload.new as { user_id: string; ticket_id: string; replied_at: string }
          if (row.user_id !== userId) {
            callbacksRef.current.onRepliedStatusChange(row.ticket_id, row.user_id, row.replied_at)
          }
        }
      )
      // New emails from customers (not from agent)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_messages" },
        (payload) => {
          const row = payload.new as { from_agent: boolean }
          if (!row.from_agent) {
            callbacksRef.current.onNewTicketDetected(1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, enabled])
}
