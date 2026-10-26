import { useEffect, useRef, useState } from 'react'
import { currencySettings, formatMoneyInput, parseMoneyInput } from '../lib/workspace'

// Keep the text being typed separate from the EUR value used by the form.
export function MoneyInput({ value, onValueChange, onFocus, onBlur, ...props }) {
  const [draft, setDraft] = useState(() => formatMoneyInput(value))
  const focused = useRef(false)
  const lastEmittedValue = useRef(value)
  const currency = currencySettings.currency
  const rate = currencySettings.rates[currency]

  useEffect(() => {
    // Parent recalculations and form resets still update the displayed amount.
    if (!focused.current || String(value) !== String(lastEmittedValue.current)) {
      setDraft(formatMoneyInput(value))
    }
  }, [value, currency, rate])

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      pattern="[0-9]+([.,][0-9]{0,2})?"
      value={draft}
      onFocus={(event) => {
        focused.current = true
        lastEmittedValue.current = value
        onFocus?.(event)
      }}
      onChange={(event) => {
        const text = event.target.value
        if (!/^\d*([.,]\d{0,2})?$/.test(text)) return
        setDraft(text)
        lastEmittedValue.current = parseMoneyInput(text)
        onValueChange?.(text)
      }}
      onBlur={(event) => {
        focused.current = false
        setDraft(formatMoneyInput(value))
        onBlur?.(event)
      }}
    />
  )
}
