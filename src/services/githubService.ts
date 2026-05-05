
interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  assets_url: string;
  assets: GitHubAsset[];
}

const env = (import.meta as any).env;

// --- HARDCODED CONFIGURATION ---
const PROXY_URL = 'PLACEHOLDER_PROXY_URL'; 
const OWNER = 'PLACEHOLDER_OWNER';         
const REPO = 'PLACEHOLDER_REPO';           
const TAG = 'v1.0.0'; 
// -------------------------------

function getConfig() {
  return {
    proxy: PROXY_URL.includes('PLACEHOLDER') ? env.VITE_GITHUB_PROXY_URL : PROXY_URL,
    owner: OWNER.includes('PLACEHOLDER') ? env.VITE_GITHUB_REPO_OWNER : OWNER,
    repo: REPO.includes('PLACEHOLDER') ? env.VITE_GITHUB_REPO_NAME : REPO,
    tag: TAG
  };
}

export async function getRelease() {
  const { proxy, owner, repo, tag } = getConfig();
  const response = await fetch(`${proxy}/repos/${owner}/${repo}/releases/tags/${tag}`);
  if (!response.ok) {
    if (response.status === 404) {
      return createRelease();
    }
    throw new Error(`Failed to fetch release: ${response.statusText}`);
  }
  return response.json() as Promise<GitHubRelease>;
}

async function createRelease() {
  const { proxy, owner, repo, tag } = getConfig();
  const response = await fetch(`${proxy}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: `Aether Storage ${tag}`,
      body: 'Automated storage for Aether OS images',
      draft: false,
      prerelease: false
    })
  });
  if (!response.ok) throw new Error(`Failed to create release: ${response.statusText}`);
  return response.json() as Promise<GitHubRelease>;
}

export async function uploadAsset(fileName: string, blob: Blob, releaseId: number) {
  const { proxy, owner, repo } = getConfig();
  const response = await fetch(`${proxy}/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${fileName}`, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type,
    },
    body: blob
  });

  if (!response.ok) throw new Error(`Failed to upload asset: ${response.statusText}`);
  return response.json() as Promise<GitHubAsset>;
}

export async function deleteAsset(assetId: number) {
  const { proxy, owner, repo } = getConfig();
  const response = await fetch(`${proxy}/repos/${owner}/${repo}/releases/assets/${assetId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error(`Failed to delete asset: ${response.statusText}`);
  return true;
}

export async function updateManifest(manifest: any, releaseId: number, existingManifestId?: number) {
  if (existingManifestId) {
    await deleteAsset(existingManifestId);
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  return uploadAsset('manifest.json', blob, releaseId);
}
