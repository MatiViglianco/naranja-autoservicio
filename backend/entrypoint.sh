#!/bin/sh
set -e

MEDIA_DIR=${DJANGO_MEDIA_ROOT:-/app/media}
mkdir -p "$MEDIA_DIR"
chown -R appuser:appuser "$MEDIA_DIR"

echo "Running migrations..."
su -s /bin/sh appuser -c "python manage.py migrate --noinput"

echo "Collecting static files..."
su -s /bin/sh appuser -c "python manage.py collectstatic --noinput"

if [ "$DJANGO_RUN_SEED" = "1" ] || [ "$DJANGO_RUN_SEED" = "true" ]; then
  echo "Running seed script..."
  su -s /bin/sh appuser -c "python - <<'PYCODE'
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supermercado.settings")
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
import seed
seed.run()
PYCODE"
fi

echo "Starting Gunicorn..."
exec su -s /bin/sh appuser -c "gunicorn --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --timeout ${GUNICORN_TIMEOUT:-60} supermercado.wsgi:application"
