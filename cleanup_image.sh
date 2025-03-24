#!/bin/bash

# Check if an image name is provided
if [ -z "$1" ]; then
    echo "Usage: ./cleanup_and_rebuild.sh <image_name> [--build]"
    exit 1
fi

IMAGE_NAME="$1"
REBUILD=false

# Check for --build flag
if [ "$2" == "--build" ]; then
    REBUILD=true
fi

echo "Stopping all containers using image '$IMAGE_NAME'..."
docker ps -aq --filter "ancestor=$IMAGE_NAME" | xargs -r docker stop

echo "Removing all containers using image '$IMAGE_NAME'..."
docker ps -aq --filter "ancestor=$IMAGE_NAME" | xargs -r docker rm

echo "Removing image '$IMAGE_NAME'..."
docker rmi -f "$IMAGE_NAME"

# Rebuild if --build is passed
if [ "$REBUILD" = true ]; then
    echo "Rebuilding image '$IMAGE_NAME'..."
    docker build -t "$IMAGE_NAME" .
fi

echo "Cleanup completed for image: $IMAGE_NAME"
