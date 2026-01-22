import type { PosePoint } from '../utils/poseMath';

export interface SpatialAnchor {
  id: 'left_knee' | 'right_knee' | 'hip' | 'spine' | 'bar_path';
  x: number;
  y: number;
  z?: number;
}

export interface SpatialOverlayState {
  anchors: SpatialAnchor[];
  color: 'green' | 'yellow' | 'red';
  riskZones: Array<{ id: string; severity: 'yellow' | 'red'; points: Array<{ x: number; y: number }> }>;
}

export class PoseSpatialOverlayService {
  private emaMap: Record<string, { x: number; y: number; z?: number }> = {};
  private alpha = 0.3;

  updateAnchors(anchors: SpatialAnchor[]): SpatialAnchor[] {
    return anchors.map((anchor) => {
      const prev = this.emaMap[anchor.id];
      const next = prev
        ? {
            x: prev.x + this.alpha * (anchor.x - prev.x),
            y: prev.y + this.alpha * (anchor.y - prev.y),
            z: anchor.z !== undefined && prev.z !== undefined ? prev.z + this.alpha * (anchor.z - prev.z) : anchor.z,
          }
        : { x: anchor.x, y: anchor.y, z: anchor.z };
      this.emaMap[anchor.id] = next;
      return { ...anchor, ...next };
    });
  }

  buildRiskZones(riskLevel: 'safe' | 'caution' | 'danger', guardReason?: string): SpatialOverlayState['riskZones'] {
    const zones: SpatialOverlayState['riskZones'] = [];
    if (riskLevel === 'danger') {
      zones.push({
        id: 'danger_field',
        severity: 'red',
        points: [
          { x: 0.05, y: 0.05 },
          { x: 0.95, y: 0.05 },
          { x: 0.95, y: 0.95 },
          { x: 0.05, y: 0.95 },
        ],
      });
    }
    if (guardReason?.includes('knee_valgus')) {
      zones.push({
        id: 'knee_collapse_cone',
        severity: 'red',
        points: [
          { x: 0.35, y: 0.6 },
          { x: 0.65, y: 0.6 },
          { x: 0.5, y: 0.95 },
        ],
      });
    }
    if (guardReason?.includes('shear')) {
      zones.push({
        id: 'lumbar_plane',
        severity: 'red',
        points: [
          { x: 0.2, y: 0.4 },
          { x: 0.8, y: 0.4 },
          { x: 0.8, y: 0.5 },
          { x: 0.2, y: 0.5 },
        ],
      });
    }
    return zones;
  }

  buildOverlayState(anchors: SpatialAnchor[], color: SpatialOverlayState['color'], riskLevel: 'safe' | 'caution' | 'danger', guardReason?: string): SpatialOverlayState {
    return {
      anchors: this.updateAnchors(anchors),
      color,
      riskZones: this.buildRiskZones(riskLevel, guardReason),
    };
  }
}

export const poseSpatialOverlayService = new PoseSpatialOverlayService();
