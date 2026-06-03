from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from api.api import api


def healthz(request):
    """Liveness probe for the platform health check (no DB access)."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthz),
    path('admin/', admin.site.urls),
    path("api/", api.urls),
    path("_allauth/", include("allauth.headless.urls")),
]
