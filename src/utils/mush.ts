import type { MushPlayerProfile } from '../types/mush'

export function getPlayerHeadUrl(player: MushPlayerProfile, size = 64) {
  const skinHash = player.skin?.hash
  const avatarIdentifier = skinHash || player.account.unique_id

  return `https://mc-heads.net/avatar/${avatarIdentifier}/${size}`
}
