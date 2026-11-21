/** Choose release metadata without downgrading the build snapshot. */
export function chooseRelease(snapshot, candidate) {
  if (!candidate) return snapshot;
  if (!snapshot) return candidate;
  const version = (tag) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag ?? '')?.slice(1).map(Number);
  const a = version(snapshot.tag);
  const b = version(candidate.tag);
  if (!a || !b) return snapshot;
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return candidate;
    if (b[i] < a[i]) return snapshot;
  }
  // During publication one platform asset may arrive before the other.
  const complete = (r) => r.assets?.some((x) => /\.exe$/i.test(x.name)) && r.assets?.some((x) => /\.dmg$/i.test(x.name));
  return complete(snapshot) && !complete(candidate) ? snapshot : candidate;
}
