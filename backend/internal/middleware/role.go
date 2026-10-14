package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Secret reads the signing secret. In release mode it must be set.
func Secret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	if strings.EqualFold(os.Getenv("GIN_MODE"), "release") {
		log.Fatal("FATAL: JWT_SECRET wajib diset pada mode release")
	}
	return "dev-secret-ganti-di-production"
}

// ParseToken verifies a Bearer token and returns its claims.
func ParseToken(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(Secret()), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("token tidak valid atau kedaluwarsa")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("claim token rusak")
	}
	return claims, nil
}

// bearer extracts the token string from the Authorization header.
func bearer(c *gin.Context) (string, bool) {
	h := c.GetHeader("Authorization")
	if len(h) < 7 || h[:7] != "Bearer " {
		return "", false
	}
	return strings.TrimSpace(h[7:]), true
}

// RequireRole rejects requests without a valid token whose role is listed.
// Empty roles = any authenticated user. Claims are stored for handlers:
// user_id, username, role.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		ts, ok := bearer(c)
		if !ok || ts == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": "token hilang atau tidak valid"},
			})
			return
		}
		claims, err := ParseToken(ts)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()},
			})
			return
		}
		role, _ := claims["role"].(string)
		if len(allowed) > 0 && !allowed[role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "peran tidak diizinkan"},
			})
			return
		}
		c.Set("user_id", claims["user_id"])
		c.Set("username", claims["sub"])
		c.Set("role", role)
		c.Next()
	}
}
