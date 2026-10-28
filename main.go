package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed web
var webFS embed.FS

// shortcut: score cap is a sanity check, not anti-cheat; re-simulate runs server-side if the board matters.
const maxScore = 100000

// keep in sync with MAX_INPUTS in web/game.js
const maxInputs = 5000

type score struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
	Daily bool   `json:"daily,omitempty"` // submit only
	Seed  int    `json:"seed,omitempty"`  // submit only, must match today's seed for daily runs
}

type ghost struct {
	Score  int             `json:"score"`
	Seed   int             `json:"seed"`
	Inputs json.RawMessage `json:"inputs"`
}

// the daily course is keyed to the UTC date, e.g. 2026-10-28 -> seed 20261028
func today() (day time.Time, seed int) {
	n := time.Now().UTC()
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC), n.Year()*10000 + int(n.Month())*100 + n.Day()
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// shortcut: one global write bucket for everyone, not per-IP; the real client IP behind a proxy is not trusted here.
// It protects the database from floods, not the leaderboard from fake scores.
func throttle(tokens chan struct{}, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-tokens:
			next(w, r)
		default:
			http.Error(w, "too many requests", http.StatusTooManyRequests)
		}
	}
}

// Neon suspends idle computes, so the first connection after a quiet period can take a few seconds
func waitForDB(ctx context.Context, db *sql.DB, total time.Duration) error {
	deadline := time.Now().Add(total)
	for {
		pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := db.PingContext(pctx)
		cancel()
		if err == nil {
			return nil
		}
		if ctx.Err() != nil || time.Now().After(deadline) {
			return fmt.Errorf("database not reachable: %w", err)
		}
		log.Println("waiting for database:", err)
		select {
		case <-time.After(2 * time.Second):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := sql.Open("pgx", env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dino?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	db.SetMaxOpenConns(10)
	db.SetConnMaxIdleTime(4 * time.Minute) // drop idle connections before Neon suspends the compute (~5 min) and kills them
	if err := waitForDB(ctx, db, 30*time.Second); err != nil {
		log.Fatal(err)
	}
	// shortcut: inline DDL, not a migration tool; add goose when the schema changes again.
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS scores (
			id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, score INTEGER NOT NULL)`,
		`ALTER TABLE scores ADD COLUMN IF NOT EXISTS daily DATE`,
		`CREATE TABLE IF NOT EXISTS ghosts (
			kind TEXT PRIMARY KEY, score INTEGER NOT NULL, seed INTEGER NOT NULL, inputs JSONB NOT NULL)`,
	} {
		if _, err := db.Exec(q); err != nil {
			log.Fatal(err)
		}
	}

	web, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	// ~10 writes/s sustained, bursts of 30
	tokens := make(chan struct{}, 30)
	for len(tokens) < cap(tokens) {
		tokens <- struct{}{}
	}
	go func() {
		t := time.NewTicker(100 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				select {
				case tokens <- struct{}{}:
				default:
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(web))
	// no DB call on purpose: a sleeping Neon must not make the platform health check fail and restart the service
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	mux.HandleFunc("GET /api/daily", func(w http.ResponseWriter, r *http.Request) {
		day, seed := today()
		writeJSON(w, map[string]any{"day": day.Format("2006-01-02"), "seed": seed})
	})

	mux.HandleFunc("GET /api/scores", func(w http.ResponseWriter, r *http.Request) {
		q, args := `SELECT name, score FROM scores WHERE daily IS NULL ORDER BY score DESC, id LIMIT 10`, []any{}
		if r.URL.Query().Get("daily") == "1" {
			day, _ := today()
			q, args = `SELECT name, score FROM scores WHERE daily = $1 ORDER BY score DESC, id LIMIT 10`, []any{day}
		}
		rows, err := db.Query(q, args...)
		if err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		out := []score{}
		for rows.Next() {
			var s score
			if err := rows.Scan(&s.Name, &s.Score); err != nil {
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
			out = append(out, s)
		}
		writeJSON(w, out)
	})

	mux.HandleFunc("POST /api/scores", throttle(tokens, func(w http.ResponseWriter, r *http.Request) {
		var s score
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&s); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		s.Name = strings.TrimSpace(s.Name)
		if len(s.Name) == 0 || len(s.Name) > 20 || s.Score < 0 || s.Score > maxScore {
			http.Error(w, "invalid score", http.StatusBadRequest)
			return
		}
		// the client never picks the day: daily runs must carry today's seed and are filed under today's date
		var daily any
		if s.Daily {
			day, seed := today()
			if s.Seed != seed {
				http.Error(w, "stale daily seed", http.StatusBadRequest)
				return
			}
			daily = day
		}
		var id int64
		if err := db.QueryRow(`INSERT INTO scores (name, score, daily) VALUES ($1, $2, $3) RETURNING id`, s.Name, s.Score, daily).Scan(&id); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// rank follows the leaderboard order (score DESC, id): count the rows that sort before this one
		var rank int
		if err := db.QueryRow(`SELECT COUNT(*) + 1 FROM scores
			WHERE daily IS NOT DISTINCT FROM $1::date AND (score > $2 OR (score = $2 AND id < $3))`,
			daily, s.Score, id).Scan(&rank); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]int{"rank": rank})
	}))

	// best run of today's daily course, replayed client-side as a ghost
	mux.HandleFunc("GET /api/ghost", func(w http.ResponseWriter, r *http.Request) {
		day, _ := today()
		var g ghost
		err := db.QueryRow(`SELECT score, seed, inputs FROM ghosts WHERE kind = $1`, "daily:"+day.Format("2006-01-02")).
			Scan(&g.Score, &g.Seed, &g.Inputs)
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(http.StatusNoContent) // not a 404: that logs a console error on every load until someone plays
			return
		}
		if err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, g)
	})

	mux.HandleFunc("POST /api/ghost", throttle(tokens, func(w http.ResponseWriter, r *http.Request) {
		var g struct {
			Score  int      `json:"score"`
			Seed   int      `json:"seed"`
			Inputs [][2]any `json:"inputs"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&g); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		day, seed := today()
		if g.Seed != seed || g.Score < 0 || g.Score > maxScore || len(g.Inputs) > maxInputs {
			http.Error(w, "invalid ghost", http.StatusBadRequest)
			return
		}
		// inputs are replayed in every visitor's browser, so only [frame, known command] pairs are stored
		for _, in := range g.Inputs {
			f, ok := in[0].(float64)
			c, ok2 := in[1].(string)
			if !ok || !ok2 || f < 0 || f != float64(int(f)) || (c != "jump" && c != "duckDown" && c != "duckUp") {
				http.Error(w, "invalid ghost", http.StatusBadRequest)
				return
			}
		}
		raw, _ := json.Marshal(g.Inputs)
		// only a higher score replaces the stored ghost
		if _, err := db.Exec(`INSERT INTO ghosts (kind, score, seed, inputs) VALUES ($1, $2, $3, $4)
			ON CONFLICT (kind) DO UPDATE SET score = EXCLUDED.score, seed = EXCLUDED.seed, inputs = EXCLUDED.inputs
			WHERE ghosts.score < EXCLUDED.score`,
			"daily:"+day.Format("2006-01-02"), g.Score, g.Seed, string(raw)); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	srv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() { // platforms send SIGTERM on deploy: finish in-flight requests, then exit
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(sctx)
	}()
	log.Println("listening on", srv.Addr)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	log.Println("shut down cleanly")
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
