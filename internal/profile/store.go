// Package profile persists saved connection profiles (local/SSH/Telnet/Serial)
// as a JSON array on disk. As with settings, the profile schema is owned by the
// frontend; each entry is stored opaquely so new fields need no Go changes.
package profile

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// Profile is a single opaque saved connection.
type Profile = map[string]interface{}

// Store reads and writes the profiles file under the OS config directory,
// e.g. ~/.config/shellix/profiles.json on Linux.
type Store struct {
	path string
}

// NewStore resolves the profiles path (creating no files yet).
func NewStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Store{path: filepath.Join(dir, "shellix", "profiles.json")}, nil
}

// Path returns the absolute path of the profiles file.
func (s *Store) Path() string { return s.path }

// Load reads and parses the profiles list. A missing file yields an empty list.
func (s *Store) Load() ([]Profile, error) {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return []Profile{}, nil
		}
		return nil, err
	}
	if len(raw) == 0 {
		return []Profile{}, nil
	}
	var list []Profile
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	return list, nil
}

// Save writes the whole profiles list as indented JSON, replacing the file
// atomically.
func (s *Store) Save(list []Profile) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil { // 0600: may hold secrets
		return err
	}
	return os.Rename(tmp, s.path)
}
