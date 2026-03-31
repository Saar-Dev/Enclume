export const WS = {
  // Connexion session
  SESSION_JOIN:        'session:join',
  SESSION_JOINED:      'session:joined',
  SESSION_USER_JOINED: 'session:user_joined',
  SESSION_USER_LEFT:   'session:user_left',

  // Tokens
  TOKEN_MOVE:    'token:move',
  TOKEN_MOVED:   'token:moved',
  TOKEN_CREATED: 'token:created',
  TOKEN_DELETED: 'token:deleted',
  TOKEN_UPDATED: 'token:updated',

  // Voxels (carte 3D)
  VOXEL_ADD:     'voxel:add',
  VOXEL_ADDED:   'voxel:added',
  VOXEL_REMOVE:  'voxel:remove',
  VOXEL_REMOVED: 'voxel:removed',

  // Dés
  DICE_ROLL:   'dice:roll',
  DICE_RESULT: 'dice:result',

  // Battlemap
  MAP_SWITCH:   'map:switch',
  MAP_VIEWPORT: 'map:viewport',

  // Documents
  DOC_SHARED: 'doc:shared',

  // Chat
  CHAT_MESSAGE: 'chat:message',
}