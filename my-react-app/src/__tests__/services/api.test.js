import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

class ApiService {
  constructor(baseURL = 'http://localhost:8081/api') {
    this.baseURL = baseURL
    this.authToken = null
  }

  setAuthToken(token) {
    this.authToken = token
  }

  async getItineraries() {
    if (!this.authToken) {
      throw new Error('Unauthorized: No auth token')
    }
    
    const response = await fetch(`${this.baseURL}/itineraries`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async getItinerary(id) {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid itinerary ID')
    }

    if (!this.authToken) {
      throw new Error('Unauthorized: No auth token')
    }

    const response = await fetch(`${this.baseURL}/itineraries/${id}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async createItinerary(data) {
    if (!data.name || !data.startDate || !data.endDate) {
      throw new Error('Missing required fields: name, startDate, endDate')
    }

    if (!this.authToken) {
      throw new Error('Unauthorized: No auth token')
    }

    const response = await fetch(`${this.baseURL}/itineraries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async updateItinerary(id, data) {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid itinerary ID')
    }

    if (!this.authToken) {
      throw new Error('Unauthorized: No auth token')
    }

    const response = await fetch(`${this.baseURL}/itineraries/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteItinerary(id) {
    if (!id || typeof id !== 'number') {
      throw new Error('Invalid itinerary ID')
    }

    if (!this.authToken) {
      throw new Error('Unauthorized: No auth token')
    }

    const response = await fetch(`${this.baseURL}/itineraries/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }
}

describe('ApiService - Itinerary CRUD Operations (Issue #17)', () => {
  let apiService
  const mockToken = 'mock-jwt-token-12345'

  beforeEach(() => {
    apiService = new ApiService()
    apiService.setAuthToken(mockToken)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getItineraries', () => {
    it('should fetch all itineraries successfully', async () => {
      const mockData = [
        { id: 1, name: 'Hà Nội - Hồ Chí Minh', startDate: '2026-09-01' },
        { id: 2, name: 'Đà Nẵng - Nha Trang', startDate: '2026-09-15' },
      ]

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await apiService.getItineraries()
      expect(result).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw error when not authenticated', async () => {
      const unauthService = new ApiService()
      await expect(unauthService.getItineraries()).rejects.toThrow(
        'Unauthorized: No auth token'
      )
    })

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(apiService.getItineraries()).rejects.toThrow(
        'HTTP 500: Internal Server Error'
      )
    })
  })

  describe('getItinerary', () => {
    it('should fetch single itinerary by ID', async () => {
      const mockData = { id: 1, name: 'Hà Nội - Hồ Chí Minh', startDate: '2026-09-01' }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await apiService.getItinerary(1)
      expect(result).toEqual(mockData)
    })

    it('should throw error for invalid ID', async () => {
      await expect(apiService.getItinerary('invalid')).rejects.toThrow(
        'Invalid itinerary ID'
      )
    })

    it('should handle 404 Not Found', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(apiService.getItinerary(999)).rejects.toThrow(
        'HTTP 404: Not Found'
      )
    })
  })

  describe('createItinerary', () => {
    it('should create new itinerary', async () => {
      const newTrip = {
        name: 'Trình mới',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
      }
      const mockResponse = { id: 3, ...newTrip }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await apiService.createItinerary(newTrip)
      expect(result).toEqual(mockResponse)
    })

    it('should reject missing required fields', async () => {
      await expect(
        apiService.createItinerary({ name: 'Trình không đầy đủ' })
      ).rejects.toThrow('Missing required fields')
    })

    it('should handle 400 Bad Request', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      })

      await expect(
        apiService.createItinerary({
          name: 'Test',
          startDate: '2026-09-10',
          endDate: '2026-09-15',
        })
      ).rejects.toThrow('HTTP 400: Bad Request')
    })
  })

  describe('updateItinerary', () => {
    it('should update existing itinerary', async () => {
      const updateData = { name: 'Tên trình cập nhật' }
      const mockResponse = { id: 1, ...updateData }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await apiService.updateItinerary(1, updateData)
      expect(result).toEqual(mockResponse)
    })

    it('should throw error for invalid ID', async () => {
      await expect(
        apiService.updateItinerary('invalid', {})
      ).rejects.toThrow('Invalid itinerary ID')
    })

    it('should handle 403 Forbidden (permission denied)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })

      await expect(
        apiService.updateItinerary(1, { name: 'Updated' })
      ).rejects.toThrow('HTTP 403: Forbidden')
    })
  })

  describe('deleteItinerary', () => {
    it('should delete itinerary successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
      })

      await apiService.deleteItinerary(1)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw error for invalid ID', async () => {
      await expect(apiService.deleteItinerary(null)).rejects.toThrow(
        'Invalid itinerary ID'
      )
    })

    it('should handle 404 Not Found', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(apiService.deleteItinerary(999)).rejects.toThrow(
        'HTTP 404: Not Found'
      )
    })

    it('should handle 403 Forbidden on delete', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })

      await expect(apiService.deleteItinerary(1)).rejects.toThrow(
        'HTTP 403: Forbidden'
      )
    })
  })
})

export { ApiService }