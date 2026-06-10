/**
 * Teste de carga k6 da busca por proximidade.
 *
 * Pré-requisitos: servidor rodando contra o banco de perf (conectai_perf,
 * já populado por seed-perf.ts) e Redis ativo. Como o /metrics é fechado em
 * produção sem token, suba o perf com METRICS_TOKEN e passe o mesmo aqui:
 *
 *   BASE_URL=http://localhost:3333 METRICS_TOKEN=perf-metrics \
 *     k6 run scripts/load/proximity.js
 *
 * Flags (env):
 *  - RNF014=1     habilita o cenário de 1000 req/s (constant-arrival-rate) e
 *                 seus thresholds. Fica OPT-IN porque numa única instância ele
 *                 falha o próprio p95<500 (1000 rps é alvo de cache + escala
 *                 horizontal — ver docs/perf-proximidade.md). Rode só quando
 *                 tiver o ambiente representativo.
 *  - CACHE_ONLY=1 roda ISOLADO só o cenário de cache. É o modo correto pra
 *                 reportar a RNF05.2: o delta de hit-rate (setup→teardown via
 *                 /metrics) reflete só a janela do cache, sem contaminação dos
 *                 outros cenários.
 *
 * Cenários (run completo):
 *  - exp_feed / exp_radius / exp_distance: ramping 0→100 VUs, mapeiam a curva
 *    latência×carga sobre células VARIADAS (cauda longa) — RNF01.3, p95<1000
 *    POR cenário.
 *  - cache: VUs constantes com tráfego clusterizado (90% células quentes /
 *    10% cauda — perfil urbano realista, não 100% trivial) — RNF05.2.
 *  - rnf014 (opt-in): 1000 req/s, mix de feed — RNF01.4 (p95<500, erro 5xx
 *    <0,1%).
 *
 * Erro = só status >= 500 (4xx como cap de raio / cursor inválido é esperado).
 */
import { check } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:3333'
const METRICS_TOKEN = __ENV.METRICS_TOKEN || ''
const RUN_RNF014 = __ENV.RNF014 === '1'
const CACHE_ONLY = __ENV.CACHE_ONLY === '1'

const serverErrorRate = new Rate('server_error_rate')

const HOT_CELLS = [
  { lat: -23.55, lng: -46.63 }, // SP
  { lat: -22.91, lng: -43.2 }, // RJ
  { lat: -19.92, lng: -43.94 }, // BH
]

function pick() {
  return HOT_CELLS[Math.floor(Math.random() * HOT_CELLS.length)]
}

// snapToGrid do backend (3 casas). Os centros das cidades caem EM CIMA da linha
// da grade; sem snapar, um jitter ±0.0005 cruzaria a borda e espalharia por
// várias células. Snapar + jitter dentro de (0, 0.001) garante UMA célula só.
function snap(v) {
  return Math.round(v * 1000) / 1000
}

// Ponto na MESMA célula snapada de uma cidade quente → mesma chave de cache.
function sameCellPoint() {
  const c = pick()
  return {
    lat: snap(c.lat) + 0.0001 + Math.random() * 0.0008,
    lng: snap(c.lng) + 0.0001 + Math.random() * 0.0008,
  }
}

// Cauda longa ao redor das cidades (~0.4° ≈ 44km) — células variadas (miss).
function tailPoint() {
  const c = pick()
  return {
    lat: c.lat + (Math.random() - 0.5) * 0.4,
    lng: c.lng + (Math.random() - 0.5) * 0.4,
  }
}

// Tráfego realista: clusteriza nas células quentes, com cauda. `hotProb` ajusta
// o quanto clusteriza (ex.: 0.9 = perfil urbano, dá hit-rate alto sem ser 100%).
function realisticPoint(hotProb) {
  return Math.random() < hotProb ? sameCellPoint() : tailPoint()
}

function track(res) {
  serverErrorRate.add(res.status >= 500)
  // status 0 = sem resposta (conexão recusada / servidor caído). Sem este
  // check, um servidor morto passa silencioso (0 < 500) e o run fica VERDE com
  // p95=0s — falso verde. Exigir status != 0 (+ threshold de checks) transforma
  // queda em falha do run; 4xx legítimo (cap/cursor) tem status real e não cai.
  check(res, {
    'recebeu resposta (servidor vivo)': (r) => r.status !== 0,
    'sem erro 5xx': (r) => r.status < 500,
  })
}

function metricsParams() {
  return METRICS_TOKEN
    ? { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } }
    : {}
}

// Soma os contadores de cache de todos os namespaces events:public* (Fluxo A +
// radius-superset, se houver) lidos do /metrics.
function readCacheCounters() {
  const res = http.get(`${BASE}/metrics`, metricsParams())
  const body = res.status === 200 ? res.body : ''
  const grab = (name) => {
    const re = new RegExp(
      `${name}\\{namespace="(events:public[^"]*)"\\} (\\d+)`,
      'g',
    )
    let sum = 0
    let m = re.exec(body)
    while (m !== null) {
      sum += Number(m[2])
      m = re.exec(body)
    }
    return sum
  }
  return { hits: grab('cache_hits_total'), misses: grab('cache_misses_total') }
}

const ramp = (startTime) => ({
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 100 },
    { duration: '60s', target: 100 },
  ],
  startTime,
})

const scenarios = {}
// Guarda global: se o servidor cair/recusar conexão, os checks despencam e o
// run FALHA (em vez de passar com p95=0s por falta de dados).
const thresholds = { checks: ['rate>0.99'] }

if (CACHE_ONLY) {
  scenarios.cache = {
    executor: 'constant-vus',
    exec: 'cacheHit',
    vus: 50,
    duration: '60s',
    tags: { scenario: 'cache' },
  }
} else {
  scenarios.exp_feed = { exec: 'feed', tags: { scenario: 'exp_feed' }, ...ramp('0s') }
  scenarios.exp_radius = {
    exec: 'radius',
    tags: { scenario: 'exp_radius' },
    ...ramp('90s'),
  }
  scenarios.exp_distance = {
    exec: 'distance',
    tags: { scenario: 'exp_distance' },
    ...ramp('180s'),
  }
  scenarios.cache = {
    executor: 'constant-vus',
    exec: 'cacheHit',
    vus: 50,
    duration: '60s',
    startTime: '270s',
    tags: { scenario: 'cache' },
  }
  thresholds['http_req_duration{scenario:exp_feed}'] = ['p(95)<1000']
  thresholds['http_req_duration{scenario:exp_radius}'] = ['p(95)<1000']
  thresholds['http_req_duration{scenario:exp_distance}'] = ['p(95)<1000']

  if (RUN_RNF014) {
    scenarios.rnf014 = {
      executor: 'constant-arrival-rate',
      exec: 'mix',
      rate: 1000,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      startTime: '340s',
      tags: { scenario: 'rnf014' },
    }
    thresholds['http_req_duration{scenario:rnf014}'] = ['p(95)<500']
    thresholds['server_error_rate{scenario:rnf014}'] = ['rate<0.001']
  }
}

export const options = { scenarios, thresholds }

// Snapshot dos contadores ANTES da janela; o delta é calculado no teardown.
export function setup() {
  return { before: readCacheCounters() }
}

export function teardown(data) {
  const after = readCacheCounters()
  const dh = after.hits - data.before.hits
  const dm = after.misses - data.before.misses
  const total = dh + dm
  const ratio = total > 0 ? ((dh / total) * 100).toFixed(1) : 'n/a'
  console.log(`[cache] hit-rate (delta da janela): ${ratio}% (${dh} hits / ${dm} misses)`)
  if (!CACHE_ONLY) {
    console.log(
      '[cache] AVISO: delta agregado de TODOS os cenários. Para a RNF05.2 isolada, rode CACHE_ONLY=1 k6 run ...',
    )
  }
}

function getRadius(p) {
  return http.get(`${BASE}/events?nearLat=${p.lat}&nearLng=${p.lng}&radiusKm=5`)
}

function getDistance(p) {
  return http.get(
    `${BASE}/events?nearLat=${p.lat}&nearLng=${p.lng}&orderBy=distance`,
  )
}

export function feed() {
  track(http.get(`${BASE}/events`))
}

export function radius() {
  track(getRadius(tailPoint()))
}

export function distance() {
  track(getDistance(tailPoint()))
}

export function cacheHit() {
  track(getDistance(realisticPoint(0.9)))
}

// mix realista de feed pro RNF01.4: 70% feed geral, 20% raio, 10% distance —
// raio/distance com tráfego clusterizado (80% quente) pra refletir o cache.
export function mix() {
  const r = Math.random()
  if (r < 0.7) feed()
  else if (r < 0.9) track(getRadius(realisticPoint(0.8)))
  else track(getDistance(realisticPoint(0.8)))
}
