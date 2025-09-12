import { hashToken } from './crypto';

const teamCache = new Map<string, { teamIds: string[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function checkTeamMembership(
  accessToken: string
): Promise<string[]> {
  // Hash the token for cache key
  const cacheKey = await hashToken(accessToken);

  // Check cache first
  const cached = teamCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.teamIds;
  }

  // Make API call and cache result
  const teamsResponse = await fetch('https://vercel.com/api/v2/teams', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!teamsResponse.ok) {
    throw new Error('Failed to fetch teams');
  }

  const data = await teamsResponse.json();
  const teamIds = data.teams.map((team: { id: string }) => team.id);

  // Cache result with hashed key
  teamCache.set(cacheKey, {
    teamIds,
    expires: Date.now() + CACHE_TTL,
  });

  // Clean up expired entries
  teamCache.forEach((value, key) => {
    if (value.expires <= Date.now()) {
      teamCache.delete(key);
    }
  });

  return teamIds;
}
