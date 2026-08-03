package auth

import (
	"testing"
	"trackerHub/backend/internal/models"
)

func TestAuthServiceGenerateAndValidateToken(t *testing.T) {
	service := NewAuthService(models.AuthConfig{Username: "admin", Password: "password123", Secret: "test-secret"})

	token, err := service.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	username, valid := service.ValidateToken(token)
	if !valid {
		t.Fatalf("ValidateToken should accept a valid token")
	}

	if username != "admin" {
		t.Fatalf("ValidateToken returned unexpected username: %s", username)
	}
}

func TestAuthServiceAcceptsHashedStoredPassword(t *testing.T) {
	hashedPassword, err := hashPassword("password123")
	if err != nil {
		t.Fatalf("hashPassword returned error: %v", err)
	}

	service := NewAuthService(models.AuthConfig{Username: "admin", Password: hashedPassword, Secret: "test-secret"})

	if !service.Authenticate("admin", "password123") {
		t.Fatalf("Authenticate should accept a hashed stored password")
	}
}

func TestAuthServiceRejectsTamperedToken(t *testing.T) {
	service := NewAuthService(models.AuthConfig{Username: "admin", Password: "password123", Secret: "test-secret"})

	token, err := service.GenerateToken("admin")
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	_, valid := service.ValidateToken(token + "x")
	if valid {
		t.Fatalf("ValidateToken should reject tampered token")
	}
}
