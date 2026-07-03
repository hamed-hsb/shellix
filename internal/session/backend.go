package session

import "io"

// Kind identifies the transport a session is connected to. Phase 1 ships the
// local shell; SSH, Telnet and Serial are introduced in later phases and plug
// in by implementing Backend.
type Kind string

const (
	KindLocal  Kind = "local"
	KindSSH    Kind = "ssh"
	KindTelnet Kind = "telnet"
	KindSerial Kind = "serial"
)

// Backend is a bidirectional byte stream that can be resized like a terminal.
// A local PTY, an SSH channel, a Telnet connection and a serial port all
// satisfy this interface, which lets the session Manager treat them uniformly.
type Backend interface {
	io.ReadWriteCloser

	// Resize informs the backend that the visible terminal is now cols x rows
	// character cells. Backends without a concept of window size may no-op.
	Resize(cols, rows uint16) error

	// Kind reports which transport this backend represents.
	Kind() Kind
}
