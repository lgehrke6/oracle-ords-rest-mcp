import { request } from 'undici';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Adjusted path to .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });


const TOKEN_URL = process.env.TOKEN_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

async function fetchAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Client ID or Client Secret not configured in .env file');
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (response.statusCode !== 200) {
    const errorBody = await response.body.text();
    throw new Error(`Failed to fetch access token: ${response.statusCode} - ${errorBody}`);
  }

  const tokenData: any = await response.body.json();
  accessToken = tokenData.access_token;
  // Set expiry to 5 minutes before actual expiry to be safe
  tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; 
  return accessToken!;
}

export async function getAccessToken(): Promise<string> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }
  return fetchAccessToken();
}

export async function makeAuthenticatedRequest(url: string, options: Parameters<typeof request>[1]): Promise<ReturnType<typeof request>> {
  const token = await getAccessToken();
  const authHeaders = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  return request(url, { ...options, headers: authHeaders });
}