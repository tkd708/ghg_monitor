import { createContext, useContext, useState, ReactNode } from 'react'
import { Site } from '@/types'

interface SiteContextType {
  currentSite: Site | null
  setCurrentSite: (site: Site | null) => void
}

const SiteContext = createContext<SiteContextType | null>(null)

export function SiteProvider({ children }: { children: ReactNode }) {
  const [currentSite, setCurrentSite] = useState<Site | null>(null)

  return (
    <SiteContext.Provider value={{ currentSite, setCurrentSite }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  const context = useContext(SiteContext)
  if (!context) {
    throw new Error('useSite must be used within SiteProvider')
  }
  return context
}