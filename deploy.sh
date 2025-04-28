#!/bin/bash

# Non-interactive deployment script for B2CID worker

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed. Please install it with 'npm install -g wrangler'."
    exit 1
fi

# Deploy the worker without checking for secrets
# This assumes secrets are already set or will be set separately
echo "Deploying B2CID worker..."
wrangler deploy --name b2cid

echo "Deployment complete!"
