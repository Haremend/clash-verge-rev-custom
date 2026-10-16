import type { ResolvedProxyMember } from '@/types/proxy-view'

/** Built-in proxies are created by the core and have no profile entry. */
const BUILT_IN_PROXY_NAMES = new Set([
  'DIRECT',
  'REJECT',
  'REJECT-DROP',
  'PASS',
  'COMPATIBLE',
])

/**
 * Only nodes owned by the profile proxies chain can be removed by name: the
 * chain delete list filters them out of `proxies` and of every group. Provider
 * nodes belong to their provider, and built-in nodes belong to the core.
 */
export const isRemovableProxyNode = (member: ResolvedProxyMember) =>
  member.kind === 'node' &&
  member.node.source.kind === 'core' &&
  !BUILT_IN_PROXY_NAMES.has(member.ref.name)
