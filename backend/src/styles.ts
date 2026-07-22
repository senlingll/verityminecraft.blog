// Room Design Configuration
export interface RoomDesignConfig {
  id: string;
  name: string;
  prompt: string;
}

// Room Design Styles
export const ROOM_DESIGN_STYLES = {
  'modern': 'Modern',
  'scandinavian': 'Scandinavian',
  'farmhouse': 'Farmhouse',
  'minimalist': 'Minimalist',
  'industrial': 'Industrial',
  'bohemian': 'Bohemian',
  'luxury': 'Luxury',
  'coastal': 'Coastal'
} as const;

// Room Functions
export const ROOM_FUNCTIONS = {
  'living-room': 'living room',
  'dining-room': 'dining room',
  'gaming-room': 'gaming room',
  'bedroom': 'bedroom',
  'bathroom': 'bathroom',
  'office': 'office',
  'kitchen': 'kitchen',
  'guest-room': 'guest room',
  'laundry-room': 'laundry room',
  'home-theater': 'home theater',
  'playroom': 'playroom',
  'music-room': 'music room',
  'exercise-room': 'exercise room',
  'library': 'library',
  'sunroom': 'sunroom',
  'mudroom': 'mudroom',
  'attic': 'attic',
  'basement': 'basement',
  'pantry': 'pantry',
  'wine-cellar': 'wine cellar',
  'garage': 'garage',
  'walk-in-closet': 'walk-in closet',
  'toilet': 'toilet',
  'outdoor-living-space': 'outdoor living space',
  'outdoor-pool-area': 'outdoor pool area',
  'outdoor-patio': 'outdoor patio',
  'outdoor-garden': 'outdoor garden',
  'house-exterior': 'house exterior',
  'meeting-room': 'meeting room',
  'workshop': 'workshop',
  'fitness-gym': 'fitness gym',
  'coffee-shop': 'coffee shop',
  'clothing-store': 'clothing store',
  'restaurant': 'restaurant',
  'coworking-space': 'coworking space',
  'hotel-lobby': 'hotel lobby',
  'hotel-room': 'hotel room',
  'hotel-bathroom': 'hotel bathroom',
  'exhibition-space': 'exhibition space',
  'onsen': 'onsen',
  'drop-zone': 'drop zone'
} as const;

// Default room design configuration
export const DEFAULT_ROOM_DESIGN_CONFIG: RoomDesignConfig = {
  id: 'room_design',
  name: 'AI Room Design',
  prompt: 'Generate an interior design of a living room, styled in Modern. The design should be realistic, professional, and visually appealing, suitable for American homes. Include appropriate furniture, decoration, and lighting that matches the Modern style. Make sure the room feels cozy, practical, and aesthetically pleasing.'
};

// Helper function to generate room design prompt based on user selections
export function getRoomDesignPrompt(style?: string, roomFunction?: string): string {
  // Default values
  const selectedStyle = style && style in ROOM_DESIGN_STYLES ? ROOM_DESIGN_STYLES[style as keyof typeof ROOM_DESIGN_STYLES] : 'Modern';
  const selectedFunction = roomFunction && roomFunction in ROOM_FUNCTIONS ? ROOM_FUNCTIONS[roomFunction as keyof typeof ROOM_FUNCTIONS] : 'living room';
  
  return `Generate an interior design of a ${selectedFunction}, styled in ${selectedStyle}. The design should be realistic, professional, and visually appealing, suitable for American homes. Include appropriate furniture, decoration, and lighting that matches the ${selectedStyle} style. Make sure the room feels cozy, practical, and aesthetically pleasing.`;
}

// Helper function to validate style
export function isValidStyle(style: string): boolean {
  return style in ROOM_DESIGN_STYLES;
}

// Helper function to validate room function
export function isValidRoomFunction(roomFunction: string): boolean {
  return roomFunction in ROOM_FUNCTIONS;
}

// Legacy functions for backward compatibility
export function getRestorationPrompt(style?: string, roomFunction?: string): string {
  return getRoomDesignPrompt(style, roomFunction);
}

export function isValidRestorationId(id: string): boolean {
  return id === 'room_design' || id === 'photo_restoration';
}

export function getAnimeStyle(styleId?: string): RoomDesignConfig {
  return DEFAULT_ROOM_DESIGN_CONFIG;
}

// Export for validation
export const VALID_RESTORATION_ID = 'room_design';
