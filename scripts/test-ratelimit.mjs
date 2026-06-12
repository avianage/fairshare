// Verifies the middleware rate limiter: register bucket (5/h) trips on the 6th
// request, the 429 carries retryAfter, and polled auth endpoints are exempt.
// Run with the dev server up.
const BASE = "http://localhost:3000"

let pass = 0
let fail = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  ok ? pass++ : fail++
}

// Unique IP per bucket so reruns don't collide with earlier counts.
const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`

function post(path, body) {
  return fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(body),
    redirect: "manual",
  })
}

async function main() {
  // register: limit 5/hour. Invalid body → route would 400; we only care that
  // the FIRST 5 are not 429 and the 6th is.
  const statuses = []
  for (let i = 0; i < 6; i++) {
    const res = await post("/api/auth/register", {})
    statuses.push(res.status)
    if (i === 5) {
      const body = await res.json().catch(() => ({}))
      check("6th register request → 429", res.status === 429, `status=${res.status}`)
      check("429 body { error: 'Too many requests' }", body.error === "Too many requests", JSON.stringify(body))
      check("429 includes positive retryAfter", typeof body.retryAfter === "number" && body.retryAfter > 0, `retryAfter=${body.retryAfter}`)
      check("429 sets Retry-After header", !!res.headers.get("retry-after"), res.headers.get("retry-after") || "")
    }
  }
  check("first 5 register requests not rate-limited", statuses.slice(0, 5).every((s) => s !== 429), JSON.stringify(statuses))

  // Polled auth endpoint must be exempt: 15 GETs to /api/auth/session, none 429.
  const ip2 = `198.51.100.${Math.floor(Math.random() * 250) + 1}`
  let any429 = false
  for (let i = 0; i < 15; i++) {
    const res = await fetch(BASE + "/api/auth/session", {
      headers: { "X-Forwarded-For": ip2 },
      redirect: "manual",
    })
    if (res.status === 429) any429 = true
  }
  check("/api/auth/session exempt from rate limiting (15 calls)", !any429)

  console.log(`\n${pass}/${pass + fail} checks passed.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Harness error:", e)
  process.exit(1)
})
