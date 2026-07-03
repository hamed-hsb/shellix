package session

import "os"

// LocalConfig describes how to launch a local shell session.
type LocalConfig struct {
	// Shell is the executable to run. When empty, the OS default shell is used.
	Shell string
	// Args are extra arguments passed to the shell.
	Args []string
	// Cwd is the working directory the shell starts in. When empty, the user's
	// home directory is used.
	Cwd string
	// Env holds additional "KEY=VALUE" entries merged onto the process
	// environment.
	Env []string
	// Cols and Rows are the initial terminal dimensions in character cells.
	Cols, Rows uint16
}

// buildEnv merges the caller-supplied environment onto the current process
// environment and advertises a colour-capable terminal so programs emit ANSI
// styling by default.
func buildEnv(extra []string) []string {
	env := append(os.Environ(), "TERM=xterm-256color")
	return append(env, extra...)
}

// resolveCwd returns the requested working directory, falling back to the user's
// home directory and finally to an empty string (the process default).
func resolveCwd(cwd string) string {
	if cwd != "" {
		return cwd
	}
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return ""
}
