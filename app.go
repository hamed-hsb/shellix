package main

import (
	"context"
	"encoding/base64"

	"shellix/internal/config"
	"shellix/internal/session"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Event name prefixes emitted to the frontend. The full event name is the
// prefix joined with a session ID, e.g. "session:data:<id>".
const (
	evtDataPrefix = "session:data:"
	evtExitPrefix = "session:exit:"
)

// App is the Wails application context. Its exported methods are bound and made
// callable from the TypeScript frontend.
type App struct {
	ctx      context.Context
	sessions *session.Manager
	config   *config.Store
}

// NewApp creates a new App with an empty session manager and config store.
func NewApp() *App {
	store, err := config.NewStore()
	if err != nil {
		// A resolvable config path is best-effort; the frontend falls back to
		// in-memory defaults if persistence is unavailable.
		store = nil
	}
	return &App{sessions: session.NewManager(), config: store}
}

// startup wires the session manager's output/exit callbacks to Wails runtime
// events so the frontend can react to terminal activity.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.sessions.SetHandlers(
		func(id string, data []byte) {
			// Terminal output is raw bytes (UTF-8 plus ANSI escapes). Base64
			// keeps it intact across the JSON event boundary; the frontend
			// decodes and feeds the bytes straight to xterm.js.
			runtime.EventsEmit(ctx, evtDataPrefix+id, base64.StdEncoding.EncodeToString(data))
		},
		func(id string, err error) {
			msg := ""
			if err != nil {
				msg = err.Error()
			}
			runtime.EventsEmit(ctx, evtExitPrefix+id, msg)
		},
	)
}

// shutdown terminates all live sessions when the window closes.
func (a *App) shutdown(_ context.Context) {
	a.sessions.CloseAll()
}

// CreateSessionRequest carries the options for opening a new local terminal.
type CreateSessionRequest struct {
	Shell string `json:"shell"`
	Cwd   string `json:"cwd"`
	Cols  uint16 `json:"cols"`
	Rows  uint16 `json:"rows"`
}

// CreateLocalSession opens a local shell session and returns its ID. Output is
// delivered asynchronously via "session:data:<id>" events.
func (a *App) CreateLocalSession(req CreateSessionRequest) (string, error) {
	return a.sessions.CreateLocal(session.LocalConfig{
		Shell: req.Shell,
		Cwd:   req.Cwd,
		Cols:  req.Cols,
		Rows:  req.Rows,
	})
}

// SendInput forwards user keystrokes to a session. The data is a UTF-8 string as
// produced by xterm.js's onData handler.
func (a *App) SendInput(id string, data string) error {
	return a.sessions.Write(id, []byte(data))
}

// ResizeSession updates a session's terminal dimensions in character cells.
func (a *App) ResizeSession(id string, cols uint16, rows uint16) error {
	return a.sessions.Resize(id, cols, rows)
}

// CloseSession terminates a single session.
func (a *App) CloseSession(id string) error {
	return a.sessions.Close(id)
}

// GetConfig returns the persisted settings document, or an empty object when no
// settings file exists yet.
func (a *App) GetConfig() (config.Document, error) {
	if a.config == nil {
		return config.Document{}, nil
	}
	return a.config.Load()
}

// SaveConfig writes the settings document to disk as indented JSON.
func (a *App) SaveConfig(doc config.Document) error {
	if a.config == nil {
		return nil
	}
	return a.config.Save(doc)
}

// GetConfigPath returns the absolute path of the settings file so the UI can
// point users at the file they can hand-edit.
func (a *App) GetConfigPath() string {
	if a.config == nil {
		return ""
	}
	return a.config.Path()
}
