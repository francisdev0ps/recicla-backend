import { useCallback, useEffect, useState } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

const CONTENEDORES = [
  {
    codigo: 'TACHO-001',
    id: 'Reciclable',
    label: 'Reciclable',
    color: 'bg-emerald-500',
    trackLight: 'bg-emerald-100',
    trackDark: 'bg-emerald-950/60',
    ringLight: 'ring-emerald-200/70',
    ringDark: 'ring-emerald-500/30',
  },
  {
    codigo: 'TACHO-002',
    id: 'No Reciclable',
    label: 'No Reciclable',
    color: 'bg-amber-500',
    trackLight: 'bg-amber-100',
    trackDark: 'bg-amber-950/60',
    ringLight: 'ring-amber-200/70',
    ringDark: 'ring-amber-500/30',
  },
]

const UMBRAL_ALERTA = 80
const GRADIENT_GEMINI = 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
const GRADIENT_GEMINI_TEXT = 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent'

async function crearImagenSimulada() {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 480
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, 480)
  gradient.addColorStop(0, '#dbeafe')
  gradient.addColorStop(1, '#fdf2f8')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 320, 480)

  ctx.fillStyle = '#22c55e'
  ctx.fillRect(110, 80, 100, 220)
  ctx.fillStyle = '#16a34a'
  ctx.fillRect(110, 80, 100, 40)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(125, 130, 18, 120)

  ctx.fillStyle = '#312e81'
  ctx.font = 'bold 20px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('Botella PET', 160, 360)
  ctx.font = '14px system-ui'
  ctx.fillStyle = '#6b21a8'
  ctx.fillText('Captura simulada', 160, 390)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], 'botella-pet-simulada.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  })
}

function formatearHora(fecha = new Date()) {
  return fecha.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function App() {
  const [modoOscuro, setModoOscuro] = useState(false)
  const [tab, setTab] = useState('clasificar')
  const [clasificando, setClasificando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errorClasificacion, setErrorClasificacion] = useState('')
  const [niveles, setNiveles] = useState({ Reciclable: 0, 'No Reciclable': 0 })
  const [cargandoContenedores, setCargandoContenedores] = useState({})
  const [errorContenedores, setErrorContenedores] = useState('')
  const [alertaEmpresa, setAlertaEmpresa] = useState(null)
  const [historialDespachos, setHistorialDespachos] = useState([])

  const cargarContenedores = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/contenedores`)
      if (!response.ok) throw new Error('No se pudo obtener el estado de los tachos.')
      const data = await response.json()
      const mapa = {}
      data.contenedores.forEach((item) => {
        mapa[item.id] = item.porcentaje
      })
      setNiveles(mapa)
      setErrorContenedores('')
    } catch (error) {
      setErrorContenedores(error.message || 'Error de conexión con el backend.')
    }
  }, [])

  useEffect(() => {
    cargarContenedores()
  }, [cargarContenedores])

  function notificarEmpresa(contenedorId, porcentaje) {
    const contenedor = CONTENEDORES.find((item) => item.id === contenedorId)
    if (!contenedor || porcentaje <= UMBRAL_ALERTA) return

    const reporte = {
      codigo: contenedor.codigo,
      porcentaje,
      hora: formatearHora(),
    }

    setAlertaEmpresa(reporte)
    setHistorialDespachos((prev) => [reporte, ...prev])
  }

  async function simularCaptura() {
    setClasificando(true)
    setErrorClasificacion('')
    setResultado(null)

    try {
      const imagen = await crearImagenSimulada()
      const formData = new FormData()
      formData.append('imagen', imagen)

      const response = await fetch(`${API_BASE}/clasificar`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('No se pudo clasificar la imagen simulada.')

      const data = await response.json()
      setResultado(data)
    } catch (error) {
      setErrorClasificacion(error.message || 'Error de conexión con el backend.')
    } finally {
      setClasificando(false)
    }
  }

  async function simularDeposito(contenedorId) {
    setCargandoContenedores((prev) => ({ ...prev, [contenedorId]: true }))
    setErrorContenedores('')

    try {
      const porcentajeActual = niveles[contenedorId] ?? 0
      const nuevoPorcentaje = Math.min(100, porcentajeActual + 20)

      const response = await fetch(`${API_BASE}/contenedor/actualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contenedorId, porcentaje: nuevoPorcentaje }),
      })

      if (!response.ok) throw new Error(`No se pudo actualizar ${contenedorId}.`)

      const data = await response.json()
      setNiveles((prev) => ({ ...prev, [contenedorId]: data.porcentaje }))
      notificarEmpresa(contenedorId, data.porcentaje)
    } catch (error) {
      setErrorContenedores(error.message || 'Error de conexión con el backend.')
    } finally {
      setCargandoContenedores((prev) => ({ ...prev, [contenedorId]: false }))
    }
  }

  const esReciclable = resultado?.categoria === 'Reciclable'
  const shellClass = modoOscuro
    ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100'
    : 'bg-gradient-to-b from-slate-50 via-white to-blue-50 text-slate-900'
  const cardClass = modoOscuro
    ? 'border-white/10 bg-slate-900/80 shadow-lg shadow-purple-900/10'
    : 'border-slate-200/80 bg-white/90 shadow-sm'
  const mutedText = modoOscuro ? 'text-slate-400' : 'text-slate-500'
  const subText = modoOscuro ? 'text-slate-300' : 'text-slate-600'

  return (
    <div className={`relative mx-auto flex min-h-dvh w-full max-w-md flex-col pb-24 ${shellClass}`}>
      {alertaEmpresa && (
        <div className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div
            className={`mx-auto max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-md ${
              modoOscuro
                ? 'border-emerald-400/30 bg-slate-900/95 shadow-emerald-500/20'
                : 'border-emerald-200 bg-white/95 shadow-emerald-500/20'
            }`}
          >
            <p className="text-sm font-semibold leading-relaxed text-emerald-600 dark:text-emerald-400">
              🟢 [CONEXIÓN EMPRESA] Reporte enviado automáticamente. Unidad de ruta asignada
              para contenedor {alertaEmpresa.codigo} (Llenado: {alertaEmpresa.porcentaje.toFixed(0)}%).
            </p>
            <button
              type="button"
              onClick={() => setAlertaEmpresa(null)}
              className={`mt-3 text-xs font-semibold ${modoOscuro ? 'text-purple-300' : 'text-purple-600'}`}
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      )}

      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          modoOscuro ? 'border-white/10 bg-slate-950/80' : 'border-slate-200/80 bg-white/80'
        } ${alertaEmpresa ? 'mt-28' : ''}`}
      >
        <div className={`${GRADIENT_GEMINI} px-4 py-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                Deviathon
              </p>
              <h1 className="text-2xl font-bold text-white">Recicla App</h1>
              <p className="mt-1 text-sm text-white/85">
                Clasificación inteligente y despacho automático
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoOscuro((prev) => !prev)}
              aria-label={modoOscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
              className="rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-lg backdrop-blur transition hover:bg-white/25"
            >
              {modoOscuro ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        {tab === 'clasificar' && (
          <section className="space-y-5">
            <div className={`overflow-hidden rounded-3xl border ${cardClass}`}>
              <div
                className={`relative aspect-[3/4] ${
                  modoOscuro
                    ? 'bg-gradient-to-br from-slate-900 via-purple-950/40 to-blue-950/40'
                    : 'bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50'
                }`}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className={`flex h-40 w-24 flex-col items-center justify-end rounded-t-3xl rounded-b-xl shadow-lg ${GRADIENT_GEMINI}`}>
                    <div className="mb-2 h-8 w-full rounded-t-3xl bg-white/20" />
                    <div className="mb-8 h-16 w-3 rounded-full bg-white/40" />
                  </div>
                  <p className={`text-sm font-medium ${modoOscuro ? 'text-white' : 'text-slate-800'}`}>
                    Vista previa simulada
                  </p>
                  <p className={`text-xs ${mutedText}`}>Botella PET de ejemplo</p>
                </div>
                <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/55 px-4 py-2 text-center text-xs text-white">
                  Cámara simulada lista para capturar
                </div>
              </div>

              <div className="p-4">
                <button
                  type="button"
                  onClick={simularCaptura}
                  disabled={clasificando}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${GRADIENT_GEMINI} shadow-purple-500/30`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl">
                    {clasificando ? '…' : '📷'}
                  </span>
                  {clasificando ? 'Clasificando…' : 'Simular captura y clasificar'}
                </button>
              </div>
            </div>

            {errorClasificacion && (
              <div className="rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {errorClasificacion}
              </div>
            )}

            {resultado && (
              <article
                className={`rounded-3xl border p-5 ${cardClass} ${
                  esReciclable
                    ? modoOscuro
                      ? 'ring-1 ring-emerald-500/30'
                      : 'ring-1 ring-emerald-200'
                    : modoOscuro
                      ? 'ring-1 ring-amber-500/30'
                      : 'ring-1 ring-amber-200'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>
                      Resultado
                    </p>
                    <h2 className={`mt-1 text-xl font-bold ${modoOscuro ? 'text-white' : 'text-slate-900'}`}>
                      {resultado.tipo_residuo}
                    </h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${GRADIENT_GEMINI}`}>
                    {resultado.categoria}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className={`rounded-2xl p-3 ${modoOscuro ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <p className={`font-semibold ${GRADIENT_GEMINI_TEXT}`}>Instrucción</p>
                    <p className={`mt-1 ${subText}`}>{resultado.instruccion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-2xl p-3 ${modoOscuro ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mutedText}`}>Destino</p>
                      <p className={`mt-1 font-semibold ${modoOscuro ? 'text-white' : 'text-slate-900'}`}>
                        {resultado.contenedor_destino}
                      </p>
                    </div>
                    <div className={`rounded-2xl p-3 ${modoOscuro ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mutedText}`}>Confianza</p>
                      <p className={`mt-1 font-semibold ${modoOscuro ? 'text-white' : 'text-slate-900'}`}>
                        {resultado.confianza.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </section>
        )}

        {tab === 'monitor' && (
          <section className="space-y-4">
            <div className={`rounded-2xl border p-4 ${cardClass}`}>
              <h2 className={`text-lg font-bold ${GRADIENT_GEMINI_TEXT}`}>Monitor de tachos</h2>
              <p className={`mt-1 text-sm ${subText}`}>
                Simula depósitos de +20% y observa las alertas visuales y despachos automáticos.
              </p>
              <button
                type="button"
                onClick={cargarContenedores}
                className={`mt-3 text-sm font-semibold ${modoOscuro ? 'text-pink-300' : 'text-purple-600'}`}
              >
                Actualizar estado
              </button>
            </div>

            {errorContenedores && (
              <div className="rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {errorContenedores}
              </div>
            )}

            {CONTENEDORES.map((contenedor) => {
              const porcentaje = niveles[contenedor.id] ?? 0
              const enAlerta = porcentaje > UMBRAL_ALERTA
              const cargando = cargandoContenedores[contenedor.id]

              return (
                <article
                  key={contenedor.id}
                  className={`rounded-3xl border p-4 ring-1 ${cardClass} ${
                    modoOscuro ? contenedor.ringDark : contenedor.ringLight
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>
                        {contenedor.codigo}
                      </p>
                      <h3 className={`text-lg font-bold ${modoOscuro ? 'text-white' : 'text-slate-900'}`}>
                        {contenedor.label}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        enAlerta
                          ? 'bg-red-600 text-white'
                          : `${GRADIENT_GEMINI} text-white`
                      }`}
                    >
                      {porcentaje.toFixed(0)}%
                    </span>
                  </div>

                  <div
                    className={`h-4 overflow-hidden rounded-full ${
                      modoOscuro ? contenedor.trackDark : contenedor.trackLight
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        enAlerta ? 'animate-[blink-red_1s_ease-in-out_infinite]' : contenedor.color
                      }`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>

                  {enAlerta && (
                    <p className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500">
                      Alerta activa: backend y empresa recolectora notificados.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => simularDeposito(contenedor.id)}
                    disabled={cargando || porcentaje >= 100}
                    className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${GRADIENT_GEMINI}`}
                  >
                    {cargando ? 'Enviando…' : 'Simular depósito (+20%)'}
                  </button>
                </article>
              )
            })}

            <section className={`rounded-2xl border p-4 ${cardClass}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className={`text-base font-bold ${GRADIENT_GEMINI_TEXT}`}>Reportes Enviados</h3>
                <span className={`text-xs ${mutedText}`}>{historialDespachos.length} total</span>
              </div>

              {historialDespachos.length === 0 ? (
                <p className={`rounded-xl px-3 py-4 text-sm ${modoOscuro ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  Aún no hay despachos automáticos. Supera el 80% en un tacho para generar uno.
                </p>
              ) : (
                <ul className="space-y-2">
                  {historialDespachos.map((reporte, index) => (
                    <li
                      key={`${reporte.codigo}-${reporte.hora}-${index}`}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 ${
                        modoOscuro ? 'bg-white/5' : 'bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${modoOscuro ? 'text-white' : 'text-slate-900'}`}>
                          {reporte.codigo}
                        </p>
                        <p className={`text-xs ${mutedText}`}>
                          Despacho automático · {reporte.porcentaje.toFixed(0)}% de llenado
                        </p>
                      </div>
                      <span className={`text-xs font-mono ${modoOscuro ? 'text-pink-300' : 'text-purple-600'}`}>
                        {reporte.hora}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        )}
      </main>

      <nav
        className={`fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-md ${
          modoOscuro ? 'border-white/10 bg-slate-950/90' : 'border-slate-200/80 bg-white/90'
        }`}
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setTab('clasificar')}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
              tab === 'clasificar'
                ? `${GRADIENT_GEMINI} text-white shadow-md shadow-purple-500/30`
                : modoOscuro
                  ? 'bg-white/5 text-slate-300'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            Clasificación
          </button>
          <button
            type="button"
            onClick={() => setTab('monitor')}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
              tab === 'monitor'
                ? `${GRADIENT_GEMINI} text-white shadow-md shadow-purple-500/30`
                : modoOscuro
                  ? 'bg-white/5 text-slate-300'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            Monitor
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App
