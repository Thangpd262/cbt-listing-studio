import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// The active selling platform drives which sidebar tabs show and which
// marketplace badge renders in the header. Persisted so a refresh keeps it.

export type Platform = 'amazon' | 'walmart'

const PLATFORM_KEY = 'cbt_platform'
const MARKETPLACE_KEY = 'cbt_marketplace'

// Marketplaces offered per platform (first = default).
export const MARKETPLACES: Record<Platform, string[]> = {
  amazon: ['US (ATVPDKIKX0DER)', 'EU (A1F83G8C2ARO7P)'],
  walmart: ['US'],
}

export const PLATFORM_META: Record<Platform, { label: string; accent: string }> = {
  amazon: { label: 'Amazon', accent: 'text-amazon' },
  walmart: { label: 'Walmart', accent: 'text-walmart' },
}

type PlatformState = {
  platform: Platform
  marketplace: string
  setPlatform: (p: Platform) => void
  setMarketplace: (m: string) => void
}

const PlatformContext = createContext<PlatformState | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatformState] = useState<Platform>('amazon')
  const [marketplace, setMarketplaceState] = useState(MARKETPLACES.amazon[0])

  useEffect(() => {
    try {
      const p = localStorage.getItem(PLATFORM_KEY) as Platform | null
      const m = localStorage.getItem(MARKETPLACE_KEY)
      if (p === 'amazon' || p === 'walmart') setPlatformState(p)
      if (m) setMarketplaceState(m)
    } catch {
      // ignore corrupt storage
    }
  }, [])

  const setPlatform = (p: Platform) => {
    setPlatformState(p)
    localStorage.setItem(PLATFORM_KEY, p)
    // Snap marketplace to a valid one for the new platform.
    if (!MARKETPLACES[p].includes(marketplace)) setMarketplace(MARKETPLACES[p][0])
  }

  const setMarketplace = (m: string) => {
    setMarketplaceState(m)
    localStorage.setItem(MARKETPLACE_KEY, m)
  }

  return (
    <PlatformContext.Provider value={{ platform, marketplace, setPlatform, setMarketplace }}>
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform() {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider')
  return ctx
}
