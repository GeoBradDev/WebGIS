from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from django.contrib.gis.db import models


class CustomUserManager(UserManager):
    """Email-first manager: USERNAME_FIELD is ``email``, so creation is keyed on
    email rather than the inherited ``username``-first signature."""

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)

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
    # Stored as a PostGIS `geography` column: distance/dwithin queries then run
    # in metres on the spheroid and stay index-assisted (a plain geometry/4326
    # column computes great-circle distance per row and can't use the GiST
    # index). The trade-off is that geography supports fewer predicates than
    # geometry, so point-in-polygon uses `coveredby` (see services.points_within).
    geom = models.PointField(srid=4326, geography=True)
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
