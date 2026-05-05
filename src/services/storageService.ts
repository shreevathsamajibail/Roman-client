import { Manifest } from '../types';

const WORKER_URL = 'https://clintrome.shreevathsa2k27.workers.dev';

export async function fetchManifest(userCode: string): Promise<Manifest> {
  const response = await fetch(`${WORKER_URL}?code=${userCode}`);
  if (!response.ok) return { images: [], folders: [] };
  return response.json();
}

export async function saveManifest(userCode: string, manifest: Manifest) {
  const response = await fetch(`${WORKER_URL}?code=${userCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest)
  });
  return response.ok;
}
