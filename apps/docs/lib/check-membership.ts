export async function checkTeamMembership(
  accessToken: string
): Promise<string[]> {
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

  return teamIds;
}
