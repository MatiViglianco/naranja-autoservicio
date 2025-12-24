import logging
import unicodedata

from django.core.cache import cache
from django.db import models
from django.db.models import Value
from django.db.models.functions import Coalesce, Lower, Replace
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Category,
    Product,
    SiteConfig,
    Order,
    OrderItem,
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


logger = logging.getLogger(__name__)


class CategoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]


class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'


class StockAwareOrderingFilter(OrderingFilter):
    """Always keep in-stock items first, preserving requested ordering afterward."""

    STOCK_FIELD = 'in_stock'

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view)
        base = ordering or getattr(view, 'ordering', None)
        if not base:
            return [f'-{self.STOCK_FIELD}']

        cleaned = [
            term
            for term in base
            if term and term.lstrip('-') not in {self.STOCK_FIELD, 'stock'}
        ]
        return [f'-{self.STOCK_FIELD}', *cleaned]


class ProductViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    ACCENT_REPLACEMENTS = (
        ('\u00e1', 'a'), ('\u00e0', 'a'), ('\u00e4', 'a'), ('\u00e2', 'a'), ('\u00e3', 'a'),
        ('\u00e9', 'e'), ('\u00e8', 'e'), ('\u00eb', 'e'), ('\u00ea', 'e'),
        ('\u00ed', 'i'), ('\u00ec', 'i'), ('\u00ef', 'i'), ('\u00ee', 'i'),
        ('\u00f3', 'o'), ('\u00f2', 'o'), ('\u00f6', 'o'), ('\u00f4', 'o'), ('\u00f5', 'o'),
        ('\u00fa', 'u'), ('\u00f9', 'u'), ('\u00fc', 'u'), ('\u00fb', 'u'),
        ('\u00f1', 'n'),
    )
    queryset = Product.objects.filter(is_active=True).annotate(
        has_offer=models.Case(
            models.When(offer_price__isnull=False, then=models.Value(0)),
            default=models.Value(1),
            output_field=models.IntegerField(),
        ),
        in_stock=models.Case(
            models.When(stock__gt=0, then=models.Value(1)),
            default=models.Value(0),
            output_field=models.IntegerField(),
        ),
    ).select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, StockAwareOrderingFilter]
    filterset_fields = ['category', 'promoted']
    ordering_fields = ['name', 'price', 'offer_price', 'created_at', 'has_offer', 'relevance', 'in_stock']
    ordering = ('-in_stock', 'has_offer', 'offer_price')
    pagination_class = ProductPagination

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except NotFound:
            # When the requested page is out of range, return an empty result set instead of a 404
            empty = {'count': 0, 'next': None, 'previous': None, 'results': []}
            return Response(empty, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception("Product list error", exc_info=exc)
            empty = {'count': 0, 'next': None, 'previous': None, 'results': []}
            return Response(empty, status=status.HTTP_200_OK)

    def _normalized_field(self, field_name: str):
        """Lowercase field with common accent replacements for accent-tolerant search."""

        base = Coalesce(
            models.F(field_name),
            Value(''),
            output_field=models.TextField(),
        )
        expr = Lower(base, output_field=models.TextField())
        for accented, plain in self.ACCENT_REPLACEMENTS:
            expr = Replace(
                expr,
                Value(accented),
                Value(plain),
                output_field=models.TextField(),
            )
        return expr

    def get_queryset(self):
        from django.db import connection

        qs = self.queryset.annotate(
            relevance=models.Value(0.0, output_field=models.FloatField())
        )

        search_term = self.request.query_params.get('search', '').strip()
        normalized_term = unicodedata.normalize('NFKD', search_term).encode('ascii', 'ignore').decode('ascii')
        normalized_term_lower = normalized_term.lower()
        self.ordering = ('-in_stock', 'has_offer', 'offer_price')

        if search_term:
            try:
                qs = qs.annotate(
                    name_fold=self._normalized_field('name'),
                    description_fold=self._normalized_field('description'),
                )

                base_filter = (
                    models.Q(name__icontains=search_term)
                    | models.Q(description__icontains=search_term)
                )
                combined_filter = base_filter | (
                    models.Q(name_fold__icontains=normalized_term_lower)
                    | models.Q(description_fold__icontains=normalized_term_lower)
                )

                if connection.vendor == 'postgresql':
                    try:
                        from django.contrib.postgres.search import TrigramSimilarity, Unaccent

                        has_unaccent = False
                        has_trigram = False
                        try:
                            with connection.cursor() as cursor:
                                cursor.execute("select extname from pg_extension where extname='unaccent'")
                                has_unaccent = cursor.fetchone() is not None
                                cursor.execute("select extname from pg_extension where extname='pg_trgm'")
                                has_trigram = cursor.fetchone() is not None
                        except Exception:
                            # If we cannot check extensions, fall back to safe filters only.
                            has_unaccent = False
                            has_trigram = False

                        if has_unaccent:
                            qs = qs.annotate(
                                name_unaccent=Unaccent(Lower('name')),
                                description_unaccent=Unaccent(Lower('description')),
                            )
                            combined_filter |= (
                                models.Q(name_unaccent__icontains=normalized_term)
                                | models.Q(description_unaccent__icontains=normalized_term)
                            )

                        if has_trigram:
                            # Use the best available field for similarity (unaccented when possible)
                            name_source = models.F('name_unaccent') if has_unaccent else Lower('name')
                            desc_source = models.F('description_unaccent') if has_unaccent else Lower('description')

                            qs = qs.annotate(
                                name_similarity=TrigramSimilarity(name_source, normalized_term.lower()),
                                description_similarity=TrigramSimilarity(desc_source, normalized_term.lower()),
                            )
                            combined_filter |= (
                                models.Q(name_similarity__gt=0.15)
                                | models.Q(description_similarity__gt=0.15)
                            )
                            qs = qs.annotate(
                                relevance=models.F('name_similarity') + models.F('description_similarity')
                            )
                            if not self.request.query_params.get(OrderingFilter.ordering_param):
                                self.ordering = ('-in_stock', '-relevance', 'has_offer', 'offer_price')

                        qs = qs.filter(combined_filter)
                    except Exception:
                        qs = qs.filter(combined_filter)
                else:
                    qs = qs.filter(combined_filter)
            except Exception:
                # If anything goes wrong while composing advanced search filters, fall back to
                # a simple, description-aware search to avoid 5xx errors.
                fallback_filter = (
                    models.Q(name__icontains=search_term)
                    | models.Q(description__icontains=search_term)
                    | models.Q(name__icontains=normalized_term_lower)
                    | models.Q(description__icontains=normalized_term_lower)
                )
                qs = qs.filter(fallback_filter)

        return qs


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


def _parse_date_param(raw):
    """Return date object from YYYY-MM-DD string, or None if empty/invalid."""
    if not raw:
        return None
    try:
        return timezone.datetime.fromisoformat(raw).date()
    except Exception:
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_stats(request):
    start = _parse_date_param(request.query_params.get('start'))
    end = _parse_date_param(request.query_params.get('end'))
    if request.query_params.get('start') and start is None:
        return Response({'detail': 'start inválido, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    if request.query_params.get('end') and end is None:
        return Response({'detail': 'end inválido, use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

    items = OrderItem.objects.select_related('product__category', 'order')
    if start:
        items = items.filter(order__created_at__date__gte=start)
    if end:
        items = items.filter(order__created_at__date__lte=end)

    by_product = (
        items.values('product_id', 'product__name')
        .annotate(
            quantity=models.Sum('quantity'),
            revenue=models.Sum(models.F('price') * models.F('quantity')),
        )
        .order_by('-revenue')
    )

    by_category = (
        items.values('product__category_id', 'product__category__name')
        .annotate(
            quantity=models.Sum('quantity'),
            revenue=models.Sum(models.F('price') * models.F('quantity')),
        )
        .order_by('-revenue')
    )

    by_day = (
        items.annotate(day=models.functions.TruncDay('order__created_at'))
        .values('day')
        .annotate(
            quantity=models.Sum('quantity'),
            revenue=models.Sum(models.F('price') * models.F('quantity')),
        )
        .order_by('day')
    )

    by_month = (
        items.annotate(month=models.functions.TruncMonth('order__created_at'))
        .values('month')
        .annotate(
            quantity=models.Sum('quantity'),
            revenue=models.Sum(models.F('price') * models.F('quantity')),
        )
        .order_by('month')
    )

    return Response(
        {
            'by_product': list(by_product),
            'by_category': list(by_category),
            'by_day': list(by_day),
            'by_month': list(by_month),
        }
    )
