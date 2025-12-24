const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://api2.mativiglianco.cloud/api'
    : 'http://localhost:8000/api')

export async function getCategories() {
  const r = await fetch(`${API_URL}/categories/`)
  if (!r.ok) throw new Error('Error al cargar categorías')
  return r.json()
}

export async function getProducts({ page = 1, search = '', ordering = '', category, page_size, promoted } = {}) {
  const url = new URL(`${API_URL}/products/`)
  if (page) url.searchParams.set('page', page)
  if (search) url.searchParams.set('search', search)
  if (ordering) url.searchParams.set('ordering', ordering)
  if (category) url.searchParams.set('category', category)
  if (page_size) url.searchParams.set('page_size', page_size)
  if (promoted) url.searchParams.set('promoted', promoted)
  const r = await fetch(url)
  if (r.status === 404) {
    return { results: [], next: null, previous: null, count: 0 }
  }
  if (!r.ok) throw new Error('Error al cargar productos')
  return r.json()
}

export async function getSiteConfig() {
  const r = await fetch(`${API_URL}/config/`)
  if (!r.ok) throw new Error('Error al cargar configuración')
  return r.json()
}

export async function createOrder(payload) {
  const r = await fetch(`${API_URL}/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    let err
    try { err = await r.json() } catch { err = { detail: 'Error al crear pedido' } }
    const normalize = (data) => {
      if (!data) return 'Error al crear pedido'
      if (typeof data === 'string') return data
      if (Array.isArray(data)) return data.join(', ')
      if (typeof data === 'object') {
        const parts = Object.entries(data).map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
          if (typeof v === 'string') return `${k}: ${v}`
          try { return `${k}: ${JSON.stringify(v)}` } catch { return `${k}: ${String(v)}` }
        })
        return parts.join(' | ') || 'Error al crear pedido'
      }
      return 'Error al crear pedido'
    }
    throw new Error(normalize(err.detail ? { detail: err.detail } : err))
  }
  return r.json()
}

export async function validateCoupon(code) {
  const r = await fetch(`${API_URL}/coupons/validate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!r.ok) {
    let err
    try { err = await r.json() } catch { err = { detail: 'No se pudo validar el cupón' } }
    throw new Error(err.detail || JSON.stringify(err))
  }
  const data = await r.json()
  return {
    valid: data.valid,
    type: data.type,
    amount: data.amount,
    percent: data.percent,
    percent_cap: data.percent_cap,
    min_subtotal: data.min_subtotal,
  }
}

export async function getAnnouncements() {
  const r = await fetch(`${API_URL}/announcements/`)
  if (!r.ok) throw new Error('Error al cargar anuncios')
  return r.json()
}
