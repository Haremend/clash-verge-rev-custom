import * as yaml from 'js-yaml'
import { useCallback } from 'react'

import { useProfiles } from '@/hooks/use-profiles'
import { useAppRefreshers } from '@/providers/app-data-context'
import { readProfileFile, saveProfileFile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { parseYamlSafe } from '@/utils/yaml'

const MUTATE_ID = 'remove-proxy-node'

const toEntryList = (value: unknown): unknown[] =>
  Array.isArray(value) ? [...value] : []

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const entryName = (entry: unknown): string | undefined => {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object' && 'name' in entry) {
    const { name } = entry as { name?: unknown }
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

const withoutEntryNamed = (list: unknown[], name: string) =>
  list.filter((entry) => entryName(entry) !== name)

/**
 * Removes one node from the active profile.
 *
 * Nodes declared through the profile proxies chain are dropped from its
 * prepend/append lists. Nodes that come from the subscription itself are
 * filtered out by adding the name to the chain delete list. Saving the file
 * makes the backend rebuild the runtime config and reload the core.
 */
export const useRemoveProxyNode = () => {
  const { current } = useProfiles()
  const { refreshProxy } = useAppRefreshers()
  const proxiesUid = current?.option?.proxies ?? ''

  const removeNode = useCallback(
    async (name: string) => {
      if (!name) return false

      if (!proxiesUid) {
        showNotice.error('proxies.page.feedback.errors.proxyListUnavailable')
        return false
      }

      try {
        const parsed = parseYamlSafe(await readProfileFile(proxiesUid))
        if (parsed === undefined) {
          showNotice.error('proxies.page.feedback.errors.proxyListReadFailed')
          return false
        }

        const source = (parsed ?? {}) as Record<string, unknown>
        const prepend = toEntryList(source.prepend)
        const append = toEntryList(source.append)
        const deleteList = toStringList(source.delete)
        const nextPrepend = withoutEntryNamed(prepend, name)
        const nextAppend = withoutEntryNamed(append, name)
        const removedFromChain =
          nextPrepend.length !== prepend.length ||
          nextAppend.length !== append.length

        if (!removedFromChain && deleteList.includes(name)) {
          return true
        }

        const nextData = yaml.dump(
          {
            prepend: nextPrepend,
            append: nextAppend,
            delete: removedFromChain ? deleteList : [...deleteList, name],
          },
          { forceQuotes: true },
        )

        const result = await mutate(
          () => saveProfileFile(proxiesUid, nextData),
          { id: MUTATE_ID, errorNotice: false },
        )
        if (!result.ok || result.value !== true) return false

        await refreshProxy().catch((error) => {
          console.error('[useRemoveProxyNode] refresh proxy view failed', error)
        })
        showNotice.success('proxies.page.feedback.notifications.nodeRemoved', {
          name,
        })
        return true
      } catch (error) {
        showNotice.error(error)
        return false
      }
    },
    [proxiesUid, refreshProxy],
  )

  return { removeNode }
}
