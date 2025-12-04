from rest_framework import serializers
from django.db import transaction
from django.db.models import F, Case, When, IntegerField, Q
from django.utils import timezone
from .models import Category, Product, SiteConfig, Order, OrderItem, Coupon, Announcement


def get_valid_coupon_qs(code):
    """Return a queryset with coupons valid for the given code."""
    if not code:
        return Coupon.objects.none()
    now = timezone.now()
    coupon_qs = Coupon.objects.filter(code__iexact=code, active=True)
    return coupon_qs.filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now),
        Q(usage_limit__isnull=True) | Q(used_count__lt=F("usage_limit")),
    )


def _absolute_or_none(file_or_spec, request):
    if not file_or_spec:
        return None
    try:
        url = file_or_spec.url
    except Exception:
        return None
    return request.build_absolute_uri(url) if request else url


class CategorySerializer(serializers.ModelSerializer):
    image_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'image', 'image_thumbnail']

    def get_image_thumbnail(self, obj):
        request = self.context.get('request')
        return _absolute_or_none(getattr(obj, 'image_thumbnail', None), request)


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True, required=False
    )
    image = serializers.SerializerMethodField()
    image_thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'price', 'offer_price', 'image', 'image_thumbnail', 'stock',
            'is_active', 'promoted', 'promoted_until', 'category', 'category_id'
        ]

    def get_image(self, obj):
        request = self.context.get('request')
        return _absolute_or_none(obj.image, request)

    def get_image_thumbnail(self, obj):
        request = self.context.get('request')
        return _absolute_or_none(getattr(obj, 'image_thumbnail', None), request)


class SiteConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteConfig
        fields = ['whatsapp_phone', 'alias_or_cbu', 'shipping_cost', 'updated_at']


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True)
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Order
        fields = [
            'id', 'name', 'phone', 'address', 'notes', 'payment_method', 'delivery_method',
            'total', 'shipping_cost', 'created_at', 'items', 'coupon_code'
        ]
        read_only_fields = ['id', 'total', 'shipping_cost', 'created_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        code = validated_data.pop('coupon_code', '').strip()[:40]

        # Consolidar items por producto sumando cantidades
        consolidated = {}
        for item in items_data:
            pid = item['product_id']
            consolidated[pid] = consolidated.get(pid, 0) + item['quantity']

        # Validar que las cantidades resultantes sean positivas
        invalid = [pid for pid, qty in consolidated.items() if qty <= 0]
        if invalid:
            raise serializers.ValidationError({'items': f'Cantidad inválida para {", ".join(map(str, invalid))}'})

        # Determinar costo de envío y método de entrega
        cfg = SiteConfig.objects.first()
        cfg_shipping = cfg.shipping_cost if cfg else 0

        delivery_method = validated_data.get('delivery_method', 'delivery')
        shipping_cost = 0 if delivery_method == 'pickup' else cfg_shipping

        with transaction.atomic():
            order = Order.objects.create(shipping_cost=shipping_cost, coupon_code='', **validated_data)
            total = 0

            # Obtener todos los productos en un solo query
            product_ids = list(consolidated.keys())
            products_qs = Product.objects.select_for_update().filter(id__in=product_ids, is_active=True)
            products = {p.id: p for p in products_qs}

            if len(products) != len(product_ids):
                missing = set(product_ids) - set(products.keys())
                raise serializers.ValidationError({'items': f'Producto {", ".join(map(str, missing))} inválido'})

            order_items = []
            cases = []

            for pid, quantity in consolidated.items():
                product = products[pid]
                if product.stock < quantity:
                    raise serializers.ValidationError({'items': f'Sin stock suficiente para {product.name} (disponible: {product.stock})'})
                price = product.offer_price if product.offer_price else product.price
                total += price * quantity
                order_items.append(
                    OrderItem(order=order, product=product, quantity=quantity, price=price)
                )
                cases.append(When(id=product.id, then=F('stock') - quantity))

            OrderItem.objects.bulk_create(order_items)
            Product.objects.filter(id__in=products.keys()).update(
                stock=Case(*cases, default=F('stock'), output_field=IntegerField())
            )

            # Aplicar cupón si viene
            discount = 0
            if code:
                coupon_qs = get_valid_coupon_qs(code)
                c = coupon_qs.first()
                if c and total >= c.min_subtotal:
                    updated = 1
                    if c.usage_limit is not None:
                        updated = coupon_qs.filter(
                            pk=c.pk, used_count__lt=F("usage_limit")
                        ).update(used_count=F("used_count") + 1)
                    if updated == 1:
                        if c.type == Coupon.TYPE_FIXED:
                            discount = min(c.amount, total)
                        elif c.type == Coupon.TYPE_PERCENT:
                            raw = total * (c.percent / 100)
                            cap = c.percent_cap or 0
                            discount = min(raw, cap) if cap > 0 else raw
                        elif c.type == Coupon.TYPE_FREE_SHIPPING:
                            order.shipping_cost = 0
                        order.coupon_code = code

            order.discount_total = discount
            order.total = total - discount + order.shipping_cost
            order.save(update_fields=['total', 'discount_total', 'coupon_code', 'shipping_cost'])
            return order

    def validate_coupon_code(self, value):
        if not value:
            return ''
        code = value.strip()[:40]
        coupon = get_valid_coupon_qs(code).first()
        if not coupon:
            raise serializers.ValidationError('Cupón inválido')
        self._coupon = coupon
        return code


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'code', 'type', 'amount', 'percent', 'percent_cap', 'min_subtotal',
            'expires_at', 'usage_limit', 'used_count', 'active'
        ]


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['id', 'title', 'message', 'active', 'start_at', 'end_at', 'created_at']
