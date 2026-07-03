//go:build !windows

package session

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// unixBackend runs the system shell attached to a Unix pseudo-terminal
// (Linux, macOS, BSD) via creack/pty.
type unixBackend struct {
	ptmx *os.File
	cmd  *exec.Cmd
}

// newLocalBackend spawns a shell inside a fresh PTY and returns it as a Backend.
func newLocalBackend(cfg LocalConfig) (Backend, error) {
	shell := cfg.Shell
	if shell == "" {
		shell = defaultShell()
	}

	cmd := exec.Command(shell, cfg.Args...)
	cmd.Env = buildEnv(cfg.Env)
	cmd.Dir = resolveCwd(cfg.Cwd)

	var (
		ptmx *os.File
		err  error
	)
	if cfg.Cols > 0 && cfg.Rows > 0 {
		ptmx, err = pty.StartWithSize(cmd, &pty.Winsize{Cols: cfg.Cols, Rows: cfg.Rows})
	} else {
		ptmx, err = pty.Start(cmd)
	}
	if err != nil {
		return nil, fmt.Errorf("start shell %q: %w", shell, err)
	}

	return &unixBackend{ptmx: ptmx, cmd: cmd}, nil
}

func (b *unixBackend) Read(p []byte) (int, error)  { return b.ptmx.Read(p) }
func (b *unixBackend) Write(p []byte) (int, error) { return b.ptmx.Write(p) }
func (b *unixBackend) Kind() Kind                  { return KindLocal }

func (b *unixBackend) Resize(cols, rows uint16) error {
	return pty.Setsize(b.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

// Close releases the PTY and reaps the shell process so it does not linger.
func (b *unixBackend) Close() error {
	err := b.ptmx.Close()
	if b.cmd != nil && b.cmd.Process != nil {
		_ = b.cmd.Process.Kill()
		_, _ = b.cmd.Process.Wait()
	}
	return err
}
