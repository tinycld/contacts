import type { createCollection } from 'pbtsdb'
import type { CoreStores } from '~/lib/pocketbase'
import type { Schema } from '~/types/pbSchema'
import type { CalendarSchema } from './types'

type MergedSchema = Schema & CalendarSchema

export function registerCollections(
    _newCollection: ReturnType<typeof createCollection<MergedSchema>>,
    _coreStores: CoreStores
) {
    return {}
}
