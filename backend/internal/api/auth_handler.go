package api

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"trackerHub/backend/internal/auth"
	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	authService   *auth.AuthService
	configManager *config.ConfigManager
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(configManager *config.ConfigManager) (*AuthHandler, error) {
	authConfig, err := configManager.LoadAuthConfig("config/auth_config.json")
	if err != nil {
		return nil, err
	}

	return &AuthHandler{
		authService:   auth.NewAuthService(*authConfig),
		configManager: configManager,
	}, nil
}

// Login godoc
// @Summary Login to TrackerHub
// @Description Authenticate user and return a bearer token
// @Tags Authentication
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login request"
// @Success 200 {object} models.LoginResponse
// @Failure 400 {object} models.LoginResponse
// @Failure 401 {object} models.LoginResponse
// @Router /api/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var request models.LoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, models.LoginResponse{Success: false, Message: "Username and password are required"})
		return
	}

	if !h.authService.Authenticate(request.Username, request.Password) {
		c.JSON(http.StatusUnauthorized, models.LoginResponse{Success: false, Message: "Invalid username or password"})
		return
	}

	token, err := h.authService.GenerateToken(request.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.LoginResponse{Success: false, Message: "Failed to generate auth token"})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{Success: true, Token: token})
}

func (h *AuthHandler) GetAuthConfig(c *gin.Context) {
	response := h.authService.GetConfigSnapshot()
	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) UpdateAuthConfig(c *gin.Context) {
	var request models.AuthConfigUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credentials payload"})
		return
	}

	newPassword := strings.TrimSpace(request.NewPassword)
	confirmPassword := strings.TrimSpace(request.ConfirmNewPassword)
	if newPassword == "" || confirmPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password and confirmation are required"})
		return
	}
	if err := validatePasswordStrength(newPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if newPassword != confirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password confirmation does not match"})
		return
	}

	authConfig, err := h.configManager.LoadAuthConfig("config/auth_config.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load authentication configuration"})
		return
	}

	authConfig.Password = newPassword
	if err := h.configManager.SaveAuthConfig("config/auth_config.json", authConfig); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist authentication configuration"})
		return
	}

	updatedAuthService := auth.NewAuthService(*authConfig)
	h.authService = updatedAuthService

	c.JSON(http.StatusOK, gin.H{"message": "Authentication configuration updated successfully"})
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	username, _ := c.Get("username")
	c.JSON(http.StatusOK, gin.H{"username": username})
}

func validatePasswordStrength(password string) error {
	password = strings.TrimSpace(password)
	if password == "" {
		return fmt.Errorf("new password is required")
	}
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	if !regexp.MustCompile(`[a-z]`).MatchString(password) || !regexp.MustCompile(`[A-Z]`).MatchString(password) {
		return fmt.Errorf("password must include both uppercase and lowercase letters")
	}
	if !regexp.MustCompile(`\d`).MatchString(password) {
		return fmt.Errorf("password must include at least one number")
	}
	if !regexp.MustCompile(`[^A-Za-z0-9]`).MatchString(password) {
		return fmt.Errorf("password must include at least one special character")
	}
	return nil
}
