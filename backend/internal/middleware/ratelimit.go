package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// window holds one IP's counter for the current fixed window.
type window struct {
	count int
	reset time.Time
}

// limiter is a fixed-window per-IP limiter (stdlib only; single instance).
// ponytail: in-memory, resets on restart; add when multi-replica/bot-scale (Redis).
type limiter struct {
	mu      sync.Mutex
	hits    map[string]*window
	max     int
	every   time.Duration
	cleanAt time.Time
}

func newLimiter(max int, every time.Duration) *limiter {
	return &limiter{hits: make(map[string]*window), max: max, every: every}
}

// allow reports whether ip may proceed, recording the hit.
func (l *limiter) allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if now.After(l.cleanAt) {
		for k, w := range l.hits {
			if now.After(w.reset) {
				delete(l.hits, k)
			}
		}
		l.cleanAt = now.Add(l.every)
	}
	w, ok := l.hits[ip]
	if !ok || now.After(w.reset) {
		w = &window{reset: now.Add(l.every)}
		l.hits[ip] = w
	}
	w.count++
	return w.count <= l.max
}

var loginLimiter = newLimiter(30, time.Minute)
var gradeLimiter = newLimiter(20, time.Minute)

// RateLimitLogin caps login attempts per IP: 30/menit. Satu lab di balik
// NAT berbagi IP — 10 terlalu ketat; bcrypt (±100ms/percobaan) tetap
// membuat brute-force mahal.
func RateLimitLogin() gin.HandlerFunc {
	return limitByIP(loginLimiter)
}

// RateLimitGrade caps demo grading per IP: 20/menit (1024 kombinasi possible).
func RateLimitGrade() gin.HandlerFunc {
	return limitByIP(gradeLimiter)
}

func limitByIP(l *limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{"code": "RATE_LIMITED", "message": "terlalu banyak percobaan, coba lagi semenit"},
			})
			return
		}
		c.Next()
	}
}
