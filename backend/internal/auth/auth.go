package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	"trackerHub/backend/internal/models"
)

const (
	defaultTokenSecret = "trackerhub-default-secret"
	tokenExpiry        = 24 * time.Hour
)

type AuthService struct {
	username string
	password string
	secret   string
}

func NewAuthService(cfg models.AuthConfig) *AuthService {
	secret := cfg.Secret
	if secret == "" {
		secret = defaultTokenSecret
	}

	username := cfg.Username
	password := cfg.Password
	if username == "" || password == "" {
		username = "admin"
		password = "password123"
	}

	return &AuthService{
		username: username,
		password: password,
		secret:   secret,
	}
}

func (s *AuthService) Authenticate(username, password string) bool {
	return username == s.username && password == s.password
}

func (s *AuthService) GenerateToken(username string) (string, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	payload := fmt.Sprintf("%s:%s", username, timestamp)
	signature := s.sign(payload)
	record := fmt.Sprintf("%s:%s", payload, signature)
	return base64.StdEncoding.EncodeToString([]byte(record)), nil
}

func (s *AuthService) ValidateToken(token string) (string, bool) {
	decoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return "", false
	}

	parts := strings.SplitN(string(decoded), ":", 3)
	if len(parts) != 3 {
		return "", false
	}

	username := parts[0]
	timestampValue := parts[1]
	signature := parts[2]

	payload := fmt.Sprintf("%s:%s", username, timestampValue)
	if !hmac.Equal([]byte(signature), []byte(s.sign(payload))) {
		return "", false
	}

	timestamp, err := strconv.ParseInt(timestampValue, 10, 64)
	if err != nil {
		return "", false
	}

	if time.Since(time.Unix(timestamp, 0)) > tokenExpiry {
		return "", false
	}

	return username, true
}

func (s *AuthService) sign(value string) string {
	h := hmac.New(sha256.New, []byte(s.secret))
	_, _ = h.Write([]byte(value))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
