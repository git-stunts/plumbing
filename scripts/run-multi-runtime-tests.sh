#!/bin/sh
# run-tests.sh

echo "🚀 Starting multi-runtime Docker tests..."

# Run docker-compose up without --abort-on-container-exit to let all finish
docker-compose up --build

# Check status of each container
EXIT_CODE=0

for service in node-test bun-test deno-test; do
  STATUS=$(docker-compose ps -a --format "{{.ExitCode}}" $service)
  if [ "$STATUS" != "0" ]; then
    echo "❌ $service failed with exit code $STATUS"
    EXIT_CODE=1
  else
    echo "✅ $service passed"
  fi
done

exit $EXIT_CODE
