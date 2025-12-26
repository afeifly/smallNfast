package txtstore

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var (
	mu sync.Mutex
)

// GetStoreFile returns the absolute path to recipients.txt
func GetStoreFile() string {
	exe, err := os.Executable()
	if err != nil {
		return "recipients.txt"
	}
	return filepath.Join(filepath.Dir(exe), "recipients.txt")
}

// LoadRecipients reads all non-empty lines from the file
func LoadRecipients() ([]string, error) {
	mu.Lock()
	defer mu.Unlock()

	path := GetStoreFile()
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var recipients []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			recipients = append(recipients, line)
		}
	}
	return recipients, scanner.Err()
}

// AddRecipient appends a new number to the file
func AddRecipient(number string) error {
	mu.Lock()
	defer mu.Unlock()

	number = strings.TrimSpace(number)
	if number == "" {
		return fmt.Errorf("empty number")
	}

	path := GetStoreFile()

	// Check duplicates first (simple check)
	current, _ := readLines(path)
	for _, num := range current {
		if num == number {
			return fmt.Errorf("number already exists")
		}
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.WriteString(number + "\n"); err != nil {
		return err
	}
	return nil
}

// DeleteRecipient removes a number by index (0-based) to match UI behavior
// or by value. Since UI uses ID/Index, we'll assume index for now or Value matching.
// Given the UI passed an ID (int64) before, and we don't have IDs in text file,
// we will rely on mapped slice index being the ID.
func DeleteRecipientByIndex(index int) error {
	mu.Lock()
	defer mu.Unlock()

	path := GetStoreFile()
	lines, err := readLines(path)
	if err != nil {
		return err
	}

	if index < 0 || index >= len(lines) {
		return fmt.Errorf("index out of range")
	}

	// Remove
	lines = append(lines[:index], lines[index+1:]...)

	return writeLines(path, lines)
}

// Helpers

func readLines(path string) ([]string, error) {
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines, scanner.Err()
}

func writeLines(path string, lines []string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	for _, line := range lines {
		if _, err := w.WriteString(line + "\n"); err != nil {
			return err
		}
	}
	return w.Flush()
}
