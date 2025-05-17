# B2CID Worker

This Cloudflare Worker generates authorized URLs for accessing content stored in Backblaze B2 storage. It's designed to be used as a temporary provider for DaokoTube, allowing the application to fetch content from B2 when needed.

## Features

- Generates time-limited authorized URLs for B2 content
- Caches B2 authentication tokens to reduce API calls
- Implements proper CORS headers for cross-origin requests
- Handles error states gracefully
- Configurable URL expiration time
- Automatically retrieves bucket ID from bucket name
- Supports files stored in the root folder of the bucket

## API Usage

### URL Generation

```
GET https://your-worker-subdomain.workers.dev?cid=<IPFS_CID>
```

Where `<IPFS_CID>` is the Content Identifier for the IPFS content.

#### Response

```json
{
  "authorizedUrl": "https://f004.backblazeb2.com/file/daokotube/<CID>?Authorization=<TOKEN>"
}
```

The client can then use this authorized URL to fetch content directly from Backblaze B2.

### Error Response

```json
{
  "error": "Error message",
  "message": "Detailed error information"
}
```

## Deployment

### Prerequisites

1. A Cloudflare account with Workers enabled
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Backblaze B2 account with API credentials

### Setup

1. Log in to Wrangler:
   ```
   wrangler login
   ```

2. Configure B2 credentials as secrets:
   ```
   wrangler secret put B2_KEY_ID
   wrangler secret put B2_KEY
   ```

3. Deploy the worker:
   ```
   wrangler publish
   ```

## Configuration

The worker can be configured by modifying the `CONFIG` object in `index.js`:

- `URL_EXPIRATION_SECONDS`: Duration for which the authorized URL will be valid (default: 3600 seconds/1 hour)
- `PATH_PREFIX`: Path prefix in the B2 bucket where content is stored (default: empty string for root folder)
- `BUCKET_NAME`: Name of the B2 bucket where content is stored
- `BUCKET_ID`: Bucket ID (automatically populated by the worker)
- `CACHE_CONTROL`: Cache-Control header for responses
- `ALLOWED_ORIGINS`: List of origins allowed to access the worker via CORS


## Security Considerations

- B2 credentials are stored as Worker Secrets and never exposed to clients
- URLs are time-limited to prevent unauthorized access
- CORS is configured to allow only specific origins
- Error messages are sanitized to avoid leaking sensitive information
