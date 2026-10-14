package lockdown

// Lockdown thresholds (PRD §6.5 FR-EXEC-02).
const (
	WarnThreshold   = 3 // focus-lost count → FLAGGED + warning
	AutoSubmitThreshold = 5 // focus-lost count → AUTO_SUBMIT + VIOLATION
)

// Evaluate returns the action for the given focusLost count.
//
// Returns:
//   - "OK"          — below warning threshold
//   - "WARN"        — at or above WarnThreshold, below auto-submit
//   - "AUTO_SUBMIT" — at or above AutoSubmitThreshold
func Evaluate(focusLost int) string {
	switch {
	case focusLost >= AutoSubmitThreshold:
		return "AUTO_SUBMIT"
	case focusLost >= WarnThreshold:
		return "WARN"
	default:
		return "OK"
	}
}
