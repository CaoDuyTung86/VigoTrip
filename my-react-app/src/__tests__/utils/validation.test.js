import { describe, it, expect } from 'vitest'

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^(\+84|0)[0-9]{9,10}$/
  return phoneRegex.test(phone.replace(/\s+/g, ''))
}

const validatePassword = (password) => {
  return {
    isValid: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    length: password.length,
  }
}

const validateTripName = (name) => {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Tên trình không được để trống',
    }
  }

  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Tên trình không được để trống',
    }
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Tên trình không được vượt quá 100 ký tự',
    }
  }

  return {
    isValid: true,
    value: trimmed,
  }
}

const validatePrice = (price) => {
  const numPrice = Number(price)
  
  if (isNaN(numPrice)) {
    return {
      isValid: false,
      error: 'Giá phải là số',
    }
  }

  if (numPrice <= 0) {
    return {
      isValid: false,
      error: 'Giá phải lớn hơn 0',
    }
  }

  return {
    isValid: true,
    value: numPrice,
  }
}

const validateTripDates = (startDate, endDate) => {
  const errors = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    errors.push('Ngày bắt đầu không hợp lệ')
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    errors.push('Ngày kết thúc không hợp lệ')
  }

  if (errors.length === 0) {
    if (startDate < now) {
      errors.push('Ngày bắt đầu phải trong tương lai')
    }

    if (startDate >= endDate) {
      errors.push('Ngày bắt đầu phải trước ngày kết thúc')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

describe('Validation Utils - validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('test.user@domain.co.uk')).toBe(true)
  })

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid.email')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('user@')).toBe(false)
  })
})

describe('Validation Utils - validatePhoneNumber', () => {
  it('should accept valid Vietnam phone numbers', () => {
    expect(validatePhoneNumber('+84912345678')).toBe(true)
    expect(validatePhoneNumber('0912345678')).toBe(true)
    expect(validatePhoneNumber('0 912 345 678')).toBe(true)
  })

  it('should reject invalid phone numbers', () => {
    expect(validatePhoneNumber('12345')).toBe(false)
    expect(validatePhoneNumber('+1912345678')).toBe(false)
  })
})

describe('Validation Utils - validatePassword', () => {
  it('should validate strong password', () => {
    const result = validatePassword('StrongPass123!')
    expect(result.isValid).toBe(true)
    expect(result.hasUpperCase).toBe(true)
    expect(result.hasLowerCase).toBe(true)
    expect(result.hasNumbers).toBe(true)
  })

  it('should reject short password', () => {
    const result = validatePassword('Short1!')
    expect(result.isValid).toBe(false)
  })
})

describe('Validation Utils - validateTripName (Issue #17)', () => {
  it('should accept valid trip names', () => {
    const result = validateTripName('Hà Nội - Hồ Chí Minh')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe('Hà Nội - Hồ Chí Minh')
  })

  it('should reject empty trip names', () => {
    const result = validateTripName('')
    expect(result.isValid).toBe(false)
  })

  it('should reject names exceeding 100 characters', () => {
    const longName = 'A'.repeat(101)
    const result = validateTripName(longName)
    expect(result.isValid).toBe(false)
  })

  it('should trim whitespace', () => {
    const result = validateTripName('  Trình du lịch  ')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe('Trình du lịch')
  })
})

describe('Validation Utils - validatePrice (Issue #17)', () => {
  it('should accept valid prices', () => {
    const result = validatePrice(100)
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(100)
  })

  it('should accept string prices', () => {
    const result = validatePrice('150.50')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(150.50)
  })

  it('should reject zero and negative prices', () => {
    expect(validatePrice(0).isValid).toBe(false)
    expect(validatePrice(-50).isValid).toBe(false)
  })

  it('should reject non-numeric values', () => {
    const result = validatePrice('abc')
    expect(result.isValid).toBe(false)
  })
})

describe('Validation Utils - validateTripDates (Issue #17)', () => {
  it('should accept valid dates (start < end, both future)', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)

    const result = validateTripDates(tomorrow, nextWeek)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject past start dates', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const result = validateTripDates(yesterday, tomorrow)
    expect(result.isValid).toBe(false)
  })

  it('should reject when start date >= end date', () => {
    const date1 = new Date(2026, 8, 15)
    const date2 = new Date(2026, 8, 15)

    const result = validateTripDates(date1, date2)
    expect(result.isValid).toBe(false)
  })

  it('should reject invalid date objects', () => {
    const result = validateTripDates('invalid', null)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

export {
  validateEmail,
  validatePhoneNumber,
  validatePassword,
  validateTripName,
  validatePrice,
  validateTripDates,
}