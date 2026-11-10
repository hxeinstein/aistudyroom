// 실제 날씨 → 독서실 하늘 (Open-Meteo: 무료, 열쇠 없음). 위치는 config.js의 WEATHER
import { school } from './school.js';

// WMO 날씨 코드 → clear | cloudy | rain | snow
export function kindFor(code, cloud) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 3 || code === 45 || code === 48 || cloud >= 70) return 'cloudy';
  return 'clear';
}

export function initWeather(world, onFirstSnow) {
  // 시험용: 주소 뒤에 ?weather=snow 처럼 붙이면 그 날씨로
  const forced = new URLSearchParams(location.search).get('weather');
  if (forced) { world.setWeather(forced); return; }
  const w = school() && school().weather;   // 시트 '학교' 탭의 위도·경도 (없으면 맑은 하늘)
  if (!w || !w.lat || !w.lon) return;
  const load = async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=weather_code,cloud_cover&timezone=auto`;
      const r = await fetch(url).then((x) => x.json());
      const c = r && r.current;
      if (!c) return;
      const kind = kindFor(Number(c.weather_code), Number(c.cloud_cover));
      world.setWeather(kind);
      // 이번 겨울 첫눈이면 한 번 알려 줌
      if (kind === 'snow' && onFirstSnow) {
        const d = new Date(), winter = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
        let seen = '';
        try { seen = localStorage.getItem('aistudyroom.firstSnow') || ''; } catch (e) {}
        if (seen !== String(winter)) { try { localStorage.setItem('aistudyroom.firstSnow', String(winter)); } catch (e) {} onFirstSnow(); }
      }
    } catch (e) { /* 날씨를 못 받으면 맑은 하늘 그대로 */ }
  };
  load();
  setInterval(load, 30 * 60 * 1000);   // 30분마다
}
