#!/bin/bash
set -e

USER=$1
IMAGE="$USER/everything-florence-backend"

echo "🚀 Starting safe deploy..."

# Pull new image
docker pull $IMAGE:dev-next

# Tag current as backup
docker tag $IMAGE:dev-current $IMAGE:dev-prev || true

# Stop current app
docker compose -f docker-compose.dev.yml down app || true

# Start NEW container
docker run -d \
  --name florence-app-next \
  --env-file .env \
  -p 3000:3000 \
  $IMAGE:dev-next

echo "⏳ Waiting for health check..."

for i in {1..15}; do
  if curl -f http://localhost:3000/health; then
    echo "✅ New version healthy"

    # Promote new → current
    docker tag $IMAGE:dev-next $IMAGE:dev-current

    # Stop old safely
    docker stop florence-app || true
    docker rm florence-app || true

    # Rename new container
    docker rename florence-app-next florence-app

    echo "🎉 Deployment successful"
    exit 0
  fi

  sleep 3
done

echo "❌ New version failed health check — rolling back..."

docker stop florence-app-next || true
docker rm florence-app-next || true

docker run -d \
  --name florence-app \
  --env-file .env \
  -p 3000:3000 \
  $IMAGE:dev-current

echo "♻️ Rollback complete"