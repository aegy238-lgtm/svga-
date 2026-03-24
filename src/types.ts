export interface SVGAFileInfo {
  name: string;
  url: string;
}

export enum PlayerStatus {
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}
