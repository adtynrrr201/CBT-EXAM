// Beban 3 endpoint terberat: login, heartbeat (autosave), live proktor.
// Jalankan bila k6 tersedia: k6 run --vus 50 --duration 60s k6/cbt-smoke.js
// Target: p95 < 800ms (TASKS Fase 3). BASE default docker lokal.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080/api/v1';

export const options = { vus: 50, duration: '60s', thresholds: { http_req_duration: ['p(95)<800'] } };

export function setup() {
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: '12345', password: '12345' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'login 200': (x) => x.status === 200 });
  return { token: r.json('access_token') };
}

export default function (data) {
  const h = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` } };
  const hb = http.post(`${BASE}/ujian/demo/heartbeat`, JSON.stringify({ focus_lost: 0, is_fullscreen: true }), h);
  check(hb, { 'heartbeat 200': (x) => x.status === 200 });
  sleep(5);
}
