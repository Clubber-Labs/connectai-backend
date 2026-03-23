export const createEventSchema = {
  body: {
    type: 'object',
    required: [
      'title',
      'description',
      'date',
      'latitude',
      'longitude',
      'category',
    ],
    propertiesc: {
      title: { type: 'string' },
      description: { type: 'string' },
      date: { type: 'string', format: 'date-time' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      category: { type: 'string' },
      isPublic: { type: 'boolean' },
    },
  },
} as const

export const updateEventSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      date: { type: 'string', format: 'date-time' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      category: { type: 'string' },
      isPublic: { type: 'boolean' },
    },
  },
} as const

export const eventParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
} as const
