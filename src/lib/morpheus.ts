export type Workload = { insert: number; lookup: number; range: number; del: number; n: number; ordered: boolean; memoryTight: boolean };

export type Candidate = { id: string; name: string; cost: number; memory: number; notes: string; ops: Record<string, string> };

const L = (n: number) => Math.log2(Math.max(2, n));

export function synthesize(w: Workload): Candidate[] {
  const t = w.insert + w.lookup + w.range + w.del || 1;
  const f = { i: w.insert / t, l: w.lookup / t, r: w.range / t, d: w.del / t };
  const lg = L(w.n);
  const list: Candidate[] = [
    { id: "hash", name: "Open-addressing hash map", memory: 1.6,
      cost: f.i * 1.2 + f.l * 1 + f.d * 1.3 + f.r * w.n * 0.02 + (w.ordered ? 40 : 0),
      notes: "Fastest point lookups; range queries require full scan.", ops: { insert: "O(1)", lookup: "O(1)", range: "O(n)", delete: "O(1)" } },
    { id: "btree", name: "Cache-aware B+ tree (fanout 64)", memory: 1.2,
      cost: f.i * lg * 0.35 + f.l * lg * 0.3 + f.r * (lg * 0.3 + 2) + f.d * lg * 0.4,
      notes: "Sorted leaves make range scans sequential and cache-friendly.", ops: { insert: "O(log n)", lookup: "O(log n)", range: "O(log n + k)", delete: "O(log n)" } },
    { id: "skiplist", name: "Lock-free skip list", memory: 2.1,
      cost: f.i * lg * 0.6 + f.l * lg * 0.6 + f.r * (lg * 0.6 + 4) + f.d * lg * 0.6,
      notes: "Good for concurrent writers; more pointer chasing.", ops: { insert: "O(log n)", lookup: "O(log n)", range: "O(log n + k)", delete: "O(log n)" } },
    { id: "hybrid", name: "Hash index + sorted array (LSM-style)", memory: 1.9,
      cost: f.i * 1.5 + f.l * 1.1 + f.r * (lg * 0.25 + 1.5) + f.d * 2.2,
      notes: "Hash for point access, batched sorted runs for ranges.", ops: { insert: "O(1) amort.", lookup: "O(1)", range: "O(log n + k)", delete: "O(log n)" } },
  ];
  return list
    .map((c) => ({ ...c, cost: +(c.cost * (w.memoryTight ? c.memory : 1)).toFixed(2) }))
    .sort((a, b) => a.cost - b.cost);
}

export function generateCpp(c: Candidate, w: Workload): string {
  const head = `// MORPHEUS synthesized structure: ${c.name}\n// workload: n=${w.n.toLocaleString()} insert=${w.insert}% lookup=${w.lookup}% range=${w.range}% delete=${w.del}%\n#include <cstdint>\n#include <vector>\n`;
  const body: Record<string, string> = {
    hash: `#include <optional>\n\ntemplate <class K, class V>\nclass Store {\n  std::vector<std::pair<K, V>> slots_;\n  std::vector<uint8_t> used_;\npublic:\n  explicit Store(size_t cap = ${Math.ceil(w.n * 1.6)}) : slots_(cap), used_(cap) {}\n  void insert(const K& k, const V& v);\n  std::optional<V> find(const K& k) const;\n  bool erase(const K& k);\n};`,
    btree: `#include <array>\n\ntemplate <class K, class V, int F = 64>\nclass Store {\n  struct Leaf { std::array<K, F> keys; std::array<V, F> vals; Leaf* next; int size; };\npublic:\n  void insert(const K& k, const V& v);\n  const V* find(const K& k) const;\n  template <class Fn> void range(const K& lo, const K& hi, Fn&& fn) const;\n  bool erase(const K& k);\n};`,
    skiplist: `#include <atomic>\n\ntemplate <class K, class V, int MaxLevel = ${Math.ceil(L(w.n))}>\nclass Store {\n  struct Node { K key; V val; std::atomic<Node*> next[MaxLevel]; };\npublic:\n  bool insert(const K& k, const V& v);\n  const V* find(const K& k) const;\n  template <class Fn> void range(const K& lo, const K& hi, Fn&& fn) const;\n  bool erase(const K& k);\n};`,
    hybrid: `#include <unordered_map>\n#include <algorithm>\n\ntemplate <class K, class V>\nclass Store {\n  std::unordered_map<K, V> index_;\n  std::vector<std::vector<K>> runs_;\npublic:\n  void insert(const K& k, const V& v);\n  const V* find(const K& k) const;\n  template <class Fn> void range(const K& lo, const K& hi, Fn&& fn) const;\n  bool erase(const K& k);\n  void compact();\n};`,
  };
  return head + body[c.id];
}
