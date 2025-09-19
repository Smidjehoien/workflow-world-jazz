export function decodeNonce(idToken: string): string {
  const payload = idToken.split('.')[1];
  const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
  const nonceMatch = decodedPayload.match(/"nonce":"([^"]+)"/);
  return nonceMatch ? nonceMatch[1] : '';
}
