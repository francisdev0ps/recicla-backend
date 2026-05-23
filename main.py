from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel, Field

app = FastAPI(
    title="Deviathon Backend",
    description="API para clasificación de residuos y monitoreo de contenedores",
    version="1.0.0",
)

UMBRAL_LLENADO = 80


class ClasificacionResponse(BaseModel):
    mensaje: str
    nombre_archivo: str
    tipo_contenido: str | None
    tamano_bytes: int


class ContenedorActualizarRequest(BaseModel):
    id: str = Field(..., description="Identificador del tacho")
    porcentaje: float = Field(..., ge=0, le=100, description="Porcentaje de llenado (0-100)")


class ContenedorActualizarResponse(BaseModel):
    id: str
    porcentaje: float
    alerta: bool
    mensaje: str


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "servicio": "deviathon-backend"}


@app.post("/clasificar", response_model=ClasificacionResponse)
async def clasificar_imagen(imagen: UploadFile = File(...)) -> ClasificacionResponse:
    contenido = await imagen.read()
    tamano = len(contenido)

    print(
        f"[CLASIFICACIÓN] Imagen recibida: {imagen.filename} "
        f"({imagen.content_type or 'tipo desconocido'}, {tamano} bytes)"
    )

    return ClasificacionResponse(
        mensaje="Imagen recibida correctamente. Clasificación simulada.",
        nombre_archivo=imagen.filename or "sin_nombre",
        tipo_contenido=imagen.content_type,
        tamano_bytes=tamano,
    )


@app.post("/contenedor/actualizar", response_model=ContenedorActualizarResponse)
def actualizar_contenedor(datos: ContenedorActualizarRequest) -> ContenedorActualizarResponse:
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
