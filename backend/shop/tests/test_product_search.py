from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from shop.models import Category, Product


class ProductSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Cat", slug="cat")

    def test_search_matches_description(self):
        Product.objects.create(
            category=self.category,
            name="Sin match en nombre",
            description="Detergente para platos con espuma",
            price=10,
        )
        Product.objects.create(
            category=self.category,
            name="Solo nombre",
            description="",
            price=5,
        )

        url = reverse('product-list')
        resp = self.client.get(url, {'search': 'detergente'})

        self.assertEqual(resp.status_code, 200)
        names = [p['name'] for p in resp.data['results']]
        self.assertIn("Sin match en nombre", names)
