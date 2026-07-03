//go:build !windows

package session

import "os"

// defaultShell returns the user's preferred login shell on Unix-like systems,
// falling back through common locations when $SHELL is unset (e.g. minimal
// containers).
func defaultShell() string {
	if sh := os.Getenv("SHELL"); sh != "" {
		return sh
	}
	for _, candidate := range []string{"/bin/zsh", "/bin/bash", "/bin/sh"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "/bin/sh"
}
