const CONFIG = {
  ALLOWED_ORIGINS: ['*'],

  B2_AUTH_API: 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',

  B2_DOWNLOAD_API: 'https://f004.backblazeb2.com',

  BUCKET_ID: null,

  BUCKET_NAME: 'daokotube',

  CACHE_CONTROL: 'public, max-age=60',

  PATH_PREFIX: '',

  URL_EXPIRATION_SECONDS: 3600,
};

let tokenCache = {
  accountId: null,
  apiUrl: null,
  authorizationToken: null,
  downloadUrl: null,
  expiresAt: 0,
};

function getCorsHeaders(_request) {
  return {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    'Access-Control-Max-Age': '86400',
  };
}

async function getB2AuthData(keyId, appKey) {
  const now = Date.now();

  if (tokenCache.authorizationToken && tokenCache.expiresAt > now + 300_000) {
    return {
      accountId: tokenCache.accountId,
      apiUrl: tokenCache.apiUrl,
      authorizationToken: tokenCache.authorizationToken,
      downloadUrl: tokenCache.downloadUrl,
    };
  }

  if (!keyId || !appKey) {
    throw new Error('B2 credentials not configured');
  }

  const authString = `${keyId}:${appKey}`,
    encodedAuth = btoa(authString),
    response = await fetch(CONFIG.B2_AUTH_API, {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
      },
      method: 'GET',
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`B2 authentication failed: ${response.status} ${errorText}`);
  }

  const authData = await response.json();

  tokenCache = {
    accountId: authData.accountId,
    apiUrl: authData.apiUrl,
    authorizationToken: authData.authorizationToken,
    downloadUrl: authData.downloadUrl,
    expiresAt: now + 23 * 60 * 60 * 1000,
  };

  return {
    accountId: authData.accountId,
    apiUrl: authData.apiUrl,
    authorizationToken: authData.authorizationToken,
    downloadUrl: authData.downloadUrl,
  };
}

async function getBucketId(authData) {
  if (CONFIG.BUCKET_ID) {
    return CONFIG.BUCKET_ID;
  }

  const url = `${authData.apiUrl}/b2api/v2/b2_list_buckets`,
    response = await fetch(url, {
      body: JSON.stringify({
        accountId: authData.accountId,
      }),
      headers: {
        Authorization: authData.authorizationToken,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list buckets: ${response.status} ${errorText}`);
  }

  const data = await response.json(),
    bucket = data.buckets.find(b => b.bucketName === CONFIG.BUCKET_NAME);

  if (!bucket) {
    throw new Error(`Bucket '${CONFIG.BUCKET_NAME}' not found`);
  }

  CONFIG.BUCKET_ID = bucket.bucketId;

  return bucket.bucketId;
}

async function getDownloadAuthorization(authData, filePath) {
  const bucketId = await getBucketId(authData),
    url = `${authData.apiUrl}/b2api/v2/b2_get_download_authorization`,
    response = await fetch(url, {
      body: JSON.stringify({
        bucketId,
        fileNamePrefix: filePath,
        validDurationInSeconds: CONFIG.URL_EXPIRATION_SECONDS,
      }),
      headers: {
        Authorization: authData.authorizationToken,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get download authorization: ${response.status} ${errorText}`);
  }

  const downloadAuthData = await response.json();

  return {
    authorizationToken: downloadAuthData.authorizationToken,
    downloadUrl: downloadAuthData.downloadUrl || tokenCache.downloadUrl,
  };
}

export default {
  async fetch(request, env, _ctx) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    try {
      const url = new URL(request.url),
        cid = url.searchParams.get('cid');

      if (!cid) {
        return new Response(JSON.stringify({ error: 'Missing CID parameter' }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
          status: 400,
        });
      }

      console.debug(
        'Environment variables:',
        JSON.stringify({
          envKeys: Object.keys(env),
          hasB2Key: Boolean(env.B2_KEY),
          hasB2KeyId: Boolean(env.B2_KEY_ID),
        }),
      );

      const keyId = env.B2_KEY_ID,
        appKey = env.B2_KEY;

      if (keyId === 'your-b2-key-id' && appKey === 'your-b2-application-key') {
        console.debug('Using mock authorized URL for testing');

        const authorizedUrl = `https://f004.backblazeb2.com/file/${CONFIG.BUCKET_NAME}/${cid}?Authorization=mock-auth-token`;

        return new Response(JSON.stringify({ authorizedUrl }), {
          headers: {
            'Cache-Control': CONFIG.CACHE_CONTROL,
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
          status: 200,
        });
      }

      const authData = await getB2AuthData(keyId, appKey),
        filePath = CONFIG.PATH_PREFIX ? `${CONFIG.PATH_PREFIX}${cid}` : cid,
        downloadAuth = await getDownloadAuthorization(authData, filePath),
        authorizedUrl = `${CONFIG.B2_DOWNLOAD_API}/file/${CONFIG.BUCKET_NAME}/${filePath}?Authorization=${downloadAuth.authorizationToken}`;

      return new Response(JSON.stringify({ authorizedUrl }), {
        headers: {
          'Cache-Control': CONFIG.CACHE_CONTROL,
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        status: 200,
      });
    } catch (error) {
      console.error('Error processing request:', error);

      return new Response(
        JSON.stringify({
          error: 'Failed to generate authorized URL',
          message: error.message,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
          status: 500,
        },
      );
    }
  },
};
