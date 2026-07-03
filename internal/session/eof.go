package session

import (
	"errors"
	"io"
	"strings"
)

// isCleanEOF reports whether a read error represents a normal end of the
// terminal stream rather than a real failure. When a shell exits, the PTY
// master read returns io.EOF on Unix, and on some platforms an OS-specific
// "input/output error" once the slave side is gone. ConPTY on Windows may
// surface a closed-handle error. All of these are expected terminations.
func isCleanEOF(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, io.EOF) {
		return true
	}
	msg := err.Error()
	for _, s := range []string{
		"input/output error", // Linux PTY master after slave close
		"file already closed",
		"EOF",
	} {
		if strings.Contains(msg, s) {
			return true
		}
	}
	return false
}
