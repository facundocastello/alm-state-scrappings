import got, { Got, Options } from 'got';
import { CookieJar } from 'tough-cookie';
import { config } from './config.js';
import {
  FolderListingRequest,
  FolderListingResponse,
  MetadataResponse,
} from './types.js';

// Create a cookie jar for session handling
const cookieJar = new CookieJar();

// Create HTTP client with defaults
const client: Got = got.extend({
  cookieJar,
  headers: {
    'User-Agent': config.http.userAgent,
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
  },
  timeout: {
    request: config.http.timeout,
  },
  retry: {
    limit: config.http.retries,
    methods: ['GET', 'POST'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    calculateDelay: ({ attemptCount }) => attemptCount * config.http.retryDelay,
  },
});

/**
 * Fetch folder listing (facilities or reports) with pagination
 */
export async function fetchFolderListing(
  folderId: number,
  start: number,
  end: number
): Promise<FolderListingResponse> {
  const body: FolderListingRequest = {
    repoName: 'WEB',
    folderId,
    getNewListing: true,
    start,
    end,
    sortColumn: '',
    sortAscending: true,
  };

  const response = await client.post<FolderListingResponse>(config.api.folderListing, {
    json: body,
    responseType: 'json',
  });

  return response.body;
}

/**
 * Fetch metadata for a specific entry (facility)
 */
export async function fetchMetadata(entryId: number): Promise<MetadataResponse> {
  const body = {
    repoName: 'WEB',
    entryId,
  };

  const response = await client.post<MetadataResponse>(config.api.metadata, {
    json: body,
    responseType: 'json',
  });

  return response.body;
}

/**
 * Download a PDF file
 */
export async function downloadPDF(url: string): Promise<Buffer> {
  const response = await client.get(url, {
    responseType: 'buffer',
    followRedirect: true,
  });

  return response.body;
}

/**
 * Sanitize filename for URL (replace special chars)
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Build PDF download URL
 */
export function buildPDFUrl(entryId: number, name: string, extension: string): string {
  const sanitized = sanitizeFilename(name);
  const filename = extension ? `${sanitized}.${extension}` : sanitized;
  return config.api.pdfDownload(entryId, filename);
}
