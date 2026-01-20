import { useEffect, useState } from 'react'
import './App.css'

const PAGE_SIZE = 20

const  API_BASE =  import.meta.env.VITE_BACKEND_URL


function App() {
  const [bootLoading, setBootLoading] = useState(false)
  const [bootMessage, setBootMessage] = useState('')
  const [simLoading, setSimLoading] = useState(false)
  const [simMessage, setSimMessage] = useState('')
  const [error, setError] = useState('')

  const [leaderboard, setLeaderboard] = useState([])
  const [page, setPage] = useState(1)
  const [boardLoading, setBoardLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  const loadLeaderboard = async (pageToLoad = page) => {
    try {
      setBoardLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(PAGE_SIZE),
      })
      const res = await fetch(`${API_BASE}/api/leadboard?${params.toString()}`)
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load leaderboard')
      }
      setLeaderboard(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBoardLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard(1)
  }, [])

  const runBootstrapUsers = async () => {
    try {
      setBootLoading(true)
      setBootMessage('')
      setError('')

      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to bootstrap Redis')
      }

      setBootMessage(data.message || 'Redis bootstrap completed')
      loadLeaderboard(1)
      setPage(1)
      setTimeout(() => setBootMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBootLoading(false)
    }
  }

  const runSimulation = async () => {
    try {
      setSimLoading(true)
      setSimMessage('')
      setError('')

      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Simulation failed')
      }

      setSimMessage(data.message || 'Simulation completed')
      loadLeaderboard(page)
      setTimeout(() => setSimMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSimLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    try {
      setSearchLoading(true)
      setError('')
      setShowSearchModal(true)
      const params = new URLSearchParams({ username: search.trim() })
      const url = `${API_BASE}/api/username?${params.toString()}`
      
      const res = await fetch(url)
      
      if (!res.ok) {
        const text = await res.text()
        console.log('Error response body:', text)
        let errorData = {}
        try {
          errorData = JSON.parse(text)
        } catch (e) {
          // Not JSON, use text as error message
        }
        throw new Error(errorData.error || `Search failed: ${res.status} ${res.statusText}`)
      }
      
      // Check if response has content
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        throw new Error('Server returned non-JSON response')
      }
      
      const text = await res.text()
      
      if (!text || text.trim() === '') {
        console.log('Empty response body, using empty array')
        setSearchResults([])
        return
      }
      
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error('JSON parse error:', e)
        console.error('Response text was:', text)
        throw new Error('Invalid JSON response from server')
      }
      
   
      
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', data)
        setSearchResults([])
        setError('Invalid response format from server')
        return
      }
      
      setSearchResults(data)
      if (data.length === 0) {
        console.log('No results found for query:', search.trim())
      }
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'Something went wrong')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const hasNextPage = leaderboard.length === PAGE_SIZE

  return (
    <div className="app-root">
      <div className="app-backdrop" />

      <div className="app-shell">
        <header className="app-header">
          <div className="app-title-block">
            <h1 className="app-title">Leaderboard Dashboard</h1>
            <p className="app-subtitle">
              Bootstrap users, browse the leaderboard, search by username and run simulations.
            </p>
          </div>

          <div className="app-actions">
            <button
              className="btn btn-secondary"
              onClick={runBootstrapUsers}
              disabled={bootLoading}
            >
              {bootLoading ? 'Bootstrapping…' : 'Bootstrap Users'}
            </button>
            <button
              className="btn btn-primary"
              onClick={runSimulation}
              disabled={simLoading}
            >
              {simLoading ? 'Running…' : 'Run Simulation'}
            </button>
          </div>
        </header>

        {(bootMessage || simMessage || error) && (
          <div className="status-row">
            {bootMessage && <div className="status status-info">{bootMessage}</div>}
            {simMessage && <div className="status status-success">{simMessage}</div>}
            {error && <div className="status status-error">{error}</div>}
          </div>
        )}

        <div className="top-row">
          <section className="card card-search">
            <h2 className="card-title">Search user</h2>
            <p className="card-caption">
            </p>
            <div className="search-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a username or prefix…"
                className="search-input"
              />
              <button
                className="btn btn-outline"
                onClick={handleSearch}
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            <div className="search-results">
              {searchResults.map((u) => (
                <div key={u.username} className="search-result">
                  <div className="search-main">
                    <span className="search-username">{u.username}</span>
                    <span className="search-rank">#{u.rank}</span>
                  </div>
                  <span className="search-rating">{u.rating} pts</span>
                </div>
              ))}
              {search && !searchLoading && searchResults.length === 0 && (
                <p className="empty-text">No users found.</p>
              )}
            </div>
          </section>

          <section className="card card-info">
            <h2 className="card-title">How it works</h2>
            <p className="card-body">
              <strong>Bootstrap Users</strong> copies data from Postgres into a Redis sorted set
              called <code>leaderboard</code>, and creates prefix sets for fast search.
            </p>
            <p className="card-body">
              <strong>Run Simulation</strong> randomly updates ratings for many users and writes
              them back to Postgres in the background, letting you see the board evolve.
            </p>
          </section>
        </div>

        <section className="card card-table">
          <div className="table-header">
            <div>
              <h2 className="card-title">Leaderboard</h2>
              <p className="card-caption">Served by `/api/leadboard?page=&limit=` from Redis.</p>
            </div>
            <div className="pager">
              <button
                className="btn btn-ghost"
                disabled={page === 1 || boardLoading}
                onClick={() => {
                  const next = Math.max(1, page - 1)
                  setPage(next)
                  loadLeaderboard(next)
                }}
              >
                Previous
              </button>
              <span className="pager-page">Page {page}</span>
              <button
                className="btn btn-ghost"
                disabled={!hasNextPage || boardLoading}
                onClick={() => {
                  if (!hasNextPage || boardLoading) return
                  const next = page + 1
                  setPage(next)
                  loadLeaderboard(next)
                }}
              >
                Next
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Username</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {boardLoading ? (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      Loading leaderboard…
                    </td>
                  </tr>
                ) : leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      No data yet. Use the bootstrap button to load users into Redis.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((user) => {
                    const isTop3 = user.rank <= 3
                    return (
                      <tr
                        key={user.username}
                        className={isTop3 ? `row-top-${user.rank}` : undefined}
                      >
                        <td>#{user.rank}</td>
                        <td>{user.username}</td>
                        <td>{user.rating}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="app-footer">
          <span>Backend: Gin + Postgres + Redis · Frontend: React (JSX) + Vite + CSS</span>
        </footer>
      </div>

      {showSearchModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowSearchModal(false)
            setSearchResults([])
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Search results for “{search}”</h3>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchResults([])
                  setSearch('')
                }}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              {searchLoading ? (
                <p className="empty-text">Searching…</p>
              ) : error ? (
                <div>
                  <p className="empty-text" style={{ color: '#ef4444' }}>Error: {error}</p>
                  <p className="empty-text" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Check browser console for details.
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <p className="empty-text">No users found for "{search}".</p>
              ) : (
                <>
                  <p style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.map((u) => (
                    <div key={u.username} className="search-result modal-result">
                      <div className="search-main">
                        <span className="search-username">{u.username}</span>
                        <span className="search-rank">#{u.rank}</span>
                      </div>
                      <span className="search-rating">{u.rating} pts</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App