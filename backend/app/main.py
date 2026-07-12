from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers.auth import router as auth_router
from .routers.dashboard import router as dashboard_router
from .routers.assets import router as assets_router
from .routers.bookings import router as bookings_router
from .routers.maintenance import router as maintenance_router
from .routers.departments import router as departments_router
from .routers.categories import router as categories_router
from .routers.employees import router as employees_router
from .routers.allocations import router as allocations_router
from .routers.transfers import router as transfers_router
from .routers.audits import router as audits_router
from .routers.reports import router as reports_router
from .routers.notifications import router as notifications_router
from .routers.activity_logs import router as activity_logs_router
from .middleware.activity import ActivityLogMiddleware

app = FastAPI(title="AssetFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(assets_router)
app.include_router(bookings_router)
app.include_router(maintenance_router)
app.include_router(departments_router)
app.include_router(categories_router)
app.include_router(employees_router)
app.include_router(allocations_router)
app.include_router(transfers_router)
app.include_router(audits_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(activity_logs_router)

app.add_middleware(ActivityLogMiddleware)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "AssetFlow API"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
