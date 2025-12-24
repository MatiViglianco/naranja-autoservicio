from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from shop.models import Category, Product, Order, OrderItem


class SalesStatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat_a = Category.objects.create(name="A", slug="a")
        self.cat_b = Category.objects.create(name="B", slug="b")
        self.prod_a = Product.objects.create(category=self.cat_a, name="Prod A", price=Decimal("10.00"), stock=10)
        self.prod_b = Product.objects.create(category=self.cat_b, name="Prod B", price=Decimal("5.00"), stock=10)

    def _login(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        u = User.objects.create_user(username="staff", password="pass", is_staff=True)
        self.client.login(username="staff", password="pass")
        return u

    def _order_with_items(self, when, items):
        """
        Create order at datetime `when`.
        items: list of tuples (product, qty, price)
        """
        order = Order.objects.create(
            name="Buyer",
            phone="123",
            address="Street",
            payment_method="cash",
            delivery_method="delivery",
        )
        # Override created_at for grouping by day/month
        Order.objects.filter(pk=order.pk).update(created_at=when)
        for product, qty, price in items:
            OrderItem.objects.create(order=order, product=product, quantity=qty, price=price)
        return order

    def test_requires_auth(self):
        url = reverse("sales-stats")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)

    def test_stats_aggregations(self):
        self._login()
        today = timezone.now()
        yesterday = today - timezone.timedelta(days=1)
        self._order_with_items(
            yesterday,
            [
                (self.prod_a, 2, Decimal("10.00")),  # revenue 20
                (self.prod_b, 1, Decimal("5.00")),   # revenue 5
            ],
        )
        self._order_with_items(
            today,
            [
                (self.prod_a, 1, Decimal("10.00")),  # revenue +10
            ],
        )

        url = reverse("sales-stats")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        # By product
        prod_rows = {row["product_id"]: row for row in data["by_product"]}
        self.assertEqual(Decimal(str(prod_rows[self.prod_a.id]["revenue"])), Decimal("30.00"))
        self.assertEqual(prod_rows[self.prod_a.id]["quantity"], 3)
        self.assertEqual(Decimal(str(prod_rows[self.prod_b.id]["revenue"])), Decimal("5.00"))
        self.assertEqual(prod_rows[self.prod_b.id]["quantity"], 1)

        # By category
        cat_rows = {row["product__category_id"]: row for row in data["by_category"]}
        self.assertEqual(cat_rows[self.cat_a.id]["quantity"], 3)
        self.assertEqual(Decimal(str(cat_rows[self.cat_a.id]["revenue"])), Decimal("30.00"))

        # By day (two days)
        self.assertEqual(len(data["by_day"]), 2)

    def test_filters_by_start_date(self):
        self._login()
        today = timezone.now().date()
        earlier = today - timezone.timedelta(days=2)
        self._order_with_items(
            timezone.make_aware(timezone.datetime.combine(earlier, timezone.datetime.min.time())),
            [(self.prod_b, 2, Decimal("5.00"))],
        )
        self._order_with_items(
            timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time())),
            [(self.prod_b, 1, Decimal("5.00"))],
        )
        url = reverse("sales-stats")
        resp = self.client.get(url, {"start": today.isoformat()})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Should only include last order (qty 1, revenue 5)
        prod_rows = {row["product_id"]: row for row in data["by_product"]}
        self.assertEqual(prod_rows[self.prod_b.id]["quantity"], 1)
        self.assertEqual(Decimal(str(prod_rows[self.prod_b.id]["revenue"])), Decimal("5.00"))

    def test_invalid_date_returns_400(self):
        self._login()
        url = reverse("sales-stats")
        resp = self.client.get(url, {"start": "not-a-date"})
        self.assertEqual(resp.status_code, 400)
