#!/bin/bash

# Stop execution if any command fails
set -e

# Set Defaults
IMAGE_TAG="camunda-lint-dev:latest"
# Default token to the environment variable
FINAL_TOKEN="$GITHUB_TOKEN"

# Parse Arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -i|--image) 
            IMAGE_TAG="$2"; 
            shift 
            ;;
        -t|--token) 
            FINAL_TOKEN="$2"; 
            shift 
            ;;
        *) 
            echo "Invalid parameter: $1"; 
            exit 1 
            ;;
    esac
    shift
done

# Check if values are set
if [ -z "$IMAGE_TAG" ]; then
    echo "Error: Image name and tag are required. Please use -i <image name:tag name>."
    exit 1
fi

if [ -z "$FINAL_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN is not set. Please set the env var or use -t <token>."
    exit 1
fi

echo "--- Building $IMAGE_TAG ---"

# Perform npm install to populate the package-lock.json
echo "Install dependencies..."
call npm install

# Generate SBOM
echo "Generating SBOM..."
npx @cyclonedx/cyclonedx-npm -o camunda-lint-sbom.json

# Remove existing image if exists
echo "Cleaning up if exists an image..."
docker image rm "$IMAGE_TAG" 2>/dev/null || true

# Build Docker Image
# We enable BuildKit and map the secret id 'GH_TOKEN' to the env var 'GITHUB_TOKEN'
echo "Building the docker image..."
DOCKER_BUILDKIT=1 GITHUB_TOKEN="$FINAL_TOKEN" docker build \
  --secret id=GH_TOKEN,env=GITHUB_TOKEN \
  -t "$IMAGE_TAG" \
  .

echo "--- Complete! Image $IMAGE_TAG built. ---"
