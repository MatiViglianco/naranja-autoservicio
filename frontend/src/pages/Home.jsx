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
    const orderingMap = {
      recent: '-created_at',
      discount: 'has_offer,offer_price',
      price_high: '-price',
      price_low: 'price',
      name_az: 'name',
      name_za: '-name',
    }
    getProducts({
      page,
      search: query,
      category,
      ordering: orderingMap[sort] || '',
      page_size: 20,
    })
      .then((data) => {
        const results = data.results || []
        const inStock = results.filter(p => Number(p.stock ?? 0) > 0)
        const outStock = results.filter(p => Number(p.stock ?? 0) <= 0)
        setProducts([...inStock, ...outStock])
        setHasNext(Boolean(data.next))
        setHasPrev(Boolean(data.previous))
      })
      .catch(() => setError('No se pudo cargar productos'))
      .finally(() => setLoading(false))
  }, [page, query, category, sort])

  useEffect(() => {
    setPage(1)
  }, [query, category, sort])

  // Resetear buscador al venir desde el logo del navbar
  useEffect(() => {
    if (location.state && location.state.resetSearch) {
      setSearch('')
      setQuery('')
      setCategory(null)
      setSort('relevance')
      setOverlayOpen(false)
      setPage(1)
      // limpiar el state para no repetir al navegar dentro del Home
      navigate('.', { replace: true, state: {} })
    }
  }, [location.state])

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
            onSubmit={() => { setQuery(search); setOverlayOpen(false) }}
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
                          onMouseDown={(e) => { e.preventDefault(); setSearch(c.name); setQuery(c.name); setOverlayOpen(false) }}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {products
                    .filter(p => (p.name + ' ' + (p.description || '')).toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 3)
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSearch(p.name); setQuery(p.name); setOverlayOpen(false) }}
                        className="text-left rounded-lg border border-orange-600/40 bg-white dark:bg-[#020617] p-2 hover:shadow-md hover:border-orange-600 transition"
                      >
                        <div className="aspect-[6/5] rounded-md overflow-hidden bg-transparent dark:bg-white mb-2">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain" /> : null}
                        </div>
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className={["text-xs", p.offer_price && Number(p.offer_price) < Number(p.price) ? 'text-red-600 dark:text-red-500' : 'text-slate-500'].join(' ')}>${Number(p.offer_price ?? p.price).toFixed(2)}</div>
                      </button>
                    ))}
                  {products.filter(p => (p.name + ' ' + (p.description || '')).toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <div className="col-span-full text-slate-500">Escribe para ver coincidencias…</div>
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
            <div className="rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-white/70 dark:bg-[#020617]/60 backdrop-blur p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-center">
                <div className="flex justify-center md:justify-start">
                  <img src={`${import.meta.env.BASE_URL}searchNone.png`} alt="Sin resultados" className="w-64 md:w-72 h-auto select-none" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-extrabold text-orange-600 mb-3">
                    No encontramos productos que coincidan con tu búsqueda
                  </h3>
                  <ul className="space-y-2 text-slate-700 dark:text-slate-200">
                    {[
                      'Verificá la ortografía',
                      'Intentá utilizar una sola palabra',
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
    </div>
  )
}
