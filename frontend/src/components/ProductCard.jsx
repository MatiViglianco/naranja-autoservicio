import { useCart } from '../store/cart.jsx'
import { motion } from 'framer-motion'
import { useRef } from 'react'
import CardSpotlight from './ui/CardSpotlight.jsx'
import ButtonAnimatedGradient from './ui/ButtonAnimatedGradient.jsx'
import QuantityStepper from './ui/QuantityStepper.jsx'

export default function ProductCard({ product }) {
  const { add, items, remove, setQty } = useCart()
  const out = Number(product.stock ?? 0) <= 0
  const item = items?.find?.(it => it.product.id === product.id)
  const qty = item?.quantity ?? 0
  const inCart = qty > 0
  const inputRef = useRef(null)

  const updateQty = (newQty) => {
    if ((newQty ?? 0) <= 0) {
      inputRef.current?.blur?.()
      remove(product.id)
    } else {
      setQty(product.id, newQty)
    }
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <CardSpotlight
        className={[
          'p-4 flex flex-col h-full transition-colors',
          // En carrito: mismo tono del botón, sin opacidad
          inCart ? 'border-transparent hover:border-transparent dark:border-transparent dark:hover:border-transparent ring-1 ring-inset ring-orange-600 ring-opacity-100' : ''
        ].join(' ')}
      >
      <div className="w-full aspect-[6/5] rounded-xl mb-3 overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-300 select-none">
            Sin imagen
          </div>
        )}
      </div>
      <div className="font-semibold min-h-[1.5rem] truncate" title={product.name}>{product.name}</div>
      <div className="text-sm text-gray-500 min-h-[3rem] line-clamp-2">{product.description}</div>
      <div className="mt-2 min-h-[3rem]">
        {product.offer_price && Number(product.offer_price) < Number(product.price) ? (
          <div>
            <div className="text-sm line-through text-slate-400">${Number(product.price).toFixed(2)}</div>
            <div className="font-bold text-lg text-red-600 dark:text-red-500">${Number(product.offer_price).toFixed(2)}</div>
          </div>
        ) : (
          <div className="font-bold text-lg text-orange-500">${Number(product.price).toFixed(2)}</div>
        )}
      </div>
        <div className="mt-auto">
          {out ? (
            <ButtonAnimatedGradient className="w-3/5 mx-auto h-12 justify-center disabled:opacity-50 whitespace-nowrap text-sm" disabled>
              Sin stock
            </ButtonAnimatedGradient>
          ) : inCart ? (
            <div className="w-full flex justify-center">
              <QuantityStepper
                ref={inputRef}
                value={qty}
                onDecrement={() => updateQty(qty - 1)}
                onIncrement={() => add(product, 1)}
                onSet={updateQty}
                className="w-3/5 mx-auto h-12"
              />
            </div>
          ) : (
            <ButtonAnimatedGradient onClick={() => add(product, 1)} className="w-3/5 mx-auto h-12 justify-center">
              {/* Icono carrito (stroke usa currentColor => blanco) */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                <path d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                <path d="M17 17h-11v-14h-2" />
                <path d="M6 5l14 1l-1 7h-13" />
              </svg>
            </ButtonAnimatedGradient>
          )}
        </div>
      </CardSpotlight>
    </motion.div>
  )
}
