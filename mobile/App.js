import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'

// Set your backend base URL; override with EXPO_PUBLIC_API_BASE env if needed
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://matkis-assesment-2.onrender.com'

const fetchJson = async (url, options) => {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function App() {
  const [health, setHealth] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    pingHealth()
    loadLeaderboard(1)
  }, [])

  const pingHealth = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/health`)
      setHealth(data.status)
    } catch (err) {
      setHealth(`error: ${err.message}`)
    }
  }

  const loadLeaderboard = async (pageToLoad = page) => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchJson(`${API_BASE}/api/leadboard?page=${pageToLoad}&limit=20`)
      setLeaderboard(data)
      setPage(pageToLoad)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runBootstrap = async () => {
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const data = await fetchJson(`${API_BASE}/api/users`, { method: 'POST' })
      setMessage(data.message || 'Bootstrap completed')
      loadLeaderboard(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runSimulation = async () => {
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const data = await fetchJson(`${API_BASE}/api/simulate`, { method: 'POST' })
      setMessage(data.message || 'Simulation completed')
      loadLeaderboard(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runSearch = async () => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    try {
      setLoading(true)
      setError('')
      const data = await fetchJson(`${API_BASE}/api/username?username=${encodeURIComponent(search.trim())}`)
      if (Array.isArray(data)) {
        setSearchResults(data)
      } else {
        setSearchResults([])
        setError('Invalid response from server')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.rank}>#{item.rank}</Text>
      <Text style={styles.username}>{item.username}</Text>
      <Text style={styles.rating}>{item.rating}</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Leaderboard (Mobile)</Text>
        <Text style={styles.subtitle}>API: {API_BASE}</Text>
        <Text style={styles.subtitle}>Health: {health}</Text>

        <View style={styles.buttonRow}>
          <Button title="Bootstrap" onPress={runBootstrap} disabled={loading} />
          <Button title="Simulate" onPress={runSimulation} disabled={loading} />
          <Button title="Refresh" onPress={() => loadLeaderboard(page)} disabled={loading} />
        </View>

        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search username or prefix"
            placeholderTextColor="#888"
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={runSearch}
          />
          <Button title="Search" onPress={runSearch} disabled={loading} />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Leaderboard (page {page})</Text>
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.username}
          renderItem={renderUser}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.empty}>No data</Text>}
        />

        <View style={styles.buttonRow}>
          <Button title="Prev" onPress={() => loadLeaderboard(Math.max(1, page - 1))} disabled={loading || page === 1} />
          <Button title="Next" onPress={() => loadLeaderboard(page + 1)} disabled={loading || leaderboard.length < 20} />
        </View>

        {searchResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Search Results ({searchResults.length})</Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.username}
              renderItem={renderUser}
              scrollEnabled={false}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { color: '#9ca3af' },
  sectionTitle: { marginTop: 12, fontSize: 18, fontWeight: '600', color: '#e5e7eb' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  searchBox: { gap: 8 },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    borderColor: '#1f2937',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: '#1f2937',
    borderBottomWidth: 1,
  },
  rank: { color: '#a855f7', width: 60, fontWeight: '700' },
  username: { flex: 1, color: '#e5e7eb', fontSize: 16 },
  rating: { color: '#34d399', width: 80, textAlign: 'right', fontWeight: '700' },
  message: { color: '#22d3ee' },
  error: { color: '#f87171' },
  empty: { color: '#9ca3af', paddingVertical: 8 },
})

