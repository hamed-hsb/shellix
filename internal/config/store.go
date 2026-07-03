// Package config persists the application's JSON settings file on disk. The
// schema is owned by the frontend; the store treats the document as an opaque
// JSON object so new settings never require Go changes.
package config

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// Document is the decoded settings object exchanged with the frontend.
type Document map[string]interface{}

// Store reads and writes the settings file under the OS config directory,
// e.g. ~/.config/shellix/config.json on Linux.
type Store struct {
	path string
}

// NewStore resolves the settings path (creating no files yet).
func NewStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Store{path: filepath.Join(dir, "shellix", "config.json")}, nil
}

// Path returns the absolute path of the settings file so the UI can reveal it.
func (s *Store) Path() string { return s.path }

// Load reads and parses the settings file. A missing file is not an error: it
// returns an empty document so the frontend can fall back to its defaults.
func (s *Store) Load() (Document, error) {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Document{}, nil
		}
		return nil, err
	}
	if len(raw) == 0 {
		return Document{}, nil
	}
	var doc Document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	return doc, nil
}

// Save writes the document as indented JSON, creating the parent directory and
// replacing the file atomically to avoid corrupting it on a crash.
func (s *Store) Save(doc Document) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
