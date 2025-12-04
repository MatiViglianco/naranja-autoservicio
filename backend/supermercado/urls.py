from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('shop.urls')),
]

# Serve media files (small setup; for heavy traffic use a dedicated server/CDN)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
