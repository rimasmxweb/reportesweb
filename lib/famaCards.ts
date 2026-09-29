import type { FamaReleaseCard } from './famaTypes'
import { displayPublicViews, type StoredPublicViews } from './publicViews'
import { releaseTypeLabel, type Release } from './releases'

export function toFamaReleaseCards(
  releases: Release[],
  stored: Map<string, StoredPublicViews>
): FamaReleaseCard[] {
  return releases.map((release) => {
    const views = displayPublicViews(release, stored.get(release.id))
    return {
      slug: release.slug,
      title: release.title,
      song: release.song?.trim() || release.title,
      piece: release.piece?.trim() || null,
      note: release.note?.trim() || null,
      typeLabel: releaseTypeLabel(release.type),
      active: release.active,
      campaignStart: release.campaignStart,
      publicViews: views.publicViews,
      publicViewsFetchedAt: views.publicViewsFetchedAt,
      youtubeVideoId: release.youtubeVideoId,
      phases: (release.phases ?? []).map((phase) => ({
        date: phase.date,
        title: phase.title,
        detail: phase.detail,
      })),
    }
  })
}
