import React from 'react'
import QuantityStepper from '../ui/QuantityStepper.jsx'
import { ensureHttps } from '../../utils/url.js'

// Estructura de carrito agrupado por categoría.
// Props esperadas:
// - items: [{ product: {id, name, description, image, price, offer_price, category:{id,name}}, quantity }]
// - onInc(productId), onDec(productId), onRemove(productId)
// - onSetQty(productId, quantity)
// - alertMessages?: array de strings para mostrar debajo del listado
export default function CartGrouped({
  items = [],
  onInc = () => {},
  onDec = () => {},
  onRemove = () => {},
  onClear = () => {},
  onSetQty = () => {},
  alertMessages = [],
}) {
  // Agrupar por categoría (name como clave legible; si no hay categoría usa 'Sin categoría')
  const groups = React.useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const cat = it?.product?.category?.name || 'Sin categoría'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(it)
    }
    return Array.from(map.entries()) // [ [catName, items[]], ... ]
  }, [items])

  const formatArs = (v) => Number(v).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

  return (
    <div className="space-y-6">
      {/* Encabezado (desktop) */}


      <div className="hidden min-[1000px]:grid min-[1000px]:grid-cols-[1fr_90px_110px_130px] min-[1200px]:grid-cols-[1fr_110px_140px_160px] text-xs min-[1000px]:text-sm font-semibold text-gray-600 dark:text-gray-300 pl-3 pr-2">
        <div>Producto</div>
        <div className="text-left">Precio</div>
        <div className="text-center">Cantidad</div>
        <div className="text-right">Total</div>

      </div>
      <hr className="hidden min-[1000px]:block my-2 border-gray-200 dark:border-gray-700" />

      {/* Grupos por categoría */}
      {groups.map(([catName, groupItems]) => (
        <section key={catName} className="space-y-2">
          {/* Título de categoría + contador */}
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm min-[1000px]:text-base font-semibold text-gray-800 dark:text-gray-100">{catName}</h4>
            <span className="text-xs min-[1000px]:text-sm text-gray-500 dark:text-gray-400">
              {groupItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0)} ítem(s)
            </span>
          </div>

          {/* Items del grupo */}
          <div className="space-y-2">
            {groupItems.map(({ product, quantity }) => {
              const unit = Number(product.offer_price ?? product.price)
              const lineTotal = unit * quantity
              const hasOffer = product.offer_price && Number(product.offer_price) < Number(product.price)
              const max = Number(product.stock ?? Infinity)
              const percentOff = hasOffer ? Math.round((1 - unit / Number(product.price)) * 100) : 0

              return (
                <article
                  key={product.id}
                  className="relative bg-white dark:bg-[#020617] border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-[1000px]:p-3"
                >

                  {/* Grid: desktop 4 cols; mobile 2x2 */}
                  <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] min-[1000px]:grid-cols-[1fr_90px_110px_130px] min-[1200px]:grid-cols-[1fr_110px_140px_160px] min-[1000px]:grid-rows-1 gap-3 min-[1000px]:gap-3">

                    {/* Columna Producto */}
                    <div className="flex items-start gap-3 min-w-0 col-span-2 min-[1000px]:col-span-1">
                      {product.image && (
                        <img
                          src={ensureHttps(product.image)}
                          alt={product.name}
                          className="w-20 h-20 min-[1000px]:w-16 min-[1000px]:h-16 object-cover rounded"
                        />
                      )}
                      <div className="min-w-0">
                        <div
                          className="font-medium text-lg min-[1000px]:text-base leading-tight line-clamp-2"
                          title={product.name}
                        >
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-base min-[1000px]:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {product.description}
                          </div>
                        )}
                        {hasOffer && (
                          <div className="text-[11px] font-semibold text-red-600 mt-1">
                            {percentOff}% OFF{isFinite(max) ? ` MAX ${max} UNIDADES` : ''}
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Precio unitario desktop */}
                    <div className="hidden min-[1000px]:flex flex-col items-start justify-center">
                      <span className={["font-semibold whitespace-nowrap", hasOffer ? 'text-red-600 dark:text-red-500' : 'text-orange-600'].join(' ')}>{formatArs(unit)}</span>
                      {hasOffer && (
                        <span className="text-xs text-gray-500 line-through whitespace-nowrap">{formatArs(product.price)}</span>
                      )}
                    </div>


                    {/* Cantidad desktop */}
                    <div className="hidden min-[1000px]:flex items-center justify-center">
                      <QuantityStepper
                        value={quantity}
                        min={1}
                        max={max}
                        onDecrement={() => quantity > 1 && onDec(product.id)}
                        onIncrement={() => quantity < max && onInc(product.id)}
                        onSet={(v) => onSetQty(product.id, v)}
                        className="h-10 w-12 min-[1000px]:w-14 min-[1200px]:w-16 min-[1400px]:w-20"
                      />
                    </div>

                    {/* Total + eliminar desktop */}

                    <div className="hidden min-[1000px]:flex items-center justify-end pr-2 gap-2">
                      <span className={["font-semibold whitespace-nowrap", hasOffer ? 'text-red-600 dark:text-red-500' : 'text-orange-600'].join(' ')}>{formatArs(lineTotal)}</span>
                      <button
                        onClick={() => onRemove(product.id)}
                        className="text-orange-600 hover:text-orange-700"
                        aria-label="Eliminar producto"
                        title="Eliminar producto"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-6 h-6"
                        >
                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                          <path d="M4 7l16 0" />
                          <path d="M10 11l0 6" />
                          <path d="M14 11l0 6" />
                          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                          <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                      </button>
                    </div>

                    {/* Cantidad mobile */}
                    <QuantityStepper
                      value={quantity}
                      min={1}
                      max={max}
                      onDecrement={() => quantity > 1 && onDec(product.id)}
                      onIncrement={() => quantity < max && onInc(product.id)}
                      onSet={(v) => onSetQty(product.id, v)}
                      className="min-[1000px]:hidden row-start-2 col-start-1 h-10 !w-5/12 justify-self-start ml-4 sm:ml-8 lg:ml-12 scale-y-110"
                    />

                    {/* Total mobile */}
                    <div className="min-[1000px]:hidden row-start-2 col-start-2 flex items-center justify-end">
                      <span className={["font-semibold whitespace-nowrap text-lg", hasOffer ? 'text-red-600 dark:text-red-500' : 'text-orange-600'].join(' ')}>{formatArs(lineTotal)}</span>
                    </div>


                    {isFinite(max) && quantity >= max && (
                      <div className="col-span-full mt-2 rounded-md border border-red-300 dark:border-red-500 bg-white dark:bg-[#020617] text-red-700 dark:text-red-300 px-3 py-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                          <path d="M12 1.67c.955 0 1.845 .467 2.39 1.247l.105 .16l8.114 13.548a2.914 2.914 0 0 1 -2.307 4.363l-.195 .008h-16.225a2.914 2.914 0 0 1 -2.582 -4.2l.099 -.185l8.11 -13.538a2.914 2.914 0 0 1 2.491 -1.403zm.01 13.33l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007zm-.01 -7a1 1 0 0 0 -.993 .883l-.007 .117v4l.007 .117a1 1 0 0 0 1.986 0l.007 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z" />
                        </svg>
                        <span className="text-xs min-[1000px]:text-sm font-semibold uppercase">CANTIDAD MÁXIMA PERMITIDA</span>
                      </div>
                    )}
                  </div>
                  {/* Botón eliminar mobile */}
                  <button
                    onClick={() => onRemove(product.id)}

                    className="min-[1000px]:hidden absolute top-2 right-2 text-orange-600 hover:text-orange-700"
                  aria-label="Eliminar producto"
                  title="Eliminar producto"
                  >

                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">

                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M4 7l16 0" />
                      <path d="M10 11l0 6" />
                      <path d="M14 11l0 6" />
                      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                    </svg>
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {/* Mensajes de alerta debajo del listado */}
      {alertMessages.length > 0 && (
        <div className="space-y-1">
          {alertMessages.map((m, idx) => (
            <div key={idx} className="text-xs min-[1000px]:text-sm text-red-600">{m}</div>
          ))}
        </div>
      )}

      {/* Acción final */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onClear}
          className="text-orange-600 hover:text-orange-700 font-semibold uppercase text-sm flex items-center gap-2"
        >
          <span>Vaciar el carrito</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7"

          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4 7l16 0" />
            <path d="M10 11l0 6" />
            <path d="M14 11l0 6" />
            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
            <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
