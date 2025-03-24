#!/bin/bash

echo "Stopping all containers matching 'instance-*'..."
docker ps -aq --filter "name=instance-" | xargs -r docker stop

echo "Removing all containers matching 'instance-*'..."
docker ps -aq --filter "name=instance-" | xargs -r docker rm

echo "Cleanup completed!"
