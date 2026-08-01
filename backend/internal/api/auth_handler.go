package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"trackerHub/backend/internal/auth"
	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	authService *auth.AuthService
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(configManager *config.ConfigManager) (*AuthHandler, error) {
	authConfig, err := configManager.LoadAuthConfig("config/auth_config.json")
	if err != nil {
		return nil, err
	}

	return &AuthHandler{authService: auth.NewAuthService(*authConfig)}, nil
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

func (h *AuthHandler) GetProfile(c *gin.Context) {
	username, _ := c.Get("username")
	c.JSON(http.StatusOK, gin.H{"username": username})
}
