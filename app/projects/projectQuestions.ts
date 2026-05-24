export type ProjectQuestion = {
  id: string
  label: string
  type: 'select' | 'text'
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

export const URGENCY_OPTIONS = [
  'Emergency / today',
  'Within 24 hours',
  'This week',
  'Next week',
  'Flexible',
]

export const TIMING_OPTIONS = [
  'As soon as possible',
  'Within a few days',
  'This week',
  'Next week',
  'Flexible',
]

export const MAX_PROJECT_ATTACHMENTS = 5
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

export const CATEGORY_QUESTIONS: Record<string, ProjectQuestion[]> = {
  Cleaning: [
    { id: 'frequency', label: 'How often?', type: 'select', options: [
      { label: 'Just once', value: 'once' },
      { label: 'Every week', value: 'weekly' },
      { label: 'Every 2 weeks', value: 'biweekly' },
      { label: 'Once a month', value: 'monthly' },
    ]},
    { id: 'bedrooms', label: 'Number of bedrooms', type: 'select', options: [
      { label: '1 bedroom', value: '1' },
      { label: '2 bedrooms', value: '2' },
      { label: '3 bedrooms', value: '3' },
      { label: '4 bedrooms', value: '4' },
      { label: '5+ bedrooms', value: '5+' },
    ]},
    { id: 'type', label: 'Cleaning type', type: 'select', options: [
      { label: 'Standard cleaning', value: 'standard' },
      { label: 'Deep cleaning', value: 'deep' },
      { label: 'Move-out cleaning', value: 'moveout' },
      { label: 'Post-construction', value: 'postconstruction' },
    ]},
  ],
  Plumbing: [
    { id: 'issue', label: 'Type of issue', type: 'select', options: [
      { label: 'Leak or drip', value: 'leak' },
      { label: 'Blocked drain', value: 'drain' },
      { label: 'No hot water', value: 'hotwater' },
      { label: 'New installation', value: 'install' },
      { label: 'Other', value: 'other' },
    ]},
    { id: 'urgency', label: 'Urgency', type: 'select', options: [
      { label: 'Emergency (ASAP)', value: 'emergency' },
      { label: 'Within 24 hours', value: '24h' },
      { label: 'Within a week', value: 'week' },
      { label: 'Flexible', value: 'flexible' },
    ]},
    { id: 'property', label: 'Property type', type: 'select', options: [
      { label: 'Apartment', value: 'apartment' },
      { label: 'House', value: 'house' },
      { label: 'Office / commercial', value: 'commercial' },
    ]},
  ],
  Electrical: [
    { id: 'work', label: 'Type of work', type: 'select', options: [
      { label: 'Fault finding / repair', value: 'repair' },
      { label: 'New socket or switch', value: 'socket' },
      { label: 'Lighting installation', value: 'lighting' },
      { label: 'Panel / fuse box', value: 'panel' },
      { label: 'Safety inspection', value: 'inspection' },
    ]},
    { id: 'urgency', label: 'Urgency', type: 'select', options: [
      { label: 'Emergency', value: 'emergency' },
      { label: 'Within 24 hours', value: '24h' },
      { label: 'This week', value: 'week' },
      { label: 'Flexible', value: 'flexible' },
    ]},
  ],
  Painting: [
    { id: 'area', label: 'What needs painting?', type: 'select', options: [
      { label: 'One room', value: 'room' },
      { label: 'Whole apartment', value: 'apartment' },
      { label: 'Exterior / facade', value: 'exterior' },
      { label: 'Furniture / cabinets', value: 'furniture' },
    ]},
    { id: 'size', label: 'Approximate area (m²)', type: 'text', placeholder: 'e.g. 40' },
  ],
  Carpentry: [
    { id: 'project', label: 'Project type', type: 'select', options: [
      { label: 'Furniture assembly', value: 'assembly' },
      { label: 'Custom furniture', value: 'custom' },
      { label: 'Door / window installation', value: 'door' },
      { label: 'Flooring', value: 'flooring' },
      { label: 'Other', value: 'other' },
    ]},
  ],
  HVAC: [
    { id: 'service', label: 'Service needed', type: 'select', options: [
      { label: 'AC installation', value: 'ac_install' },
      { label: 'AC repair / service', value: 'ac_repair' },
      { label: 'Boiler service', value: 'boiler' },
      { label: 'Heat pump', value: 'heatpump' },
      { label: 'Gas safety check', value: 'gas' },
    ]},
    { id: 'urgency', label: 'Urgency', type: 'select', options: [
      { label: 'Emergency', value: 'emergency' },
      { label: 'This week', value: 'week' },
      { label: 'This month', value: 'month' },
      { label: 'Flexible', value: 'flexible' },
    ]},
  ],
  Gardening: [
    { id: 'service', label: 'Service needed', type: 'select', options: [
      { label: 'Lawn mowing', value: 'mowing' },
      { label: 'Hedge trimming', value: 'hedge' },
      { label: 'Garden clearance', value: 'clearance' },
      { label: 'Planting / design', value: 'planting' },
      { label: 'Regular maintenance', value: 'maintenance' },
    ]},
    { id: 'frequency', label: 'How often?', type: 'select', options: [
      { label: 'One-off', value: 'once' },
      { label: 'Weekly', value: 'weekly' },
      { label: 'Fortnightly', value: 'fortnightly' },
      { label: 'Monthly', value: 'monthly' },
    ]},
  ],
  Moving: [
    { id: 'type', label: 'Move type', type: 'select', options: [
      { label: 'Studio / 1-bed', value: 'small' },
      { label: '2-3 bed apartment', value: 'medium' },
      { label: 'Large house', value: 'large' },
      { label: 'Single items', value: 'items' },
      { label: 'Office move', value: 'office' },
    ]},
    { id: 'distance', label: 'Distance', type: 'select', options: [
      { label: 'Within Budapest', value: 'local' },
      { label: 'Budapest to another city', value: 'national' },
      { label: 'International', value: 'international' },
    ]},
  ],
  Handyman: [
    { id: 'task', label: 'Task description', type: 'text', placeholder: 'e.g. fix a leaking tap, hang shelves...' },
    { id: 'urgency', label: 'Urgency', type: 'select', options: [
      { label: 'As soon as possible', value: 'asap' },
      { label: 'This week', value: 'week' },
      { label: 'Flexible', value: 'flexible' },
    ]},
  ],
  Photography: [
    { id: 'event', label: 'Event type', type: 'select', options: [
      { label: 'Wedding', value: 'wedding' },
      { label: 'Corporate / business', value: 'corporate' },
      { label: 'Portrait session', value: 'portrait' },
      { label: 'Real estate', value: 'realestate' },
      { label: 'Product / food', value: 'product' },
      { label: 'Other', value: 'other' },
    ]},
    { id: 'duration', label: 'Duration (hours)', type: 'select', options: [
      { label: '1-2 hours', value: '2h' },
      { label: 'Half day (4 hrs)', value: '4h' },
      { label: 'Full day (8 hrs)', value: '8h' },
    ]},
  ],
  Tutoring: [
    { id: 'subject', label: 'Subject', type: 'select', options: [
      { label: 'Mathematics', value: 'maths' },
      { label: 'English / languages', value: 'language' },
      { label: 'Science', value: 'science' },
      { label: 'Music', value: 'music' },
      { label: 'Programming', value: 'coding' },
      { label: 'Other', value: 'other' },
    ]},
    { id: 'level', label: 'Student level', type: 'select', options: [
      { label: 'Primary school', value: 'primary' },
      { label: 'Secondary school', value: 'secondary' },
      { label: 'University', value: 'university' },
      { label: 'Adult / professional', value: 'adult' },
    ]},
    { id: 'frequency', label: 'Sessions per week', type: 'select', options: [
      { label: '1 session', value: '1' },
      { label: '2 sessions', value: '2' },
      { label: '3+ sessions', value: '3+' },
    ]},
  ],
  Fitness: [
    { id: 'goal', label: 'Your goal', type: 'select', options: [
      { label: 'Weight loss', value: 'weightloss' },
      { label: 'Muscle building', value: 'muscle' },
      { label: 'General fitness', value: 'general' },
      { label: 'Sports performance', value: 'sport' },
      { label: 'Rehabilitation', value: 'rehab' },
    ]},
    { id: 'frequency', label: 'Sessions per week', type: 'select', options: [
      { label: '1 session', value: '1' },
      { label: '2 sessions', value: '2' },
      { label: '3+ sessions', value: '3+' },
    ]},
  ],
}
