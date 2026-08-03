package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"trackerHub/backend/internal/models"
)

const (
	defaultTokenSecret = "trackerhub-default-secret"
	tokenExpiry        = 24 * time.Hour
	passwordMask       = "********"
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

	hashedPassword, err := hashPassword(password)
	if err != nil {
		hashedPassword = password
	}

	return &AuthService{
		username: username,
		password: hashedPassword,
		secret:   secret,
	}
}

func (s *AuthService) Authenticate(username, password string) bool {
	if username != s.username {
		return false
	}
	if comparePassword(password, s.password) {
		return true
	}
	return password == s.password
}

func (s *AuthService) UpdatePassword(newPassword string) error {
	hashedPassword, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	s.password = hashedPassword
	return nil
}

func (s *AuthService) GetConfigSnapshot() models.AuthConfigResponse {
	return models.AuthConfigResponse{
		Username: s.username,
		Password: passwordMask,
	}
}

func (s *AuthService) GetPassword() string {
	return s.password
}

func (s *AuthService) GetSecret() string {
	return s.secret
}

func (s *AuthService) MaskedPassword() string {
	return passwordMask
}

func hashPassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}
	if strings.HasPrefix(password, "$2") {
		return password, nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func comparePassword(candidate, stored string) bool {
	if candidate == "" || stored == "" {
		return false
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored), []byte(candidate)); err == nil {
		return true
	}
	return false
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
