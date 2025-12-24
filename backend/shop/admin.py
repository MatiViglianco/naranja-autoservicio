from datetime import datetime

from django.contrib import admin
from django.db import models
from django.template.response import TemplateResponse
from django.urls import path

from .models import Category, Product, SiteConfig, Order, OrderItem, Coupon, Announcement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'offer_price', 'stock', 'is_active', 'promoted', 'promoted_until')
    list_filter = ('category', 'is_active', 'promoted')
    search_fields = ('name', 'description')


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ('whatsapp_phone', 'alias_or_cbu', 'shipping_cost', 'updated_at')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'price')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'phone', 'payment_method', 'total', 'created_at')
    readonly_fields = ('total', 'shipping_cost', 'created_at')
    inlines = [OrderItemInline]
    search_fields = ('name', 'phone')

    change_list_template = "admin/shop/order/change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path("stats/", self.admin_site.admin_view(self.stats_view), name="shop_order_stats"),
        ]
        return custom + urls

    def stats_view(self, request):
        def parse_date(value):
            if not value:
                return None
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                return None

        start = parse_date(request.GET.get("start"))
        end = parse_date(request.GET.get("end"))

        items = OrderItem.objects.select_related("product__category", "order")
        if start:
            items = items.filter(order__created_at__date__gte=start)
        if end:
            items = items.filter(order__created_at__date__lte=end)

        items = items.annotate(
            line_total=models.ExpressionWrapper(
                models.F("price") * models.F("quantity"),
                output_field=models.DecimalField(max_digits=18, decimal_places=2),
            )
        )

        by_product = (
            items.values("product_id", "product__name")
            .annotate(
                quantity=models.Sum("quantity"),
                revenue=models.Sum("line_total"),
            )
            .order_by("-revenue")
        )

        by_category = (
            items.values("product__category_id", "product__category__name")
            .annotate(
                quantity=models.Sum("quantity"),
                revenue=models.Sum("line_total"),
            )
            .order_by("-revenue")
        )

        by_day = (
            items.annotate(day=models.functions.TruncDay("order__created_at"))
            .values("day")
            .annotate(
                quantity=models.Sum("quantity"),
                revenue=models.Sum("line_total"),
            )
            .order_by("day")
        )

        by_month = (
            items.annotate(month=models.functions.TruncMonth("order__created_at"))
            .values("month")
            .annotate(
                quantity=models.Sum("quantity"),
                revenue=models.Sum("line_total"),
            )
            .order_by("month")
        )

        context = dict(
            self.admin_site.each_context(request),
            title="Estadísticas de ventas",
            start=start,
            end=end,
            by_product=by_product,
            by_category=by_category,
            by_day=by_day,
            by_month=by_month,
        )
        return TemplateResponse(request, "admin/shop/order/stats.html", context)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'type', 'amount', 'percent', 'percent_cap', 'min_subtotal', 'active')
    list_filter = ('type', 'active')
    search_fields = ('code',)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'active', 'start_at', 'end_at', 'created_at')
    list_filter = ('active',)
    search_fields = ('title', 'message')
