#!/bin/bash

# Deploy script for B2CID worker

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed. Please install it with 'npm install -g wrangler'."
    exit 1
fi

# Check if B2 credentials are set as secrets
echo "Checking for B2 credentials..."
if ! wrangler secret list | grep -q "B2_KEY_ID"; then
    echo "Warning: B2_KEY_ID secret is not set. You should set it with 'wrangler secret put B2_KEY_ID'."
    echo "Do you want to set it now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        wrangler secret put B2_KEY_ID
    fi
fi

if ! wrangler secret list | grep -q "B2_KEY"; then
    echo "Warning: B2_KEY secret is not set. You should set it with 'wrangler secret put B2_KEY'."
    echo "Do you want to set it now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        wrangler secret put B2_KEY
    fi
fi

# Deploy the worker
echo "Deploying B2CID worker..."
wrangler deploy --name b2cid

echo "Deployment complete!"
