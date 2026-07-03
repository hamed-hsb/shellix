//go:build windows

package session

import "os"

// defaultShell prefers PowerShell on Windows and falls back to the classic
// command interpreter pointed to by %COMSPEC% (usually cmd.exe).
func defaultShell() string {
	if _, err := os.Stat(`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`); err == nil {
		return "powershell.exe"
	}
	if comspec := os.Getenv("COMSPEC"); comspec != "" {
		return comspec
	}
	return "cmd.exe"
}
