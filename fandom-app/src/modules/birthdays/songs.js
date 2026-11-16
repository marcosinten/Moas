const youtubeHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
const metadataHosts = {
  YouTube: ['i.ytimg.com', 'img.youtube.com'],
  Spotify: ['i.scdn.co', 'image-cdn-fa.spotifycdn.com', 'image-cdn-ak.spotifycdn.com'],
  SoundCloud: ['i1.sndcdn.com', 'i2.sndcdn.com', 'i3.sndcdn.com', 'i4.sndcdn.com'],
};

function songLink(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')) return null;
  url.hash = '';

  if (youtubeHosts.includes(url.hostname)) {
    let videoId = url.searchParams.get('v');
    if (url.hostname === 'youtu.be') videoId = url.pathname.split('/')[1];
    if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2];
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
      const link = 'https://www.youtube.com/watch?v=' + videoId;
      return { url: link, provider: 'YouTube', endpoint: 'https://www.youtube.com/oembed' };
    }
  }
  if (url.hostname === 'open.spotify.com') {
    const track = /^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)\/?$/i.exec(url.pathname);
    if (track) {
      return { url: 'https://open.spotify.com/track/' + track[1], provider: 'Spotify', endpoint: 'https://open.spotify.com/oembed' };
    }
  }
  if (['soundcloud.com', 'www.soundcloud.com'].includes(url.hostname)) {
    url.hostname = 'soundcloud.com';
    url.search = '';
    return { url: url.href, provider: 'SoundCloud', endpoint: 'https://soundcloud.com/oembed' };
  }
  if (url.href.length > 2048) return null;
  return { url: url.href, provider: null, endpoint: null };
}

async function songMetadata(link) {
  if (!link.endpoint) return {};
  const endpoint = new URL(link.endpoint);
  endpoint.searchParams.set('url', link.url);
  endpoint.searchParams.set('format', 'json');
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {};
    }
    const data = await response.json();
    const title = typeof data.title === 'string'
      ? data.title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
      : null;
    let thumbnail = null;
    try {
      const image = new URL(data.thumbnail_url);
      if (image.protocol === 'https:' && !image.port && !image.username && !image.password
          && image.href.length <= 2048 && metadataHosts[link.provider].includes(image.hostname)) {
        thumbnail = image.href;
      }
    } catch {}
    return { title: title || null, thumbnail };
  } catch {
    return {};
  }
}

module.exports = { songLink, songMetadata };
