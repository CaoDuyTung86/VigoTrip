import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ✅ MOCK TRƯỚC import component
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    token: 'mock-token-123',
    user: { id: 1, role: 'ROLE_ADMIN', name: 'Admin User' }
  }))
}))

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: {
      admTripsTitle: 'Admin Trips Management',
      admTripsSubtitle: 'Manage all trips',
      admAdminOnly: 'Admin only access',
      admLoadTripsError: 'Error loading trips',
      admErrorStatus: 'Error: {status}',
      admInvalidJsonPreview: 'Invalid JSON: {preview}',
      admEmptyPreview: 'Empty response',
      admNoContentType: 'No content type',
      admInvalidDataPreview: 'Invalid data: {contentType} - {preview}',
      admServerError: 'Server error',
      admSearchPlaceholder: 'Search trips...',
      admSearchBtn: 'Search',
      admCreateTripTitle: 'Create New Trip',
      admRouteLabel: 'Route',
      admSelectRoute: 'Select route',
      admVehicleLabel: 'Vehicle',
      admSelectVehicle: 'Select vehicle',
      admSeatCount: '{count} seats',
      departureDate: 'Departure Date',
      status: 'Status',
      admDepartureTimeLabel: 'Departure Time',
      admArrivalTimeLabel: 'Arrival Time',
      admPriceLabel: 'Price',
      admPriceExample: 'e.g. 150000',
      admCreating: 'Creating...',
      admCreateTripBtn: 'Create Trip',
      admCreateRequired: 'All fields required',
      admCreateError: 'Error creating trip',
      admLoading: 'Loading...',
      admReloadList: 'Reload List',
      admRouteCol: 'Route',
      admDepartureCol: 'Departure',
      admArrivalCol: 'Arrival',
      admCarrierCol: 'Carrier',
      admCurrentPriceCol: 'Current Price',
      admEditPriceCol: 'Edit Price',
      admActionsCol: 'Actions',
      admNoTrips: 'No trips found',
      admNewPricePlaceholder: 'New price',
      admSaveBtn: 'Save',
      admPriceInvalid: 'Invalid price',
      admPriceUpdateError: 'Error updating price',
      admPageInfo: 'Page {current} of {total}',
      admPrevPage: 'Previous',
      admNextPage: 'Next',
      admDelayTitle: 'Delay Trip',
      admDelayBtn: 'Delay',
      admNewDepartureLabel: 'New Departure',
      admReasonLabel: 'Reason',
      admDelayReasonPlaceholder: 'Enter delay reason',
      admDelayReasonRequired: 'Delay reason required',
      admDelayError: 'Error: {msg}',
      admDelayConfirmBtn: 'Confirm Delay',
      admCancelTripTitle: 'Cancel Trip',
      cancelBtn: 'Cancel',
      admCancelWarning: 'This action cannot be undone!',
      admCancelReasonPlaceholder: 'Enter cancellation reason',
      admCancelReasonRequired: 'Cancel reason required',
      admCancelError: 'Error: {msg}',
      admCancelConfirmBtn: 'Confirm Cancel',
      qrCloseBtn: 'Close',
      processing: 'Processing...',
      flight: 'Flight',
      bus: 'Bus',
      train: 'Train'
    },
    currentLanguage: { code: 'vi' }
  }))
}))

vi.mock('react-icons/ri', () => ({
  RiTimerLine: () => <span>Timer</span>
}))

vi.mock('react-icons/md', () => ({
  MdOutlineCancel: () => <span>Cancel</span>
}))

// ✅ Import AFTER mocks
import AdminTrips from '../../Page/AdminTrips'

describe('AdminTrips Component - Phase 2 (Issue #23)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // ✅ MOCK fetch globally
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render admin trips page when user is admin', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/Admin Trips Management/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should load routes and vehicles on mount', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        // Fetch should be called for trips, routes, and vehicles
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Trip Loading & Display', () => {
    it('should load trips from API', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/admin/trips'),
          expect.any(Object)
        )
      })
    })

    it('should display empty state', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/No trips found/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display trips when data returned', async () => {
      const mockTrips = [
        {
          id: 1,
          route: { origin: 'HAN', destination: 'SGN' },
          departureTime: '2026-09-01T08:00:00',
          arrivalTime: '2026-09-01T10:00:00',
          price: 250000,
          status: 'ACTIVE',
          vehicle: { provider: { providerName: 'Vietnam Airlines' }, totalSeats: 200 }
        }
      ]

      global.fetch.mockImplementation((url) => {
        if (url.includes('/admin/trips')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ content: mockTrips, totalPages: 1 })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ content: [], totalPages: 1 })
        })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/#1/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error'
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/Error loading trips/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between transport types', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        const busTab = screen.getByText(/^Bus$/i)
        expect(busTab).toBeInTheDocument()
      })

      const busTab = screen.getByText(/^Bus$/i)
      fireEvent.click(busTab)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('type=BUS'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Search & Pagination', () => {
    it('should search trips', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search trips/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search trips/i)
      await userEvent.type(searchInput, 'HAN')

      const searchBtn = screen.getByText(/^Search$/i)
      fireEvent.click(searchBtn)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=HAN'),
          expect.any(Object)
        )
      })
    })

    it('should paginate', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 5 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/^Next$/i)).not.toBeDisabled()
      })

      const nextBtn = screen.getByText(/^Next$/i)
      fireEvent.click(nextBtn)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Create Trip Form', () => {
    it('should render create form', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/Create New Trip/i)).toBeInTheDocument()
      })
    })

    it('should validate required fields', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [], totalPages: 1 })
      })

      render(<AdminTrips />)

      await waitFor(() => {
        expect(screen.getByText(/^Create Trip$/i)).toBeInTheDocument()
      })

      const createBtn = screen.getByText(/^Create Trip$/i)
      fireEvent.click(createBtn)

      await waitFor(() => {
        expect(screen.getByText(/All fields required/i)).toBeInTheDocument()
      })
    })
  })
})