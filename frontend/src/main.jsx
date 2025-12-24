import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Checkout from './pages/Checkout.jsx'
import { CartProvider, useCart } from './store/cart.jsx'
import './index.css'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import Footer from './components/Footer.jsx'
import { getAnnouncements, getProducts } from './api.js'

const base = import.meta.env.BASE_URL

function Navbar() {
  const { count } = useCart()
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })

  React.useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  const [notifOpen, setNotifOpen] = React.useState(false)
  const [ann, setAnn] = React.useState([])
  const [promoted, setPromoted] = React.useState([])

  React.useEffect(() => {
    if (!notifOpen) return
    let cancelled = false
    Promise.all([
      getAnnouncements().catch(() => []),
      getProducts({ promoted: true }).catch(() => ({ results: [] }))
    ]).then(([a, p]) => { if (!cancelled) { setAnn(a); setPromoted(Array.isArray(p.results) ? p.results : p) } })
    return () => { cancelled = true }
  }, [notifOpen])

  return (
    <nav className="bg-white dark:bg-[#020617] border-b border-gray-200 dark:border-gray-800 shadow-sm fixed top-0 left-0 right-0 z-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between relative">
        <Link to="/" state={{ resetSearch: true }} className="flex items-center gap-2">
          <img
            src={`${base}logo-icon.png`}
            alt="Naranja Autoservicio"
            className="h-12 md:h-14 w-auto"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `${base}logo-icon.png` }}
          />
        </Link>
        {/* Logo centrado solo en escritorio */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 hidden md:block">
          <img src={`${base}logo-wide.png`} alt="Naranja Autoservicio" className="h-12 lg:h-14 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDark(d => !d)} className="h-10 w-10 rounded-md flex items-center justify-center bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-colors">
            <AnimatePresence initial={false} mode="wait">
              {!dark ? (
                <motion.span key="sun" initial={{ rotate: -90, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 19a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z" /><path d="M18.313 16.91l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07z" /><path d="M7.007 16.993a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z" /><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" /><path d="M21 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" /><path d="M6.213 4.81l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.217 -1.567l.102 .07z" /><path d="M19.107 4.893a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z" /><path d="M12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z" /><path d="M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z" /></svg>
                </motion.span>
              ) : (
                <motion.span key="moon" initial={{ rotate: -90, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 1.992a10 10 0 1 0 9.236 13.838c.341 -.82 -.476 -1.644 -1.298 -1.31a6.5 6.5 0 0 1 -6.864 -10.787l.077 -.08c.551 -.63 .113 -1.653 -.758 -1.653h-.266l-.068 -.006l-.06 -.002z" /></svg>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {/* Notificaciones: botón tipo lupita con campana */}
          <button
            type="button"
            onClick={() => setNotifOpen(o => !o)}
            className={[
              'h-10 w-10 rounded-md flex items-center justify-center',
              'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
              'text-white shadow-sm transition-colors'
            ].join(' ')}
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14.235 19c.865 0 1.322 1.024 .745 1.668a3.992 3.992 0 0 1 -2.98 1.332a3.992 3.992 0 0 1 -2.98 -1.332c-.552 -.616 -.158 -1.579 .634 -1.661l.11 -.006h4.471z" /><path d="M12 2c1.358 0 2.506 .903 2.875 2.141l.046 .171l.008 .043a8.013 8.013 0 0 1 4.024 6.069l.028 .287l.019 .289v2.931l.021 .136a3 3 0 0 0 1.143 1.847l.167 .117l.162 .099c.86 .487 .56 1.766 -.377 1.864l-.116 .006h-16c-1.028 0 -1.387 -1.364 -.493 -1.87a3 3 0 0 0 1.472 -2.063l.021 -.143l.001 -2.97a8 8 0 0 1 3.821 -6.454l.248 -.146l.01 -.043a3.003 3.003 0 0 1 2.562 -2.29l.182 -.017l.176 -.004z" /></svg>
          </button>

          {/* Carrito como botón cuadrado naranja */}
          <Link
            to="/checkout"
            className="relative inline-flex items-center gap-3 border-2 rounded-full px-5 py-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-800 transition-all shadow-sm"
            aria-label="Carrito"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 2a1 1 0 0 1 .993 .883l.007 .117v1.068l13.071 .935a1 1 0 0 1 .929 1.024l-.01 .114l-1 7a1 1 0 0 1 -.877 .853l-.113 .006h-12v2h10a3 3 0 1 1 -2.995 3.176l-.005 -.176l.005 -.176c.017 -.288 .074 -.564 .166 -.824h-5.342a3 3 0 1 1 -5.824 1.176l-.005 -.176l.005 -.176a3.002 3.002 0 0 1 1.995 -2.654v-12.17h-1a1 1 0 0 1 -.993 -.883l-.007 -.117a1 1 0 0 1 .883 -.993l.117 -.007h2zm0 16a1 1 0 1 0 0 2a1 1 0 0 0 0 -2zm11 0a1 1 0 1 0 0 2a1 1 0 0 0 0 -2z" /></svg>
            <span className="text-base font-semibold">Carrito</span>
            <span className="absolute -top-3 -right-3 bg-orange-600 text-white text-xs rounded-full h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center shadow-md">
              {count}
            </span>
          </Link>
        </div>

        {/* Panel de notificaciones */}
        {notifOpen && (
          <div className="absolute right-4 top-[calc(100%+8px)] w-[28rem] max-w-[90vw] rounded-xl border border-orange-600 bg-white dark:bg-[#020617] shadow-xl z-30 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold text-orange-600">Notificaciones</div>
              <button onClick={() => setNotifOpen(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Cerrar</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
              {ann.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Mensajes</div>
                  <ul className="space-y-1">
                    {ann.map(a => (
                      <li key={a.id} className="rounded-md border border-orange-600/40 p-2 bg-white dark:bg-[#020617]">
                        <div className="font-medium">{a.title}</div>
                        {a.message && (<div className="text-sm text-slate-600 dark:text-slate-300">{a.message}</div>)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Promociones</div>
                <div className="grid grid-cols-2 gap-2">
                  {promoted.slice(0,4).map(p => (
                    <Link to={`/`} key={p.id} className="rounded-lg border border-orange-600/40 p-2 bg-white dark:bg-[#020617]">
                      <div className="text-sm font-medium leading-tight line-clamp-3 min-h-[3.5rem]">{p.name}</div>
                      <div className="text-xs text-slate-500">${Number(p.offer_price ?? p.price).toFixed(2)}</div>
                    </Link>
                  ))}
                  {promoted.length === 0 && (<div className="text-sm text-slate-500">Sin promociones activas</div>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

function App() {
  return (
    <CartProvider>
      <div className="relative min-h-screen overflow-x-hidden flex flex-col" id="app-root">
        {/* Fondo fijo: claro liso, oscuro con grilla + máscara */}
        <div className="pointer-events-none fixed inset-0 z-[-2] w-full h-full bg-transparent dark:bg-slate-950">
          {/* Fondo claro con radial gradient (solo modo claro) */}
          <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.18),rgba(255,255,255,0))] dark:hidden"></div>
          {/* Fondo oscuro: base slate-950 con blobs naranjas en los costados superiores */}
          <div className="absolute inset-0 hidden dark:block">
            <div className="relative h-full w-full bg-slate-950">
              <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(249,115,22,.15),rgba(255,255,255,0))]"></div>
              <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(249,115,22,.15),rgba(255,255,255,0))]"></div>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <HashRouter>
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 pt-24 pb-6">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/checkout" element={<Checkout />} />
              </Routes>
            </div>
          </HashRouter>
        </div>
        <Footer />
        <Toaster richColors position="bottom-right" />
      </div>
    </CartProvider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
