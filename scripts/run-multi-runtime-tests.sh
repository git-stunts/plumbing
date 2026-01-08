#!/bin/sh
# run-tests.sh

echo "🚀 Starting multi-runtime Docker tests..."

# Detect docker compose version
if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif docker-compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ Error: docker compose not found"
  exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Run builds and tests
$DOCKER_COMPOSE up --build --remove-orphans

# Check status of each container
EXIT_CODE=0

for service in node-test bun-test deno-test; do
  STATUS=$($DOCKER_COMPOSE ps -a --format "{{.ExitCode}}" $service)
  if [ "$STATUS" != "0" ]; then
    echo "❌ $service failed with exit code $STATUS"
    EXIT_CODE=1
  else
    echo "✅ $service passed"
  fi
done

# Cleanup
$DOCKER_COMPOSE down

exit $EXIT_CODE