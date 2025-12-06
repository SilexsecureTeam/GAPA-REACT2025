import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Types
export type Currency = {
  code: string
  name: string
  symbol: string
  flag: string // URL or emoji
  countryName: string
  countryCode: string // ISO 2 chars (e.g. NG, US)
}

type CurrencyContextType = {
  currency: Currency
  setCurrencyByCountry: (countryCode: string) => void
  formatPrice: (amountInNaira: number) => string
  availableCurrencies: Currency[]
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

// Default: Nigeria / NGN
const DEFAULT_CURRENCY: Currency = {
  code: 'NGN',
  name: 'Nigerian Naira',
  symbol: '₦',
  flag: 'https://flagcdn.com/w40/ng.png',
  countryName: 'Nigeria',
  countryCode: 'NG',
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY)
  const [rates, setRates] = useState<Record<string, number>>({ NGN: 1 })
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([DEFAULT_CURRENCY])
  const [loading, setLoading] = useState(true)

  // 1. Fetch Countries & Currencies
  useEffect(() => {
    async function init() {
      try {
        // Fetch Countries
        const countriesRes = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies,cca2,flags')
        const countriesData = await countriesRes.json()

        // Fetch Rates (Base: NGN)
        // Using open.er-api.com which is reliable and free
        const ratesRes = await fetch('https://open.er-api.com/v6/latest/NGN')
        const ratesData = await ratesRes.json()
        
        if (ratesData && ratesData.rates) {
          setRates(ratesData.rates)
        }

        // Process Countries to create a clean list
        // Note: We deliberately DO NOT deduplicate by currency code here.
        // We want users to be able to select "United States" even if "Ecuador" (also USD) was processed first.
        const list: Currency[] = []

        // Add NGN (Nigeria) explicitly first to ensure it's the default/top option if not found in loop
        const nigeria = countriesData.find((c: any) => c.cca2 === 'NG')
        if (nigeria && nigeria.currencies && nigeria.currencies.NGN) {
           list.push({
            code: 'NGN',
            name: 'Nigerian Naira',
            symbol: '₦',
            flag: nigeria.flags.png,
            countryName: 'Nigeria',
            countryCode: 'NG',
           })
        } else {
           list.push(DEFAULT_CURRENCY)
        }

        countriesData.forEach((c: any) => {
          // Skip if no currency or if it's Nigeria (already added)
          if (!c.currencies || c.cca2 === 'NG') return
          
          const code = Object.keys(c.currencies)[0]
          // Skip if we don't have a live exchange rate for this currency
          if (ratesData.rates && !ratesData.rates[code]) return

          list.push({
            code: code,
            name: c.currencies[code].name,
            symbol: c.currencies[code].symbol || code,
            flag: c.flags.png,
            countryName: c.name.common,
            countryCode: c.cca2
          })
        })

        // Sort alphabetically by country name for a better UX
        list.sort((a, b) => a.countryName.localeCompare(b.countryName))
        
        setAvailableCurrencies(list)

        // Restore from LocalStorage
        const savedCode = localStorage.getItem('gapa_currency_country')
        if (savedCode) {
          const found = list.find(c => c.countryCode === savedCode)
          if (found) setCurrency(found)
        }

      } catch (error) {
        console.error('Failed to load currency data', error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // 2. Change Handler
  const setCurrencyByCountry = useCallback((countryCode: string) => {
    const found = availableCurrencies.find(c => c.countryCode === countryCode)
    if (found) {
      setCurrency(found)
      localStorage.setItem('gapa_currency_country', countryCode)
    }
  }, [availableCurrencies])

  // 3. Formatter Function
  const formatPrice = useCallback((amountInNaira: number) => {
    const isNaira = currency.code === 'NGN'
    const rate = isNaira ? 1 : (rates[currency.code] || 1)
    const converted = amountInNaira * rate
    
    // Format number part with commas and 2 decimals
    const numStr = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(converted)

    // Explicitly use the symbol from our data
    return `${currency.symbol}${numStr}`
  }, [currency, rates])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyByCountry, formatPrice, availableCurrencies, loading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}