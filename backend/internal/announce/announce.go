package announce

import (
	"sync"
	"time"
)

// ponytail: in-memory store — hilang saat restart. Upgrade path: persist ke
// tabel announcements bila perlu survive restart.

// Entry is one announcement per ujian.
type Entry struct {
	ID      string `json:"id"`
	Message string `json:"message"`
	At      string `json:"at"`
}

var (
	mu    sync.RWMutex
	store = map[string]Entry{} // ujianID → latest announcement
	seq   int
)

// Set stores the latest announcement for an ujian. Returns the entry.
func Set(ujianID, message string) Entry {
	mu.Lock()
	defer mu.Unlock()
	seq++
	e := Entry{
		ID:      ujianID,
		Message: message,
		At:      time.Now().UTC().Format(time.RFC3339),
	}
	store[ujianID] = e
	return e
}

// Get returns the latest announcement or an empty-message entry.
func Get(ujianID string) Entry {
	mu.RLock()
	defer mu.RUnlock()
	if e, ok := store[ujianID]; ok {
		return e
	}
	return Entry{Message: ""}
}
