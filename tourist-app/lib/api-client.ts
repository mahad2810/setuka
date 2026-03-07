// Utility for making authenticated API calls with automatic token expiration handling
export class ApiClient {
  private static handleTokenExpiration() {
    // Remove expired token
    localStorage.removeItem('token')
    
    // Show user-friendly message
    if (typeof window !== 'undefined') {
      // Create a toast-like notification
      const notification = document.createElement('div')
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 400px;
      `
      notification.textContent = 'Session expired. Redirecting to login...'
      document.body.appendChild(notification)

      // Remove notification and redirect after 2 seconds
      setTimeout(() => {
        document.body.removeChild(notification)
        window.location.href = '/auth'
      }, 2000)
    }
  }

  static async fetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token')
    
    if (!token) {
      throw new Error('No authentication token found')
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle token expiration
    if (response.status === 401) {
      try {
        const errorData = await response.clone().json()
        if (errorData.code === 'TOKEN_EXPIRED') {
          this.handleTokenExpiration()
          throw new Error('Session expired. Please login again.')
        }
      } catch (e) {
        // If we can't parse the error, assume token expired
        this.handleTokenExpiration()
        throw new Error('Authentication failed. Please login again.')
      }
    }

    return response
  }

  static async post(url: string, data: any) {
    return this.fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  static async get(url: string) {
    return this.fetch(url, {
      method: 'GET',
    })
  }

  static async put(url: string, data: any) {
    return this.fetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  static async delete(url: string) {
    return this.fetch(url, {
      method: 'DELETE',
    })
  }
}

// Legacy function for backward compatibility
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  return ApiClient.fetch(url, options)
}