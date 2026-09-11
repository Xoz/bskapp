import "server-only";
import { all, get } from "./db";
import { canAccessGroup, canAccessPlayer, getCurrentUser } from "./auth";
import { loadMatchSpaceInputs } from "./matchSpaceReader";
export { capacityKey } from "./matchSpaceReader";

export async function getMatchSpaceInputs(playerIds: number[], targetMatchId?: number) {
  const actor = await getCurrentUser();
  if (!actor?.permissions.includes("view_players")) throw new Error("Behörighet saknas.");
  const ids = [...new Set(playerIds)];
  if ((await Promise.all(ids.map(id => canAccessPlayer(id)))).some(ok => !ok)) throw new Error("Spelaråtkomst saknas.");
  return loadMatchSpaceInputs({all,get,canAccessGroup}, ids, targetMatchId);
}
