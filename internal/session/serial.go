package session

import "errors"

// ErrNotImplemented marks a backend that is scaffolded but not yet functional.
var ErrNotImplemented = errors.New("not implemented")

// SerialConfig describes a serial-port connection, used to talk to hardware
// such as microcontrollers, routers' console ports and embedded devices.
type SerialConfig struct {
	// Port is the OS device path, e.g. "/dev/ttyUSB0" or "COM3".
	Port string
	// Baud is the baud rate, e.g. 9600 or 115200.
	Baud int
	// DataBits, Parity ("N"/"E"/"O") and StopBits round out the line settings.
	DataBits int
	Parity   string
	StopBits int
}

// newSerialBackend is the Phase 3 extension point for serial connections.
//
// Implementing it means opening cfg.Port with the go.bug.st/serial library
// (cross-platform: Linux/macOS/Windows), then exposing Read/Write over the port
// and treating Resize as a no-op (serial links have no window size). The
// structure mirrors telnetBackend; only the transport differs.
func newSerialBackend(_ SerialConfig) (Backend, error) {
	return nil, ErrNotImplemented
}
