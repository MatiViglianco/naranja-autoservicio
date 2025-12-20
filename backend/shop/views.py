from rest_framework import viewsets, mixins, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django.db import models
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle
from django.core.cache import cache
from django.utils import timezone

from .models import (
    Category,
    Product,
    SiteConfig,
    Order,
    Coupon,
    Announcement,
    SITE_CONFIG_CACHE_KEY,
    SITE_CONFIG_CACHE_TIMEOUT,
)
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    SiteConfigSerializer,
    OrderSerializer,
    AnnouncementSerializer,
)


class CategoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]


class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'


class ProductViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Product.objects.filter(is_active=True).annotate(
        has_offer=models.Case(
            models.When(offer_price__isnull=False, then=models.Value(0)),
            default=models.Value(1),
            output_field=models.IntegerField(),
        )
    ).select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'promoted']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'price', 'offer_price', 'created_at', 'has_offer', 'stock']
    ordering = ('-stock', 'has_offer', 'offer_price')
    pagination_class = ProductPagination


class SiteConfigViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    def list(self, request):
        data = cache.get(SITE_CONFIG_CACHE_KEY)
        if data is None:
            cfg = SiteConfig.objects.first()
            if cfg:
                data = SiteConfigSerializer(cfg).data
            else:
                data = {
                    'whatsapp_phone': '',
                    'alias_or_cbu': '',
                    'shipping_cost': '0.00',
                    'updated_at': None,
                }
            cache.set(SITE_CONFIG_CACHE_KEY, data, SITE_CONFIG_CACHE_TIMEOUT)
        return Response(data)


class OrderViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'orders'


class CouponValidateView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'coupon_validate'
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip()[:40]
        if not code:
            return Response({'detail': 'Código requerido'}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        c = (
            Coupon.objects.filter(code__iexact=code, active=True)
            .filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now),
                models.Q(usage_limit__isnull=True) | models.Q(used_count__lt=models.F('usage_limit')),
            )
            .first()
        )
        if not c:
            return Response({'valid': False}, status=status.HTTP_200_OK)
        now = timezone.now()
        if (
            (c.expires_at and c.expires_at < now)
            or (c.usage_limit is not None and c.used_count >= c.usage_limit)
        ):
            return Response({'valid': False}, status=status.HTTP_200_OK)

        data = {
            'valid': True,
            'type': c.type,
            'amount': c.amount,
            'percent': c.percent,
            'percent_cap': c.percent_cap,
            'min_subtotal': c.min_subtotal,
        }
        return Response(data)


class AnnouncementViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AnnouncementSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = []

    def get_queryset(self):
        from django.utils import timezone
        now = timezone.now()
        qs = Announcement.objects.filter(active=True)
        # Ventana de tiempo opcional: si start/end están definidos, respetarlos
        qs = qs.filter(models.Q(start_at__isnull=True) | models.Q(start_at__lte=now))
        qs = qs.filter(models.Q(end_at__isnull=True) | models.Q(end_at__gte=now))
        return qs
