from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from django.contrib.gis.db import models


class CustomUserManager(UserManager):
    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = CustomUserManager()  # Use the custom manager

    def __str__(self):
        return self.email.lower()  # Store and return email in lowercase

    def save(self, *args, **kwargs):
        self.email = self.email.lower()  # Ensure email is always stored in lowercase
        super().save(*args, **kwargs)


# Demo feature models.
#
# These intentionally carry a couple of ordinary (non-geometry) attributes
# alongside the geometry to show how to extend a GeoDjango model: add fields
# here, run `makemigrations`/`migrate`, surface them in `api/schemas.py`
# (In/Out/Patch), and set them in `api/services.py`. `description` is a plain
# editable attribute; `created_at` is a server-managed timestamp.


class DemoPolygon(models.Model):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=500, blank=True, default="")
    geom = models.PolygonField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DemoPoint(models.Model):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=500, blank=True, default="")
    geom = models.PointField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DemoLine(models.Model):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=500, blank=True, default="")
    geom = models.LineStringField(srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
