package session

import (
	"fmt"
	"io"
	"net"
	"time"
)

// Telnet command bytes (RFC 854 / 1073).
const (
	tnIAC  = 255
	tnDONT = 254
	tnDO   = 253
	tnWONT = 252
	tnWILL = 251
	tnSB   = 250
	tnSE   = 240
	tnNAWS = 31 // Negotiate About Window Size (RFC 1073)
)

// TelnetConfig describes an outbound Telnet connection, typically to network
// equipment (switches, routers, console servers).
type TelnetConfig struct {
	Host       string
	Port       int
	Cols, Rows uint16
}

// telnetBackend speaks enough of the Telnet protocol to give a usable
// interactive session: it strips IAC control sequences from the incoming
// stream, refuses server option requests it does not implement, and reports
// the window size via NAWS.
type telnetBackend struct {
	conn net.Conn
	pr   *io.PipeReader
}

func newTelnetBackend(cfg TelnetConfig) (Backend, error) {
	port := cfg.Port
	if port == 0 {
		port = 23
	}
	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", port))

	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("telnet dial %s: %w", addr, err)
	}

	pr, pw := io.Pipe()
	b := &telnetBackend{conn: conn, pr: pr}

	// Advertise that we will report our window size.
	_, _ = conn.Write([]byte{tnIAC, tnWILL, tnNAWS})
	if cfg.Cols > 0 && cfg.Rows > 0 {
		_ = b.Resize(cfg.Cols, cfg.Rows)
	}

	go b.readLoop(pw)
	return b, nil
}

// readLoop consumes the raw connection, handles IAC negotiation in-line and
// forwards clean application bytes to the pipe the terminal reads from.
func (b *telnetBackend) readLoop(pw *io.PipeWriter) {
	buf := make([]byte, 4096)
	out := make([]byte, 0, 4096)
	for {
		n, err := b.conn.Read(buf)
		if n > 0 {
			out = out[:0]
			for i := 0; i < n; i++ {
				if buf[i] != tnIAC {
					out = append(out, buf[i])
					continue
				}
				// Consume the IAC command, reading more bytes if the sequence
				// straddles the buffer boundary.
				i = b.handleIAC(buf, n, i)
			}
			if len(out) > 0 {
				if _, werr := pw.Write(out); werr != nil {
					break
				}
			}
		}
		if err != nil {
			_ = pw.CloseWithError(err)
			return
		}
	}
	_ = pw.Close()
}

// handleIAC processes one IAC sequence starting at index i (buf[i]==tnIAC) and
// returns the index of the last byte consumed. It reads extra bytes from the
// connection when a command's operand is not yet buffered.
func (b *telnetBackend) handleIAC(buf []byte, n, i int) int {
	next := func(idx int) (byte, int) {
		if idx+1 < n {
			return buf[idx+1], idx + 1
		}
		var one [1]byte
		if _, err := io.ReadFull(b.conn, one[:]); err != nil {
			return 0, idx
		}
		return one[0], idx
	}

	cmd, i := next(i)
	switch cmd {
	case tnIAC:
		// Escaped 0xFF literal — but we drop it here to keep control data out
		// of the terminal; devices rarely send a literal 0xFF as text.
		return i
	case tnWILL, tnWONT:
		opt, i := next(i)
		// Refuse whatever the server offers to do.
		_, _ = b.conn.Write([]byte{tnIAC, tnDONT, opt})
		return i
	case tnDO, tnDONT:
		opt, i := next(i)
		// We only agree to NAWS; refuse everything else.
		if cmd == tnDO && opt == tnNAWS {
			_, _ = b.conn.Write([]byte{tnIAC, tnWILL, tnNAWS})
		} else {
			_, _ = b.conn.Write([]byte{tnIAC, tnWONT, opt})
		}
		return i
	case tnSB:
		// Skip the sub-negotiation payload up to IAC SE.
		var prev byte
		for {
			c, ni := next(i)
			i = ni
			if prev == tnIAC && c == tnSE {
				break
			}
			prev = c
		}
		return i
	default:
		return i
	}
}

func (b *telnetBackend) Read(p []byte) (int, error) { return b.pr.Read(p) }

// Write forwards user input, doubling any literal 0xFF so it is not mistaken
// for an IAC command.
func (b *telnetBackend) Write(p []byte) (int, error) {
	if indexByte(p, tnIAC) < 0 {
		return b.conn.Write(p)
	}
	escaped := make([]byte, 0, len(p)+4)
	for _, c := range p {
		escaped = append(escaped, c)
		if c == tnIAC {
			escaped = append(escaped, tnIAC)
		}
	}
	if _, err := b.conn.Write(escaped); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (b *telnetBackend) Kind() Kind { return KindTelnet }

// Resize sends the NAWS sub-negotiation with the new window dimensions.
func (b *telnetBackend) Resize(cols, rows uint16) error {
	// IAC SB NAWS <col-hi> <col-lo> <row-hi> <row-lo> IAC SE, with 0xFF doubled.
	payload := []byte{
		byte(cols >> 8), byte(cols & 0xff),
		byte(rows >> 8), byte(rows & 0xff),
	}
	msg := []byte{tnIAC, tnSB, tnNAWS}
	for _, c := range payload {
		msg = append(msg, c)
		if c == tnIAC {
			msg = append(msg, tnIAC)
		}
	}
	msg = append(msg, tnIAC, tnSE)
	_, err := b.conn.Write(msg)
	return err
}

func (b *telnetBackend) Close() error {
	_ = b.pr.Close()
	return b.conn.Close()
}

// indexByte reports the first index of c in p, or -1.
func indexByte(p []byte, c byte) int {
	for i := range p {
		if p[i] == c {
			return i
		}
	}
	return -1
}
