declare module '@mediapipe/pose' {
  export class Pose {
    constructor(config: { locateFile: (file: string) => string });
    setOptions(options: Record<string, unknown>): void;
    onResults(cb: (results: any) => void): void;
    send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
    close(): void;
  }
}

declare module '@mediapipe/camera_utils' {
  export class Camera {
    constructor(video: HTMLVideoElement, config: { onFrame: () => Promise<void>; width: number; height: number });
    start(): Promise<void>;
    stop(): void;
  }
}

declare module '@mediapipe/drawing_utils' {
  export function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    connections: Array<[number, number]>,
    style?: { color?: string; lineWidth?: number }
  ): void;
  export function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    style?: { color?: string; lineWidth?: number; radius?: number }
  ): void;
}
