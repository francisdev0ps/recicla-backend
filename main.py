import hashlib
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Deviathon Backend",
    description="API para clasificación de residuos y monitoreo de contenedores",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UMBRAL_LLENADO = 80

CONTENEDORES: dict[str, float] = {
    "Reciclable": 0.0,
    "No Reciclable": 0.0,
}

CATALOGO_RESIDUOS: list[dict[str, str]] = [
    {
        "tipo_residuo": "Botella PET",
        "categoria": "Reciclable",
        "instruccion": "Depositar en el contenedor Reciclable. Retirar tapa y vaciar líquidos.",
    },
    {
        "tipo_residuo": "Lata de aluminio",
        "categoria": "Reciclable",
        "instruccion": "Depositar en el contenedor Reciclable. Aplastar ligeramente si es posible.",
    },
    {
        "tipo_residuo": "Caja de cartón",
        "categoria": "Reciclable",
        "instruccion": "Depositar en el contenedor Reciclable. Doblar para reducir volumen.",
    },
    {
        "tipo_residuo": "Restos orgánicos",
        "categoria": "No Reciclable",
        "instruccion": "Depositar en el contenedor No Reciclable. No mezclar con materiales reciclables.",
    },
    {
        "tipo_residuo": "Pañuelo o servilleta usada",
        "categoria": "No Reciclable",
        "instruccion": "Depositar en el contenedor No Reciclable. Material contaminado, no reciclable.",
    },
    {
        "tipo_residuo": "Vaso plástico sucio",
        "categoria": "No Reciclable",
        "instruccion": "Depositar en el contenedor No Reciclable. El plástico contaminado no se recicla.",
    },
    {
        "tipo_residuo": "Papel de diario",
        "categoria": "Reciclable",
        "instruccion": "Depositar en el contenedor Reciclable. Mantener seco y sin manchas de grasa.",
    },
    {
        "tipo_residuo": "Envoltorio mixto",
        "categoria": "No Reciclable",
        "instruccion": "Depositar en el contenedor No Reciclable. Material compuesto no separable.",
    },
]

ContenedorId = Literal["Reciclable", "No Reciclable"]


class ClasificacionResponse(BaseModel):
    tipo_residuo: str
    categoria: ContenedorId
    instruccion: str
    contenedor_destino: ContenedorId
    confianza: float = Field(..., ge=0, le=100)
    simulado: bool = True
    nombre_archivo: str
    tamano_bytes: int


class ContenedorActualizarRequest(BaseModel):
    id: ContenedorId = Field(..., description="Identificador del tacho")
    porcentaje: float = Field(..., ge=0, le=100, description="Porcentaje de llenado (0-100)")


class ContenedorActualizarResponse(BaseModel):
    id: ContenedorId
    porcentaje: float
    alerta: bool
    mensaje: str


class ContenedorEstado(BaseModel):
    id: ContenedorId
    porcentaje: float
    alerta: bool


class ContenedoresEstadoResponse(BaseModel):
    contenedores: list[ContenedorEstado]


def _simular_clasificacion(contenido: bytes, nombre_archivo: str) -> dict[str, str | float]:
    digest = hashlib.sha256(contenido or nombre_archivo.encode()).hexdigest()
    indice = int(digest[:8], 16) % len(CATALOGO_RESIDUOS)
    resultado = CATALOGO_RESIDUOS[indice].copy()

    confianza_base = 72 + (int(digest[8:12], 16) % 27)
    resultado["confianza"] = float(confianza_base)
    return resultado


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "servicio": "deviathon-backend"}


@app.get("/contenedores", response_model=ContenedoresEstadoResponse)
def obtener_contenedores() -> ContenedoresEstadoResponse:
    return ContenedoresEstadoResponse(
        contenedores=[
            ContenedorEstado(
                id=contenedor_id,
                porcentaje=porcentaje,
                alerta=porcentaje > UMBRAL_LLENADO,
            )
            for contenedor_id, porcentaje in CONTENEDORES.items()
        ]
    )


@app.post("/clasificar", response_model=ClasificacionResponse)
async def clasificar_imagen(imagen: UploadFile = File(...)) -> ClasificacionResponse:
    contenido = await imagen.read()
    tamano = len(contenido)
    nombre = imagen.filename or "sin_nombre"

    simulacion = _simular_clasificacion(contenido, nombre)
    categoria = simulacion["categoria"]

    print(
        f"[CLASIFICACIÓN] {nombre} ({tamano} bytes) → "
        f"{simulacion['tipo_residuo']} [{categoria}] "
        f"(confianza {simulacion['confianza']:.1f}%)"
    )

    return ClasificacionResponse(
        tipo_residuo=str(simulacion["tipo_residuo"]),
        categoria=categoria,
        instruccion=str(simulacion["instruccion"]),
        contenedor_destino=categoria,
        confianza=float(simulacion["confianza"]),
        nombre_archivo=nombre,
        tamano_bytes=tamano,
    )


@app.post("/contenedor/actualizar", response_model=ContenedorActualizarResponse)
def actualizar_contenedor(datos: ContenedorActualizarRequest) -> ContenedorActualizarResponse:
    if datos.id not in CONTENEDORES:
        raise HTTPException(status_code=404, detail=f"Contenedor '{datos.id}' no encontrado.")

    CONTENEDORES[datos.id] = datos.porcentaje
    alerta = datos.porcentaje > UMBRAL_LLENADO

    if alerta:
        print(
            f"[ALERTA] Contenedor '{datos.id}' al {datos.porcentaje:.1f}% — "
            "Notificando al recogedor de basura."
        )
    else:
        print(f"[CONTENEDOR] '{datos.id}' actualizado al {datos.porcentaje:.1f}%.")

    return ContenedorActualizarResponse(
        id=datos.id,
        porcentaje=datos.porcentaje,
        alerta=alerta,
        mensaje=(
            "Alerta enviada al recogedor de basura."
            if alerta
            else "Contenedor actualizado sin alertas."
        ),
    )
