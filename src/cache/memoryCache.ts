interface CacheEntry<TValue> {
  expiresAt: number
  value: TValue
}

const cacheStore = new Map<string, CacheEntry<unknown>>()
const pendingRequests = new Map<string, Promise<unknown>>()

function isExpired(entry: CacheEntry<unknown>) {
  return Date.now() > entry.expiresAt
}

export function getCachedValue<TValue>(key: string): TValue | null {
  const entry = cacheStore.get(key)

  if (!entry) {
    return null
  }

  if (isExpired(entry)) {
    cacheStore.delete(key)
    return null
  }

  return entry.value as TValue
}

export function setCachedValue<TValue>(key: string, value: TValue, ttlMs: number) {
  cacheStore.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  })
}

export function clearCachedValue(key: string) {
  cacheStore.delete(key)
  pendingRequests.delete(key)
}

export async function getOrCreateCachedValue<TValue>(
  key: string,
  ttlMs: number,
  factory: () => Promise<TValue>,
): Promise<TValue> {
  const cachedValue = getCachedValue<TValue>(key)

  if (cachedValue !== null) {
    return cachedValue
  }

  const pendingRequest = pendingRequests.get(key)

  if (pendingRequest) {
    return pendingRequest as Promise<TValue>
  }

  const nextRequest = factory()
    .then((value) => {
      setCachedValue(key, value, ttlMs)
      return value
    })
    .finally(() => {
      pendingRequests.delete(key)
    })

  pendingRequests.set(key, nextRequest)

  return nextRequest
}
