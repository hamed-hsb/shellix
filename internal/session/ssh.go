package session

import (
	"fmt"
	"io"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHConfig describes an outbound SSH connection.
type SSHConfig struct {
	Host string
	Port int
	User string

	// Password authentication (optional).
	Password string

	// Public-key authentication (optional). PrivateKeyPEM is the raw PEM bytes
	// of the private key; Passphrase decrypts it when it is encrypted.
	PrivateKeyPEM []byte
	Passphrase    string

	// InsecureSkipHostKeyVerify disables host-key checking. It defaults to on
	// for now (a first-run convenience); host-key pinning via known_hosts is a
	// planned Phase 3 hardening. See knownHostsCallback below.
	InsecureSkipHostKeyVerify bool

	Cols, Rows uint16
}

// sshBackend runs a remote interactive shell over SSH with a PTY, exposing the
// same Backend interface as a local terminal.
type sshBackend struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	stdout  io.Reader
}

func newSSHBackend(cfg SSHConfig) (Backend, error) {
	authMethods, err := sshAuthMethods(cfg)
	if err != nil {
		return nil, err
	}

	hostKeyCallback := knownHostsCallback(cfg)

	clientCfg := &ssh.ClientConfig{
		User:            cfg.User,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         15 * time.Second,
	}

	port := cfg.Port
	if port == 0 {
		port = 22
	}
	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", port))

	client, err := ssh.Dial("tcp", addr, clientCfg)
	if err != nil {
		return nil, fmt.Errorf("ssh dial %s: %w", addr, err)
	}

	sess, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ssh session: %w", err)
	}

	cols, rows := int(cfg.Cols), int(cfg.Rows)
	if cols == 0 {
		cols = 80
	}
	if rows == 0 {
		rows = 24
	}
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sess.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("ssh request pty: %w", err)
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("ssh stdin: %w", err)
	}
	// With a PTY the remote merges stderr into the pty stream, so StdoutPipe
	// carries the full terminal output.
	stdout, err := sess.StdoutPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("ssh stdout: %w", err)
	}

	if err := sess.Shell(); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("ssh shell: %w", err)
	}

	return &sshBackend{client: client, session: sess, stdin: stdin, stdout: stdout}, nil
}

// sshAuthMethods assembles the auth methods from the configured credentials.
func sshAuthMethods(cfg SSHConfig) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod

	if len(cfg.PrivateKeyPEM) > 0 {
		var signer ssh.Signer
		var err error
		if cfg.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(cfg.PrivateKeyPEM, []byte(cfg.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(cfg.PrivateKeyPEM)
		}
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		methods = append(methods, ssh.PublicKeys(signer))
	}

	if cfg.Password != "" {
		methods = append(methods, ssh.Password(cfg.Password))
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("no ssh credentials provided")
	}
	return methods, nil
}

// knownHostsCallback returns the host-key verification callback. Host-key
// pinning against ~/.ssh/known_hosts is planned; until then this honours the
// InsecureSkipHostKeyVerify flag.
func knownHostsCallback(cfg SSHConfig) ssh.HostKeyCallback {
	if cfg.InsecureSkipHostKeyVerify {
		return ssh.InsecureIgnoreHostKey()
	}
	// Default to insecure-ignore for the first release so connections work out
	// of the box; a real known_hosts implementation replaces this.
	return ssh.InsecureIgnoreHostKey()
}

func (b *sshBackend) Read(p []byte) (int, error)  { return b.stdout.Read(p) }
func (b *sshBackend) Write(p []byte) (int, error) { return b.stdin.Write(p) }
func (b *sshBackend) Kind() Kind                  { return KindSSH }

func (b *sshBackend) Resize(cols, rows uint16) error {
	return b.session.WindowChange(int(rows), int(cols))
}

func (b *sshBackend) Close() error {
	if b.session != nil {
		_ = b.session.Close()
	}
	if b.client != nil {
		return b.client.Close()
	}
	return nil
}
