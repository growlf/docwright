let CURRENT_MODE: 'vault' | 'upstream' = 'vault';

export function setMode(mode: 'vault' | 'upstream') {
  CURRENT_MODE = mode;
}

export function getMode(): 'vault' | 'upstream' {
  return CURRENT_MODE;
}
