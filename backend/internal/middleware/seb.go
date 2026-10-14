package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// SEBGuard rejects requests when Safe Exam Browser is required but not detected.
//
// Activation: REQUIRE_SEB=true env var (default false → pass-through).
// Per-request: query param ?seb=1 also triggers the check regardless of env.
// Detection: header X-SEB-Key must be non-empty.
func SEBGuard() gin.HandlerFunc {
	envRequired := strings.EqualFold(os.Getenv("REQUIRE_SEB"), "true")

	return func(c *gin.Context) {
		needSEB := envRequired || c.Query("seb") == "1"
		if !needSEB {
			c.Next()
			return
		}
		if strings.TrimSpace(c.GetHeader("X-SEB-Key")) == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "SEB_REQUIRED",
					"message": "Akses ditolak: Safe Exam Browser diperlukan",
				},
			})
			return
		}
		c.Next()
	}
}
