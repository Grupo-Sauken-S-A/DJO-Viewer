import { describe, it, expect } from 'vitest';
import { POST } from './route';

const postJson = async (body) => {
  const request = new Request('http://localhost/api/verify-signature-integrity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
};

describe('POST /api/verify-signature-integrity — validaciones de entrada', () => {
  it('rechaza si falta xmlContent', async () => {
    const { status, body } = await postJson({});
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('rechaza un xmlContent demasiado grande', async () => {
    const { status } = await postJson({ xmlContent: 'x'.repeat(6 * 1024 * 1024) });
    expect(status).toBe(413);
  });

  it('devuelve null (sin firma) para ambos elementos si el XML no tiene firmas', async () => {
    const { status, body } = await postJson({ xmlContent: '<root><DJO id="DJO">sin firmar</DJO></root>' });
    expect(status).toBe(200);
    expect(body.DJO).toBeNull();
    expect(body.DJOEH).toBeNull();
  });
});
