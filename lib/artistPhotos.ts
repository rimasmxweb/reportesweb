// Maps an artist slug to its photo file in /public/artists.
// Add a line here when a new photo is dropped into the folder.
const ARTIST_PHOTOS: Record<string, string> = {
  'alexia-mariel': 'alexia.jpg',
  'andy-rivera':   'andyrivera.jpg',
  'big-soto':      'bigsoto.jpg',
  'el-jordan-23':  'eljordan23.jpg',
  'fama':          'fama.jpg',
  'joseph-taics':  'joseph-taics.jpg',
  'kinto-piso':    'kintopiso.jpg',
  'latin-mafia':   'latinmafia.jpg',
  'mosmo':         'mosmo.jpg',
  'neutro-shorty': 'neutroshorty.jpg',
  'pailita':       'pailita.jpg',
  'yandel':        'yandel.jpg',
  'yurgenis':      'yurgenis.jpg',
}

export function photoSrc(slug: string): string | null {
  const file = ARTIST_PHOTOS[slug]
  return file ? `/artists/${file}` : null
}
