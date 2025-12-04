from unittest.mock import patch

from django.test import TestCase

from shop.models import Category, Product


class ProductImageCleanupTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Cat", slug="cat")

    @patch("django.db.models.fields.files.FieldFile.delete")
    def test_deleting_product_removes_image_from_storage(self, delete_mock):
        product = Product.objects.create(
            category=self.category,
            name="Prod",
            price=10,
            image="products/test.jpg",
        )

        product.delete()

        delete_mock.assert_called_once_with(save=False)

    @patch("django.db.models.fields.files.FieldFile.delete")
    def test_updating_product_image_replaces_old_file(self, delete_mock):
        product = Product.objects.create(
            category=self.category,
            name="Prod",
            price=10,
            image="products/old.jpg",
        )

        product.image = "products/new.jpg"
        product.save()

        delete_mock.assert_called_once_with(save=False)
        self.assertEqual(product.image.name, "products/new.jpg")
