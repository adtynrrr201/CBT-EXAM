package parser

import (
	"regexp"
	"strconv"
	"strings"
)

// Question represents a single parsed question from a .docx template.
type Question struct {
	Number     int
	Text       string
	Options    []Option
	Tags       map[string]string // e.g. "Bobot" → "10", "Kesulitan" → "mudah"
}

// Option is one choice (A, B, C, …). IsKey=true when the line ends with "*".
type Option struct {
	Label string // "A", "B", …
	Text  string
	IsKey bool
}

var (
	reQuestion = regexp.MustCompile(`^\s*(\d+)[.)]\s+(.+)`)
	reOption   = regexp.MustCompile(`^\s*([A-Z])[.)]\s+(.+)`)
	reTag      = regexp.MustCompile(`\[([^:\]]+):\s*([^\]]+)\]`)
)

// ParseLine classifies a single line from the extracted document.xml text.
// Returns (question, option, or nil) — caller accumulates into Questions.
//
// Supported formats (PRD §6.3 FR-SOAL-02):
//   "1. soal text"          → question
//   "A. pilihan text"       → option (trailing * = answer key)
//   "[Bobot: 10]" inside    → tag extracted from question/option text
//
// TODO: actual .docx parsing requires unzipping the file and reading
//       word/document.xml. This function handles the already-extracted
//       plain-text lines. Integrate with archive/zip for full pipeline.
func ParseLine(line string) (q *Question, o *Option) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return nil, nil
	}

	// Try option first (A-Z prefix) — checked before question because
	// a line like "1. A. ..." should not happen in valid templates.
	if m := reOption.FindStringSubmatch(trimmed); m != nil {
		text := m[2]
		isKey := strings.HasSuffix(strings.TrimSpace(text), "*")
		if isKey {
			text = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(text), "*"))
		}
		// strip tags from option text
		text = reTag.ReplaceAllString(text, "")
		text = strings.TrimSpace(text)
		return nil, &Option{Label: m[1], Text: text, IsKey: isKey}
	}

	// Try question
	if m := reQuestion.FindStringSubmatch(trimmed); m != nil {
		num, _ := strconv.Atoi(m[1])
		text := m[2]
		tags := extractTags(&text)
		return &Question{Number: num, Text: strings.TrimSpace(text), Tags: tags}, nil
	}

	return nil, nil
}

// extractTags pulls all [Key: Value] tags from s, removes them from s, and
// returns them as a map.
func extractTags(s *string) map[string]string {
	tags := make(map[string]string)
	matches := reTag.FindAllStringSubmatch(*s, -1)
	for _, m := range matches {
		tags[strings.TrimSpace(m[1])] = strings.TrimSpace(m[2])
	}
	*s = reTag.ReplaceAllString(*s, "")
	return tags
}
