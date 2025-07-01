/**
 * Returns the base URL for the workflow.
 *
 * If the `baseUrl` option is provided, it is returned as is.
 *
 * If the `baseUrl` option is not provided, the base URL is inferred from the
 * `VERCEL_URL` environment variable.
 *
 * If the `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable is set, the
 * protection bypass token is added to the base URL.
 *
 * @param baseUrl - The base URL for the workflow (optional).
 * @param env - The environment variables (defaults to `process.env`).
 * @returns The normalized base URL for the workflow.
 */
export function getBaseUrl(baseUrl?: string, env = process.env): URL {
  if (baseUrl) {
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https';

    // Adds implicit `https://` prefix to the base URL
    if (!baseUrl.startsWith(`${protocol}://`)) {
      baseUrl = `${protocol}://${baseUrl}`;
    }
    return new URL(baseUrl);
  }

  // Infer the base URL from the VERCEL_URL environment variable
  // when no `baseUrl` option is provided.
  const vercelUrlVal = env.VERCEL_URL;
  if (!vercelUrlVal) {
    throw new Error(
      'The `baseUrl` option must be provided when not running on Vercel'
    );
  }

  const protocol = vercelUrlVal.includes('localhost') ? 'http' : 'https';
  const vercelUrl = new URL(`${protocol}://${vercelUrlVal}`);

  // Add the protection bypass token to the Vercel URL when the
  // `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable is set
  const vercelAutomationBypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (vercelAutomationBypassSecret) {
    vercelUrl.searchParams.set(
      'x-vercel-protection-bypass',
      vercelAutomationBypassSecret
    );
  }

  return vercelUrl;
}
