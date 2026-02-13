"use client"

import { useMemo } from "react"
import { createClient } from "./client"

export function useSupabase() {
  return useMemo(() => createClient(), [])
}
