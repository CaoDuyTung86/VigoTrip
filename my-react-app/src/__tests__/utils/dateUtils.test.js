import { describe, it, expect } from 'vitest'

const formatDate = (date, format = 'DD/MM/YYYY') => {
  if (!(date instanceof Date)) {
    return ''
  }
  
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  
  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`
  }
  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`
  }
  return `${day}/${month}/${year}`
}

const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime())
}

const daysDifference = (date1, date2) => {
  if (!isValidDate(date1) || !isValidDate(date2)) {
    return null
  }
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((date2 - date1) / msPerDay)
}

describe('Date Utils - formatDate', () => {
  it('should format date as DD/MM/YYYY by default', () => {
    const date = new Date(2026, 7, 15)
    expect(formatDate(date)).toBe('15/08/2026')
  })

  it('should format date as YYYY-MM-DD when specified', () => {
    const date = new Date(2026, 7, 15)
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-08-15')
  })

  it('should return empty string for invalid input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('2026-08-15')).toBe('')
  })

  it('should pad single digit months and days', () => {
    const date = new Date(2026, 0, 5)
    expect(formatDate(date)).toBe('05/01/2026')
  })
})

describe('Date Utils - isValidDate', () => {
  it('should return true for valid Date objects', () => {
    const date = new Date()
    expect(isValidDate(date)).toBe(true)
  })

  it('should return false for invalid dates', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false)
  })

  it('should return false for non-Date objects', () => {
    expect(isValidDate('2026-08-15')).toBe(false)
    expect(isValidDate(123456)).toBe(false)
    expect(isValidDate(null)).toBe(false)
    expect(isValidDate(undefined)).toBe(false)
  })
})

describe('Date Utils - daysDifference', () => {
  it('should calculate correct days difference', () => {
    const date1 = new Date(2026, 7, 15)
    const date2 = new Date(2026, 7, 20)
    expect(daysDifference(date1, date2)).toBe(5)
  })

  it('should handle same dates', () => {
    const date = new Date(2026, 7, 15)
    expect(daysDifference(date, date)).toBe(0)
  })

  it('should return null for invalid dates', () => {
    const validDate = new Date(2026, 7, 15)
    expect(daysDifference(validDate, 'invalid')).toBe(null)
    expect(daysDifference('invalid', validDate)).toBe(null)
  })
})

export { formatDate, isValidDate, daysDifference }