import verifiedRelease from './verified-release.json';

export type ReleaseAsset = {
  name: string;
  size: number;
  url: string;
  sha256: string;
};

export type ReleaseSnapshot = {
  tag: string;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

// Advance this snapshot only after independent verification of both release assets.
export const releaseSnapshot: ReleaseSnapshot = verifiedRelease;
