package session

import (
	"errors"
	"sync"

	"github.com/google/uuid"
)

// ErrNotFound is returned when an operation references an unknown session ID.
var ErrNotFound = errors.New("session not found")

// DataHandler receives a chunk of raw output bytes produced by a session's
// backend. The bytes are the terminal stream (including ANSI escape codes) and
// should be forwarded verbatim to the renderer.
type DataHandler func(id string, data []byte)

// ExitHandler is invoked once when a session's backend closes, either because
// the shell exited or the session was closed. err is nil on a clean EOF.
type ExitHandler func(id string, err error)

// Session couples a unique ID with a backend transport.
type Session struct {
	ID      string
	backend Backend

	mu     sync.Mutex
	closed bool
}

// Kind reports the transport kind backing the session.
func (s *Session) Kind() Kind { return s.backend.Kind() }

// Manager owns the lifecycle of all live sessions and fans their output out to
// the registered handlers. It is safe for concurrent use.
type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session

	onData DataHandler
	onExit ExitHandler
}

// NewManager creates an empty session manager.
func NewManager() *Manager {
	return &Manager{sessions: make(map[string]*Session)}
}

// SetHandlers registers the callbacks used to deliver output and exit
// notifications. It must be called before any session is created.
func (m *Manager) SetHandlers(onData DataHandler, onExit ExitHandler) {
	m.onData = onData
	m.onExit = onExit
}

// CreateLocal starts a local shell session and begins pumping its output to the
// data handler. It returns the new session's ID.
func (m *Manager) CreateLocal(cfg LocalConfig) (string, error) {
	backend, err := newLocalBackend(cfg)
	if err != nil {
		return "", err
	}
	return m.register(backend), nil
}

// register stores a backend as a session and starts its read loop.
func (m *Manager) register(backend Backend) string {
	s := &Session{ID: uuid.NewString(), backend: backend}

	m.mu.Lock()
	m.sessions[s.ID] = s
	m.mu.Unlock()

	go m.readLoop(s)
	return s.ID
}

// readLoop continuously reads from the backend and forwards output until the
// stream ends, then emits an exit event and removes the session.
func (m *Manager) readLoop(s *Session) {
	buf := make([]byte, 32*1024)
	var exitErr error
	for {
		n, err := s.backend.Read(buf)
		if n > 0 && m.onData != nil {
			// Copy: buf is reused on the next iteration.
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			m.onData(s.ID, chunk)
		}
		if err != nil {
			if !isCleanEOF(err) {
				exitErr = err
			}
			break
		}
	}

	m.mu.Lock()
	delete(m.sessions, s.ID)
	m.mu.Unlock()

	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()

	if m.onExit != nil {
		m.onExit(s.ID, exitErr)
	}
}

// Write sends user input to the session's backend.
func (m *Manager) Write(id string, data []byte) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	_, err = s.backend.Write(data)
	return err
}

// Resize updates the terminal dimensions of a session.
func (m *Manager) Resize(id string, cols, rows uint16) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	return s.backend.Resize(cols, rows)
}

// Close terminates a single session. The read loop will emit the exit event and
// remove it from the registry.
func (m *Manager) Close(id string) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	closed := s.closed
	s.mu.Unlock()
	if closed {
		return nil
	}
	return s.backend.Close()
}

// CloseAll terminates every live session. Used on application shutdown.
func (m *Manager) CloseAll() {
	m.mu.RLock()
	sessions := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	m.mu.RUnlock()

	for _, s := range sessions {
		_ = s.backend.Close()
	}
}

func (m *Manager) get(id string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return s, nil
}
