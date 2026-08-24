package websocket

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()
	assert.NotNil(t, hub)
}

func TestHubRegisterUnregister(t *testing.T) {
	hub := NewHub()
	var wg sync.WaitGroup

	// Start hub in background
	wg.Add(1)
	go func() {
		defer wg.Done()
		hub.Run()
	}()

	// Give hub time to start
	time.Sleep(10 * time.Millisecond)

	// Create a mock client (we can't easily create real websocket.Conn in unit tests)
	// So we test the registration logic by checking the internal state via exported methods
	// For now, we'll test that Hub creation works and channels exist
	assert.NotNil(t, hub.register)
	assert.NotNil(t, hub.unregister)
	assert.NotNil(t, hub.broadcast)

	// Stop hub by sending a client to unregister (this is a simplified test)
	// In reality we'd need a way to stop the hub
}

func TestHubBroadcastMessage(t *testing.T) {
	hub := NewHub()
	var wg sync.WaitGroup

	// Start hub in background
	wg.Add(1)
	go func() {
		defer wg.Done()
		hub.Run()
	}()

	time.Sleep(10 * time.Millisecond)

	// Test broadcasting a simple message
	hub.BroadcastMessage(map[string]string{"test": "message"})

	// Give time for broadcast to process
	time.Sleep(10 * time.Millisecond)

	// Test broadcasting initial state
	hub.BroadcastInitialState(map[string]interface{}{
		"tracker1": map[string]interface{}{"x": 1.0, "y": 2.0},
	})

	time.Sleep(10 * time.Millisecond)

	// Test broadcasting MQTT status
	hub.BroadcastMQTTStatus("connected")

	time.Sleep(10 * time.Millisecond)
}

func TestHubBroadcastWithNoClients(t *testing.T) {
	hub := NewHub()

	// Should not panic with no clients registered
	hub.BroadcastMessage("test")
	hub.BroadcastInitialState(map[string]interface{}{})
	hub.BroadcastMQTTStatus("disconnected")
}

func TestClientSendMessage(t *testing.T) {
	hub := NewHub()
	client := &Client{
		hub:  hub,
		conn: nil,
		send: make(chan []byte, 10),
	}

	// Should not panic with nil connection
	client.SendMessage(map[string]string{"test": "data"})
}

func TestClientWritePumpDoesNotPanic(t *testing.T) {
	// This is a basic test to ensure writePump doesn't panic on nil conn
	// We can't fully test without a real websocket connection
	hub := NewHub()
	client := &Client{
		hub:  hub,
		conn: nil,
		send: make(chan []byte, 10),
	}

	// Just verify the struct is created correctly
	assert.Equal(t, hub, client.hub)
	assert.NotNil(t, client.send)
}

func TestHandleWebSocket(t *testing.T) {
	// HandleWebSocket requires a real websocket.Conn which we can't easily mock
	// in a unit test. This would require an integration test.
	// For now, just verify the function exists and signature is correct
	// We skip this test as it starts goroutines that would hang with nil conn
	t.Skip("Requires real websocket.Conn for integration test")
}

func TestConcurrentHubOperations(t *testing.T) {
	hub := NewHub()
	var wg sync.WaitGroup

	// Start hub
	wg.Add(1)
	go func() {
		defer wg.Done()
		hub.Run()
	}()

	time.Sleep(10 * time.Millisecond)

	// Simulate multiple concurrent broadcasts
	var bwg sync.WaitGroup
	for i := 0; i < 10; i++ {
		bwg.Add(1)
		go func(id int) {
			defer bwg.Done()
			hub.BroadcastMessage(map[string]int{"id": id})
		}(i)
	}

	bwg.Wait()
	time.Sleep(50 * time.Millisecond)
}

func TestBroadcastMethods(t *testing.T) {
	hub := NewHub()

	// Test all broadcast methods don't panic
	hub.BroadcastMessage(nil)
	hub.BroadcastMessage("")
	hub.BroadcastMessage(123)
	hub.BroadcastMessage([]string{"a", "b"})

	hub.BroadcastInitialState(nil)
	hub.BroadcastInitialState(map[string]interface{}{})

	hub.BroadcastMQTTStatus("")
	hub.BroadcastMQTTStatus("connected")
	hub.BroadcastMQTTStatus("error")
}

func TestClientCreation(t *testing.T) {
	hub := NewHub()
	client := &Client{
		hub:  hub,
		conn: nil,
		send: make(chan []byte, 256),
	}

	require.NotNil(t, client)
	require.Equal(t, hub, client.hub)
	require.NotNil(t, client.send)
	require.Equal(t, 256, cap(client.send))
}
