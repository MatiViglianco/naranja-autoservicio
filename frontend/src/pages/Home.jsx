import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCategories, getProducts } from '../api.js'
// import CategoryList from '../components/CategoryList.jsx'
import CategoryDropdown from '../components/CategoryDropdown.jsx'
import SortDropdown from '../components/SortDropdown.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import SearchBar from '../components/SearchBar.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import ErrorView from '../components/ui/ErrorView.jsx'

export default function Home() {
  const location = useLocation()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [category, setCategory] = useState(null)
  const [sort, setSort] = useState('relevance')
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [previewProducts, setPreviewProducts] = useState([])
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [thankYouOpen, setThankYouOpen] = useState(false)
  
  // Cerrar con tecla Escape cuando el panel está abierto
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setOverlayOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen])

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('No se pudo cargar el catálogo'))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const orderingMap = {
      recent: '-created_at',
      discount: 'has_offer,offer_price',
      price_high: '-price',
      price_low: 'price',
      name_az: 'name',
      name_za: '-name',
    }
    const ordering = orderingMap[sort] || ''
    getProducts({
      page,
      search: query,
      category,
      ordering,
      page_size: 20,
    })
      .then((data) => {
        const results = data.results || []
        setProducts(results)
        setHasNext(Boolean(data.next))
        setHasPrev(Boolean(data.previous))
      })
      .catch(() => setError('No se pudo cargar productos'))
      .finally(() => setLoading(false))
  }, [page, query, category, sort])

  useEffect(() => {
    setPage(1)
  }, [query, category, sort])

  // Previsualizar productos mientras se escribe (búsqueda global, no solo la página cargada)
  useEffect(() => {
    if (!search) {
      setPreviewProducts([])
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      getProducts({
        page: 1,
        search,
        category,
        ordering: '',
        page_size: 24,
      })
        .then((data) => {
          if (!cancelled) setPreviewProducts(data.results || [])
        })
        .catch(() => {
          if (!cancelled) setPreviewProducts([])
        })
    }, 250)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [search, category])

  // Botón flotante de ir arriba
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 320)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Resetear buscador y mostrar modal de compra
  useEffect(() => {
    const state = location.state || {}
    let shouldReplace = false
    if (state.resetSearch) {
      setSearch('')
      setQuery('')
      setCategory(null)
      setSort('relevance')
      setOverlayOpen(false)
      setPage(1)
      shouldReplace = true
    }
    if (state.showThankYou) {
      setThankYouOpen(true)
      shouldReplace = true
    }
    if (shouldReplace) {
      // limpiar el state para no repetir al navegar dentro del Home
      navigate('.', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  useEffect(() => {
    if (!thankYouOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setThankYouOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [thankYouOpen])

  if (loading) return <Spinner />
  if (error) return <ErrorView message={error} />

  const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

  //

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 relative">
        <div className="w-full sm:w-96">
          <SearchBar
            value={search}
            onChange={e => { setSearch(e.target.value); setOverlayOpen(true) }}
            onSubmit={() => {
              const next = search.trim()
              if (next) {
                setCategory(null)
                setPage(1)
              }
              setQuery(next)
              setOverlayOpen(false)
            }}
            onBlur={() => setOverlayOpen(false)}
          />
        </div>
        <div className="ml-auto w-full sm:w-auto flex items-stretch gap-2">
          <CategoryDropdown className="flex-1" categories={categories} selected={category} onSelect={setCategory} />
          <SortDropdown className="flex-1" value={sort} onChange={setSort} />
        </div>

        {/* Overlay de sugerencias mientras se escribe */}
        <AnimatePresence>
        {search && search !== query && overlayOpen && (
          <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOverlayOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute left-0 top-full mt-3 w-full z-50 pointer-events-auto rounded-xl border border-orange-600 bg-white/70 dark:bg-[#020617]/80 backdrop-blur shadow-xl p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Columna sugerencias */}
              <div>
                <div className="text-xl font-bold text-orange-600 mb-2">Sugerencias</div>
                <ul className="space-y-1">
                  {categories
                    .filter(c => c.name?.toLowerCase()?.includes(search.toLowerCase()))
                    .slice(0, 8)
                    .map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="text-left w-full px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-500/10"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCategory(c.id);
                            setQuery('');
                            setSearch('');
                            setOverlayOpen(false);
                          }}
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                        </button>
                      </li>
                    ))}
                  {categories.filter(c => c.name?.toLowerCase()?.includes(search.toLowerCase())).length === 0 && (
                    <li className="text-slate-500">Sin sugerencias</li>
                  )}
                </ul>
              </div>

              {/* Columna productos de vista previa */}
              <div className="md:col-span-2">
                    <div className="text-xl font-bold text-orange-600 mb-2">Productos para "{search}"</div>

                {category && (
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-sm text-slate-200">
                      Buscando en: <strong>{categories.find(c => c.id === category)?.name || 'Categoría'}</strong>
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setCategory(null); setPage(1); }}
                      className="px-3 py-1.5 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      Buscar en todo el catálogo
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {previewProducts.slice(0, 12).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(p.name);
                        setQuery(p.name);
                        setCategory(null);
                        setSort('relevance');
                        setPage(1);
                        setOverlayOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-left rounded-lg border border-orange-600/40 bg-white dark:bg-[#020617] p-2 hover:shadow-md hover:border-orange-600 transition"
                    >
                      <div className="aspect-[6/5] rounded-md overflow-hidden bg-transparent dark:bg-white mb-2">
                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain" /> : null}
                      </div>
                      <div className="text-sm font-semibold leading-tight line-clamp-3 min-h-[3.5rem]">{p.name}</div>
                      <div className={["text-xs", p.offer_price && Number(p.offer_price) < Number(p.price) ? 'text-red-600 dark:text-red-500' : 'text-slate-500'].join(' ')}>${Number(p.offer_price ?? p.price).toFixed(2)}</div>
                    </button>
                  ))}
                  {previewProducts.length === 0 && (
                    <div className="col-span-full text-slate-500">
                      {category ? 'Sin coincidencias en esta categoría' : 'Escribe para ver coincidencias…'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
          </>
        )}
        </AnimatePresence>
      </div>

      <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
        {products.map(p => (
          <motion.div key={p.id} variants={itemVariants} className="h-full">
            <ProductCard product={p} />
          </motion.div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full">
            <div className="rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-white/70 dark:bg-[#020617]/60 backdrop-blur p-6 md:p-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-center">
                <div className="flex justify-center md:justify-start">
                  <img src={`${import.meta.env.BASE_URL}searchNone.png`} alt="Sin resultados" className="w-64 md:w-72 h-auto select-none" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-extrabold text-orange-600 mb-3">
                    No encontramos productos que coincidan con tu búsqueda
                  </h3>
                  <p className="text-slate-700 dark:text-slate-200 mb-3">
                    {category
                      ? 'Estás buscando dentro de la categoría seleccionada. Probá buscar en todo el catálogo.'
                      : 'Probá ajustar tu búsqueda o usar otra palabra clave.'}
                  </p>
                  <ul className="space-y-2 text-slate-700 dark:text-slate-200">
                    {[
                      'Verificá la ortografía',
                      'Usá una sola palabra',
                      'Probá con nombres de categorías',
                      'Escribí sinónimos'
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-600 translate-y-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M9 11l3 3l8 -8" />
                            <path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" />
                          </svg>
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {category && (
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Buscando en: <strong>{categories.find(c => c.id === category)?.name || 'Categoría seleccionada'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCategory(null); setPage(1); }}
                    className="px-4 py-2 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    Buscar en todo el catálogo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {(hasNext || hasPrev) && (
        <div className="flex justify-center items-center gap-4">
          <button
            className="px-4 py-2 border rounded disabled:opacity-50"
            disabled={!hasPrev}
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </button>
          <span className="text-sm">Página {page}</span>
          <button
            className="px-4 py-2 border rounded disabled:opacity-50"
            disabled={!hasNext}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-40 h-12 w-12 rounded-full bg-orange-600 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          aria-label="Volver arriba"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
            <path d="M12 5l-7 7" />
            <path d="M12 5l7 7" />
            <path d="M12 5v14" />
          </svg>
        </button>
      )}

      {thankYouOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setThankYouOpen(false)}
            aria-label="Cerrar"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-orange-600/40 bg-white dark:bg-[#020617] shadow-xl p-6">
              <h3 className="text-2xl font-extrabold text-orange-600 mb-2">Gracias por tu compra</h3>
              <p className="text-slate-700 dark:text-slate-200">
                En breve nos pondremos en contacto para coordinar el envio.
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setThankYouOpen(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Volver al inicio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
