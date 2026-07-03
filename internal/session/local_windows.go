//go:build windows

package session

import (
	"context"
	"fmt"
	"strings"

	"github.com/UserExistsError/conpty"
)

// windowsBackend runs the system shell through the Windows pseudo-console
// (ConPTY), available on Windows 10 1809+ and Windows 11.
type windowsBackend struct {
	cpty *conpty.ConPty
}

// newLocalBackend spawns a shell inside a ConPTY and returns it as a Backend.
func newLocalBackend(cfg LocalConfig) (Backend, error) {
	shell := cfg.Shell
	if shell == "" {
		shell = defaultShell()
	}

	opts := []conpty.ConPtyOption{}
	if cfg.Cols > 0 && cfg.Rows > 0 {
		opts = append(opts, conpty.ConPtyDimensions(int(cfg.Cols), int(cfg.Rows)))
	}
	if cwd := resolveCwd(cfg.Cwd); cwd != "" {
		opts = append(opts, conpty.ConPtyWorkDir(cwd))
	}
	if env := buildEnv(cfg.Env); len(env) > 0 {
		opts = append(opts, conpty.ConPtyEnv(env))
	}

	cpty, err := conpty.Start(buildCommandLine(shell, cfg.Args), opts...)
	if err != nil {
		return nil, fmt.Errorf("start shell %q: %w", shell, err)
	}

	return &windowsBackend{cpty: cpty}, nil
}

// buildCommandLine assembles a Windows command line, quoting the executable path
// when it contains spaces.
func buildCommandLine(shell string, args []string) string {
	parts := make([]string, 0, len(args)+1)
	if strings.ContainsRune(shell, ' ') {
		parts = append(parts, `"`+shell+`"`)
	} else {
		parts = append(parts, shell)
	}
	parts = append(parts, args...)
	return strings.Join(parts, " ")
}

func (b *windowsBackend) Read(p []byte) (int, error)  { return b.cpty.Read(p) }
func (b *windowsBackend) Write(p []byte) (int, error) { return b.cpty.Write(p) }
func (b *windowsBackend) Kind() Kind                  { return KindLocal }

func (b *windowsBackend) Resize(cols, rows uint16) error {
	return b.cpty.Resize(int(cols), int(rows))
}

// Close terminates the ConPTY and its child process.
func (b *windowsBackend) Close() error {
	// Best-effort wait with an already-cancelled context so Close does not
	// block on a shell that ignores the hangup; the ConPTY is torn down
	// regardless.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, _ = b.cpty.Wait(ctx)
	return b.cpty.Close()
}
