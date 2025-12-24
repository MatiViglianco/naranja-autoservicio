from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    ProductViewSet,
    SiteConfigViewSet,
    OrderViewSet,
    CouponValidateView,
    AnnouncementViewSet,
    sales_stats,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'config', SiteConfigViewSet, basename='config')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')

urlpatterns = [
    path('', include(router.urls)),
    path('coupons/validate/', CouponValidateView.as_view(), name='coupon-validate'),
    path('stats/sales/', sales_stats, name='sales-stats'),
]
