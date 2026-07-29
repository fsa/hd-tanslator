import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { getSetting } from './settings';
import { SocksProxyAgent } from 'socks-proxy-agent';

let client: AxiosInstance | null = null;

/**
 * Create a proxy agent based on the proxy URL protocol.
 *
 * - SOCKS4/SOCKS5: uses SocksProxyAgent with resolveDns=true so that
 *   DNS resolution happens through the proxy (prevents local DNS leaks).
 * - HTTP/HTTPS: uses SocksProxyAgent which also handles these protocols.
 *
 * @param proxyUrl - The proxy URL (e.g. socks5://127.0.0.1:7890, http://proxy:8080)
 */
function createAgent(proxyUrl: string): SocksProxyAgent {
  const isSocks = /^socks/i.test(proxyUrl);
  const opts: Record<string, unknown> = {};
  if (isSocks) {
    opts.resolveDns = true;
  }
  return new SocksProxyAgent(proxyUrl, opts as any);
}

/**
 * Get or create the singleton Axios instance configured with proxy settings.
 * The proxy server URL is read from the PROXY_SERVER setting at creation time.
 * If the setting changes, call {@link resetClient} to force re-creation.
 *
 * Proxy support:
 * - SOCKS5: socks5://proxy:port (DNS resolved through proxy)
 * - SOCKS4: socks4://proxy:port
 * - HTTP:   http://proxy:port
 * - HTTPS:  https://proxy:port
 *
 * Axios built-in proxy handling is disabled (proxy: false) to avoid conflicts
 * with the custom agent.
 */
function getClient(): AxiosInstance {
  if (client) return client;

  const proxyUrl = getSetting('PROXY_SERVER');
  const config: AxiosRequestConfig = {
    timeout: 60_000,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (proxyUrl) {
    const agent = createAgent(proxyUrl);
    config.httpAgent = agent;
    config.httpsAgent = agent;
    // Disable axios built-in proxy handling to avoid conflicts with custom agent
    config.proxy = false;
  }

  client = axios.create(config);

  // ---- Debug interceptors ----
  client.interceptors.request.use((req) => {
    console.log(`[API] --> ${req.method?.toUpperCase()} ${req.url}`);
    if (proxyUrl) {
      console.log(`[API]     proxy: ${proxyUrl}`);
    }
    if (req.data) {
      const dataStr = typeof req.data === 'string' ? req.data : JSON.stringify(req.data);
      console.log(`[API]     body: ${dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr}`);
    }
    return req;
  });

  client.interceptors.response.use(
    (res) => {
      console.log(`[API] <-- ${res.status} ${res.statusText} (${res.config.url})`);
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`[API]     body: ${dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr}`);
      return res;
    },
    (err) => {
      if (err.response) {
        console.log(`[API] <-- ${err.response.status} ${err.response.statusText} (${err.config?.url})`);
        const dataStr = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
        console.log(`[API]     body: ${dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr}`);
      } else if (err.request) {
        console.log(`[API] <-- NETWORK ERROR: ${err.message} (${err.code || 'unknown'})`);
        console.log(`[API]     url: ${err.config?.url}`);
      } else {
        console.log(`[API] <-- ERROR: ${err.message}`);
      }
      return Promise.reject(err);
    }
  );

  return client;
}

/**
 * Reset the cached Axios instance so the next call to {@link apiRequest}
 * re-reads proxy settings. Call this after the user changes PROXY_SERVER.
 */
export function resetClient(): void {
  client = null;
}

/**
 * Generic API request function.
 * All translator services MUST use this function instead of calling axios directly.
 *
 * @param config - Axios request configuration (url, method, data, params, etc.)
 * @returns The Axios response object
 */
export async function apiRequest<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  const instance = getClient();
  return instance.request<T>(config);
}

export type { AxiosRequestConfig, AxiosResponse };