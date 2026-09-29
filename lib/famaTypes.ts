export type FamaPhase = {
  date: string
  title: string
  detail: string
}

export type FamaReleaseCard = {
  slug: string
  title: string
  song: string
  piece: string | null
  note: string | null
  typeLabel: string
  active: boolean
  campaignStart: string
  publicViews: number | null
  publicViewsFetchedAt: string | null
  youtubeVideoId: string | null
  phases: FamaPhase[]
}
