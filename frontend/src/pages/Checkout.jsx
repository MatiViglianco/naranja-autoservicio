// src/pages/Checkout.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../store/cart.jsx'
import { createOrder, getSiteConfig, validateCoupon } from '../api.js'
import { toast } from 'sonner'
import ButtonAnimatedGradient from '../components/ui/ButtonAnimatedGradient.jsx'
import CartGrouped from '../components/cart/CartGrouped.jsx'

export default function Checkout() {
  const navigate = useNavigate()
  const { items, setQty, remove, clear, subtotal } = useCart()

  // Config & form
  const [cfg, setCfg] = useState({ whatsapp_phone: '', alias_or_cbu: '', shipping_cost: 0 })
  const [form, setForm] = useState({
    name: '', phone: '', address: '', notes: '',
    payment_method: 'cash', delivery_method: 'delivery'
  })
  const [loading, setLoading] = useState(false)

  // Cupón
  const [coupon, setCoupon] = useState('')
  const [couponInfo, setCouponInfo] = useState(null)
  const [couponMessage, setCouponMessage] = useState('')
  const [couponError, setCouponError] = useState(false)

  useEffect(() => { getSiteConfig().then(setCfg).catch(() => {}) }, [])

  useEffect(() => {
    if (form.delivery_method === 'pickup' && form.address !== '') {
      setForm(prev => ({ ...prev, address: '' }))
    }
  }, [form.delivery_method])

  const effectiveShipping = useMemo(() => {
    if (form.delivery_method === 'pickup') return 0
    if (couponInfo?.valid && couponInfo.type === 'free_shipping' && subtotal >= Number(couponInfo.min_subtotal || 0)) return 0
    return Number(cfg.shipping_cost || 0)
  }, [form.delivery_method, couponInfo, subtotal, cfg])

  const estDiscount = useMemo(() => {
    if (!couponInfo?.valid) return 0
    if (subtotal < Number(couponInfo.min_subtotal || 0)) return 0
    if (couponInfo.type === 'fixed') return Math.min(Number(couponInfo.amount || 0), subtotal)
    if (couponInfo.type === 'percent') {
      const raw = subtotal * (Number(couponInfo.percent || 0) / 100)
      const cap = Number(couponInfo.percent_cap || 0)
      return cap > 0 ? Math.min(raw, cap) : raw
    }
    return 0
  }, [couponInfo, subtotal])

  const estTotal = useMemo(
    () => Math.max(0, subtotal - estDiscount + effectiveShipping),
    [subtotal, estDiscount, effectiveShipping]
  )

  // Desglose de descuentos
  const productSavingsLines = useMemo(() => {
    return items.flatMap(it => {
      const price = Number(it.product.price ?? 0)
      const offer = Number(it.product.offer_price ?? price)
      const diff = Math.max(0, price - offer) * Number(it.quantity ?? 0)
      if (diff <= 0) return []
      const name = String(it.product.name || 'Producto')
      const short = name.length > 34 ? name.slice(0, 31) + '…' : name
      return [{ label: short, amount: diff }]
    })
  }, [items])

  const shippingSavingsLine = useMemo(() => {
    const freeShip = couponInfo?.valid && couponInfo.type === 'free_shipping' && subtotal >= Number(couponInfo.min_subtotal || 0)
    if (form.delivery_method === 'delivery' && freeShip && Number(cfg.shipping_cost || 0) > 0) {
      return { label: 'Cupón: Envío gratis', amount: Number(cfg.shipping_cost || 0) }
    }
    return null
  }, [couponInfo, form.delivery_method, subtotal, cfg])

  const couponSavingsLine = useMemo(() => {
    if (estDiscount <= 0) return null
    if (couponInfo?.type === 'percent') return { label: `${Number(couponInfo.percent || 0)}% OFF`, amount: estDiscount }
    return { label: 'Cupón', amount: estDiscount }
  }, [estDiscount, couponInfo])


  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const formatArs = (v) => Number(v).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

  const onSubmit = async (e) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error('Tu carrito est\u00e1 vac\u00edo.')
      return
    }
    setLoading(true)
    try {

      const payload = {
        name: form.name,
        phone: form.phone,
        address: form.delivery_method === 'pickup' ? '' : form.address,
        notes: form.notes,
        payment_method: form.payment_method,
        delivery_method: form.delivery_method,
        items: items.map(it => ({ product_id: it.product.id, quantity: Number(it.quantity || 1) }))
      }
      const order = await createOrder({ ...payload, coupon_code: coupon })

      const phone = (cfg.whatsapp_phone || import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/[^0-9+]/g, '')
      const tienda = 'Naranja autoservicio'
      const fecha = new Date(order.created_at || Date.now()).toLocaleString('es-AR', { hour12: false })
      const paymentLabel = order.payment_method === 'cash' ? 'Efectivo' : 'Transferencia'
      const deliveryLabel = (order.delivery_method || form.delivery_method) === 'pickup' ? 'Retiro' : 'Delivery'
      const shopAddress = 'Ordo\u00f1ez 69, La Carlota, C\u00f3rdoba'
      const userAddress = form.address || order.address || ''
      const mapsLinkEntrega = userAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(userAddress)}`
        : ''
      const mapsLinkTienda = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress)}`
      const subtotalCalc = items.reduce(
        (a, it) => a + Number((it.product.offer_price ?? it.product.price)) * Number(it.quantity || 1),
        0
      )
      const shippingValue = Number(order.shipping_cost ?? 0)
      const discountValue = Number(estDiscount ?? 0)

      const lines = [
        '\u00a1Hola! Te paso el resumen de mi pedido', '',
        `Pedido: #${order.id}`, `Tienda: ${tienda}`, `Fecha: ${fecha}`, `Nombre: ${order.name}`, `Tel\u00e9fono: ${order.phone}`, '',
        `Forma de pago: ${paymentLabel}`,
        `Entrega: ${deliveryLabel}`,
        ...(deliveryLabel === 'Delivery' && userAddress ? [`Direcci\u00f3n de entrega: ${userAddress}`] : []),
        ...(deliveryLabel === 'Delivery' && mapsLinkEntrega ? [`Ubicaci\u00f3n entrega: ${mapsLinkEntrega}`] : []),
        ...(deliveryLabel === 'Retiro' ? [`Direcci\u00f3n de retiro (tienda): ${shopAddress}`] : []),
        ...(deliveryLabel === 'Retiro' ? [`Ubicaci\u00f3n retiro: ${mapsLinkTienda}`] : []),
        ...(deliveryLabel === 'Retiro' ? ['Retiro en tienda: por favor acercate al local.'] : []),
        'Mi pedido es',
        ...items.map(it => {
          const unit = Number(it.product.offer_price ?? it.product.price)
          const qty = Number(it.quantity || 1)
          return `${qty}x ${it.product.name}: ${formatArs(unit * qty)}`
        }),
        '',
        `Subtotal: ${formatArs(subtotalCalc)}`,
        ...(discountValue > 0 ? [`Descuentos: ${formatArs(discountValue)}${coupon ? ` (cup\u00f3n ${coupon.trim()})` : ''}`] : []),
        `Env\u00edo: ${formatArs(shippingValue)}${shippingValue === 0 && deliveryLabel === 'Delivery' ? ' (bonificado)' : ''}`,
        `Total: ${formatArs(order.total)}`
      ]

      if ((order.payment_method || form.payment_method) === 'transfer') {
        lines.push(
          '',
          'Datos para transferencia:',
          'Alias: naranja.ats',
          'Nombre y apellido: Geraldina Vinciguerra',
          'CUIT/CUIL: 27-40679283-3',
          'Entidad: Mercado Pago',
          'Envi\u00e1 el comprobante por este chat, por favor.'
        )
      }

      if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')

      clear()
      toast.success('Pedido enviado por WhatsApp!')
      navigate('/', { replace: true, state: { showThankYou: true, resetSearch: true } })
    } catch (err) {
      const message = err?.message || 'No pudimos crear el pedido. Revis\u00e1 los datos e intent\u00e1 nuevamente.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const applyCoupon = async () => {
    setCouponMessage(''); setCouponInfo(null); setCouponError(false)
    if (!coupon.trim()) return
    try {
      const info = await validateCoupon(coupon.trim())
      setCouponInfo(info)
      if (!info.valid) { setCouponError(true); setCouponMessage('Cupón inválido') }
      else if (subtotal < Number(info.min_subtotal || 0)) { setCouponError(true); setCouponMessage(`Monto mínimo: ${formatArs(Number(info.min_subtotal || 0))}`) }
      else { setCouponMessage('Cupón aplicado') }
    } catch {
      setCouponError(true); setCouponMessage('No se pudo validar el cupón')
    }
  }

  const copyAlias = async () => {
    try {
      await navigator.clipboard.writeText(cfg.alias_or_cbu || '')
      toast.success('Datos de transferencia copiados')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  // Toggle pill (switch)
  const TogglePill = ({ options = [], value, onChange }) => (
    <div className="inline-flex items-center gap-1 rounded-full border border-orange-600 p-1 bg-white dark:bg-[#020617] shadow-sm transition-colors">
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'px-3 py-1 rounded-full text-sm transition-all duration-200',
              active
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow'
                : 'text-slate-700 dark:text-slate-200 hover:text-orange-600 hover:bg-orange-500/10'
            ].join(' ')}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6">
      {/* IZQUIERDA: Carrito */}
      <div className="
        md:col-span-1 rounded-2xl p-4
        bg-white border border-slate-200 shadow-sm
        dark:bg-transparent dark:border-slate-700/60
        dark:shadow-[0_0_0_1px_rgba(148,163,184,0.28),0_20px_40px_-20px_rgba(0,0,0,0.65)]
      ">
        <h3 className="text-2xl md:text-3xl font-extrabold text-center text-orange-600 mb-4 tracking-tight">
          Carrito
        </h3>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="
              my-4 rounded-xl border border-slate-200 p-10 text-center bg-white shadow-sm
              dark:bg-transparent dark:border-slate-700/60
              dark:shadow-[0_0_0_1px_rgba(148,163,184,0.28),0_20px_40px_-20px_rgba(0,0,0,0.65)]
            ">
              <div className="mx-auto mb-4 h-28 w-28 text-orange-600" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="139" height="136" viewBox="0 0 139 136" fill="none" className="h-full w-full">
                  <ellipse cx="86.5747" cy="124.85" rx="44.2948" ry="4.92164" fill="#fbbf24" />
                  <path d="M94.426 106.532C94.173 105.201 94.1864 103.833 94.4641 102.506C94.7417 101.179 95.2766 99.9191 96.0426 98.7983C96.8086 97.6775 97.7875 96.7171 98.9252 95.9731C100.063 95.2291 101.338 94.7159 102.675 94.462C105.371 93.9476 108.159 94.5221 110.428 96.0576C112.697 97.5932 114.261 99.9643 114.774 102.65C115.286 105.336 114.704 108.117 113.16 110.38C111.616 112.643 109.235 114.203 106.539 114.718C105.203 114.974 103.828 114.964 102.496 114.691C101.164 114.418 99.9006 113.886 98.7758 113.126C97.651 112.366 96.6902 111.393 95.9435 110.261C95.1969 109.13 94.6808 107.863 94.426 106.532ZM58.9402 113.302C58.6845 111.971 58.6954 110.602 58.9711 109.275C59.2468 107.948 59.7811 106.689 60.5461 105.568C61.3111 104.447 62.2914 103.487 63.4287 102.743C64.5661 101.999 65.8391 101.487 67.1751 101.234C68.5107 100.977 69.8856 100.984 71.2173 101.257C72.5489 101.53 73.813 102.062 74.9375 102.823C76.0619 103.583 77.0244 104.557 77.7701 105.689C78.5157 106.821 79.0281 108.09 79.281 109.421C79.5358 110.752 79.5263 112.119 79.2498 113.446C78.9734 114.773 78.4369 116.033 77.6713 117.154C76.9058 118.275 75.9265 119.235 74.7887 119.979C73.651 120.722 72.3755 121.237 71.0392 121.49C69.704 121.746 68.3308 121.736 66.9998 121.463C65.6689 121.19 64.4068 120.657 63.2831 119.897C62.1594 119.136 61.199 118.161 60.454 117.03C59.7089 115.898 59.193 114.632 58.9402 113.302ZM57.5371 94.3965C56.7113 94.5534 55.8564 94.4415 55.1006 94.0761C54.3449 93.7107 53.7283 93.1115 53.3418 92.3684L25.2385 37.7916L4.92365 34.2203C4.2356 34.1234 3.58567 33.8428 3.04537 33.4079C2.50508 32.9731 2.0946 32.4003 1.85501 31.7506C1.61414 31.1 1.55314 30.3958 1.6814 29.7137C1.80966 29.0316 2.12001 28.3958 2.58109 27.8753C3.03436 27.3478 3.62304 26.9511 4.28227 26.7263C4.9415 26.5016 5.64686 26.4578 6.32868 26.5983L28.5287 30.4917C29.1179 30.5926 29.6755 30.8284 30.1576 31.1802C30.6398 31.5321 31.031 31.9899 31.3052 32.5192L36.5744 42.7493L114.522 27.8794C115.095 27.7668 115.687 27.7843 116.251 27.9296C116.816 28.0748 117.342 28.3433 117.788 28.7178C118.23 29.0981 118.577 29.5749 118.806 30.11C119.036 30.6451 119.142 31.2245 119.112 31.8059L117.127 79.9593C117.094 80.8324 116.765 81.6678 116.193 82.3307C115.621 82.9936 114.84 83.4445 113.979 83.6079L57.5371 94.3965ZM95.5547 39.5601L95.4649 79.2807L109.476 76.6079L111.129 36.3839L95.51 39.3634C95.529 39.4312 95.5356 39.5023 95.5284 39.5723L95.5547 39.5601ZM79.3728 82.3506L87.6833 80.7652L87.7768 40.8387L64.6324 45.2539L79.3728 82.3506ZM58.9317 86.2501L71.5911 83.8351L57.2 47.5925C57.1056 47.3048 57.0486 47.0063 57.0305 46.7041L40.2227 49.9104L58.9317 86.2501Z" fill="#f97316" />
                </svg>
              </div>
              <h4 className="text-2xl md:text-3xl font-extrabold text-orange-600 mb-2">Su carrito está vacío</h4>
              <p className="text-slate-600 dark:text-slate-300 mb-6">No tenés artículos en tu carrito de compras.</p>
              <button
                type="button"
                onClick={() => window.location.assign(import.meta.env.BASE_URL || '/')}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                CONTINUAR COMPRANDO
              </button>
            </div>
          ) : (
            <CartGrouped
              items={items}
              onInc={(id) => {
                const it = items.find(i => i.product.id === id)
                if (it) setQty(id, Number(it.quantity || 1) + 1)
              }}
              onDec={(id) => {
                const it = items.find(i => i.product.id === id)
                if (it) setQty(id, Number(it.quantity || 1) - 1)
              }}
              onRemove={remove}
              onClear={clear}
              onSetQty={setQty}
            />
          )}
        </div>

        {/* Resumen de la compra */}
        <div className="
          mt-5 rounded-2xl p-5
          bg-slate-50/60 border border-slate-200
          dark:bg-transparent dark:border-slate-700/60
          dark:shadow-[0_0_0_1px_rgba(148,163,184,0.22)]
        ">
          <h4 className="text-2xl md:text-3xl font-extrabold text-center text-orange-600 mb-4 tracking-tight">
            Resumen de la compra
          </h4>

          <div className="grid grid-cols-2 items-center text-base md:text-lg px-2 py-1">
            <span className="text-slate-700 dark:text-slate-200">Subtotal</span>
            <span className="text-right font-semibold text-slate-900 dark:text-slate-100">{formatArs(subtotal)}</span>
          </div>

          <div className="grid grid-cols-2 items-center text-base md:text-lg px-2 py-1">
            <span className="text-slate-700 dark:text-slate-200">Envío</span>
            <span className="text-right font-semibold text-slate-900 dark:text-slate-100">{effectiveShipping === 0 ? '$ 0,00' : formatArs(effectiveShipping)}</span>
          </div>

          {/* Descuentos */}
          <div className="mt-3 space-y-1 px-2">
            {productSavingsLines.map((d, i) => (
              <div key={`prod-disc-${i}`} className="grid grid-cols-2 items-center">
                <span className="font-bold text-red-700 uppercase text-sm md:text-base truncate">{d.label}</span>
                <span className="text-right font-bold text-red-700">-{formatArs(d.amount)}</span>
              </div>
            ))}
            {couponSavingsLine && (
              <div className="grid grid-cols-2 items-center">
                <span className="font-bold text-red-700 uppercase text-sm md:text-base truncate">{couponSavingsLine.label}</span>
                <span className="text-right font-bold text-red-700">-{formatArs(couponSavingsLine.amount)}</span>
              </div>
            )}
            {shippingSavingsLine && (
              <div className="grid grid-cols-2 items-center">
                <span className="font-bold text-red-700 uppercase text-sm md:text-base truncate">{shippingSavingsLine.label}</span>
                <span className="text-right font-bold text-red-700">-{formatArs(shippingSavingsLine.amount)}</span>
              </div>
            )}
          </div>

          {/* TOTAL */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/40 px-2">
            <div className="grid grid-cols-2 items-center">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-right text-2xl font-extrabold text-slate-900 dark:text-slate-100">{formatArs(estTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DERECHA: Finalizar compra */}
      <div className="md:col-span-1 md:sticky md:top-6 h-fit">
        <div className="
          space-y-4 rounded-2xl p-4
          bg-white border border-slate-200 shadow-sm
          dark:bg-transparent dark:border-slate-700/60
          dark:shadow-[0_0_0_1px_rgba(148,163,184,0.28),0_20px_40px_-20px_rgba(0,0,0,0.65)]
        ">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-orange-600 mb-4 tracking-tight">
            Finalizar compra
          </h2>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="name" value={form.name} onChange={onChange} className="border rounded px-3 py-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" placeholder="Nombre" required />
              <input name="phone" value={form.phone} onChange={onChange} className="border rounded px-3 py-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" placeholder="Teléfono" required />
            </div>
            <div className="relative">
              <input
                name="address"
                value={form.address}
                onChange={onChange}
                disabled={form.delivery_method === 'pickup'}
                className={[
                  'border rounded px-3 py-2 w-full border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
                  form.delivery_method === 'pickup' ? 'opacity-50 blur-[1px]' : ''
                ].join(' ')}
                placeholder={form.delivery_method === 'pickup' ? '' : 'Dirección'}
                required={form.delivery_method === 'delivery'}
              />
              {form.delivery_method === 'pickup' && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-gray-900/70 rounded cursor-not-allowed select-none">
                  No es necesaria la dirección para retiro en tienda.
                </div>
              )}
            </div>
            <textarea name="notes" value={form.notes} onChange={onChange} className="border rounded px-3 py-2 w-full border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" placeholder="Notas (opcional)" />

            <div className="flex items-center gap-4">
              <TogglePill
                value={form.payment_method}
                onChange={(v) => setForm(prev => ({ ...prev, payment_method: v }))}
                options={[
                  { value: 'cash', label: 'Efectivo' },
                  { value: 'transfer', label: 'Transferencia' }
                ]}
              />
            </div>
            <div className="flex items-center gap-4">
              <TogglePill
                value={form.delivery_method}
                onChange={(v) => setForm(prev => ({ ...prev, delivery_method: v }))}
                options={[
                  { value: 'delivery', label: 'Envío a domicilio' },
                  { value: 'pickup', label: 'Retiro en tienda' }
                ]}
              />
            </div>

            <ButtonAnimatedGradient disabled={loading}>
              {loading ? 'Enviando...' : 'Confirmar pedido y abrir WhatsApp'}
            </ButtonAnimatedGradient>

            {/* Cupón */}
            <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/80 dark:bg-orange-950/20 p-4 mt-2">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 2c5.523 0 10 4.477 10 10a10 10 0 0 1 -20 0l.004 -.28c.148 -5.393 4.566 -9.72 9.996 -9.72m3 12.12a1 1 0 0 0 -1 1v.015a1 1 0 0 0 2 0v-.015a1 1 0 0 0 -1 -1m.707 -5.752a1 1 0 0 0 -1.414 0l-6 6a1 1 0 0 0 1.414 1.414l6 -6a1 1 0 0 0 0 -1.414m-6.707 -.263a1 1 0 0 0 -1 1v.015a1 1 0 1 0 2 0v-.015a1 1 0 0 0 -1 -1" /></svg>
                </span>
                <div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">¿Tenés cupones de descuento?</div>
                  <div className="text-base font-semibold text-slate-800 dark:text-slate-200">Ingresalos acá:</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  value={coupon}
                  onChange={e=>setCoupon(e.target.value)}
                  placeholder="Código"
                  className="border rounded px-3 py-2 flex-1 border-orange-200 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:border-orange-800 dark:bg-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="px-4 py-2 rounded font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-auto"
                >
                  APLICAR
                </button>
              </div>

              {couponMessage && (
                <div className={`mt-2 text-xs ${couponError ? 'text-red-700' : 'text-green-700'}`}>{couponMessage}</div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
