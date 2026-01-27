import { useEffect, useMemo, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { useAuth } from '../context/AuthContext';
import { entitlementService } from '../services/entitlementService';
import { poseService } from '../services/poseService';
import { aiPoseCoachService } from '../services/aiPoseCoachService';
import { poseVoiceQueueService } from '../services/poseVoiceQueueService';
import { aiTrustService } from '../services/aiTrustService';
import { poseRealtimeFeedbackService } from '../services/poseRealtimeFeedbackService';
import { poseSpatialOverlayService } from '../services/poseSpatialOverlayService';
import { pose3dService } from '../services/pose3dService';
import { poseEdgePipelineService } from '../services/poseEdgePipelineService';
import { poseEdgeBufferService } from '../services/poseEdgeBufferService';
import { computeConfidence, POSE_LANDMARKS, PosePoint } from '../utils/poseMath';
import { toPose3dPoints } from '../utils/pose3dMath';
import { EXERCISE_TEMPLATES, ExerciseTemplateKey, evaluateTechnique, aggregateSeverity } from '../utils/poseTemplates';

const CONNECTIONS: Array<[number, number]> = [
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

const CUE_COOLDOWN_MS = 5000;

const PoseCoach = () => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const session3dIdRef = useRef<string | null>(null);
  const frameIndexRef = useRef(0);
  const lastCueRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastOverlayChangeRef = useRef(0);
  const barPathRef = useRef<Array<{ x: number; y: number }>>([]);
  const processEveryRef = useRef(5);
  const latencySamplesRef = useRef<number[]>([]);

  const [status, setStatus] = useState('Инициализация...');
  const [allowRealtime, setAllowRealtime] = useState(false);
  const allowRealtimeRef = useRef(false);
  const [currentExercise, setCurrentExercise] = useState<ExerciseTemplateKey>('squat');
  const [overlayState, setOverlayState] = useState<'green' | 'yellow' | 'red'>('green');
  const [lastCue, setLastCue] = useState<string>('');
  const [riskStatus, setRiskStatus] = useState<'safe' | 'caution' | 'danger'>('safe');
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [fatigueScore, setFatigueScore] = useState<number | null>(null);
  const [entitlementLabel, setEntitlementLabel] = useState<'free' | 'pro' | 'vision'>('free');
  const [isOffline, setIsOffline] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'balanced' | 'safety'>('high');
  const [latencyStats, setLatencyStats] = useState<{ p50: number; p95: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [spatialMode, setSpatialMode] = useState<'full' | 'overlay' | 'safety'>('overlay');
  const [spatialOverlayState, setSpatialOverlayState] = useState<ReturnType<typeof poseSpatialOverlayService.buildOverlayState> | null>(null);

  const template = useMemo(() => EXERCISE_TEMPLATES[currentExercise], [currentExercise]);
  const templateRef = useRef(template);

  const getSpatialPan = (reason?: string): number | undefined => {
    if (!reason) return undefined;
    if (reason.includes('knee_valgus')) return -0.4;
    if (reason.includes('asymmetry')) return 0.4;
    return undefined;
  };

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const handleResize = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    video.addEventListener('loadedmetadata', handleResize);
    return () => video.removeEventListener('loadedmetadata', handleResize);
  }, []);

  useEffect(() => {
    const updateStatus = () => setIsOffline(!navigator.onLine);
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const updateBattery = async () => {
      if (!('getBattery' in navigator)) return;
      const battery = await (navigator as any).getBattery();
      if (!mounted) return;
      const level = battery.level;
      const charging = battery.charging;
      if (level < 0.2 && !charging) {
        setPerformanceMode('safety');
        processEveryRef.current = 8;
      } else if (level < 0.4 && !charging) {
        setPerformanceMode('balanced');
        processEveryRef.current = 6;
      } else {
        setPerformanceMode('high');
        processEveryRef.current = 4;
      }
      const listener = () => updateBattery();
      battery.addEventListener('levelchange', listener);
      battery.addEventListener('chargingchange', listener);
    };
    updateBattery();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!poseRef.current) return;
    poseRef.current.setOptions({
      modelComplexity: performanceMode === 'high' ? 1 : 0,
    });
  }, [performanceMode]);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    const init = async () => {
      const trust = await aiTrustService.getTrustScore(user.id);
      if (isMounted) setTrustScore(trust);
      const entitlement = await entitlementService.canRealtimePose(user.id);
      if (!isMounted) return;
      setAllowRealtime(entitlement.allowed);
      allowRealtimeRef.current = entitlement.allowed;
      const isVision = typeof navigator !== 'undefined' && /Vision/i.test(navigator.userAgent);
      const tier = entitlement.allowed ? (isVision ? 'vision' : 'pro') : 'free';
      setEntitlementLabel(tier);
      setSpatialMode(tier === 'vision' ? 'full' : tier === 'pro' ? 'overlay' : 'safety');

      const sessionId = await poseService.startSession(user.id, {
        canonicalExerciseId: null,
        deviceInfo: { source: 'web', entitlement: entitlement.plan },
      });
      sessionIdRef.current = sessionId;
      const session3dId = await pose3dService.startSession(user.id, {
        poseSessionId: sessionId,
        canonicalExerciseId: null,
        deviceInfo: { source: 'web', entitlement: entitlement.plan },
      });
      session3dIdRef.current = session3dId;
      setStatus(entitlement.allowed ? 'Realtime активен' : 'Free режим: только пост‑анализ');

      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(async (results: any) => {
        if (!canvasRef.current || !videoRef.current) return;
        if (isPaused) return;
        if (!results?.poseLandmarks?.length) return;

        const landmarks: PosePoint[] = results.poseLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
        }));
        const landmarks3d = toPose3dPoints(results.poseLandmarks);

        const pipeline = poseEdgePipelineService.process({
          poseLandmarks: results.poseLandmarks,
          template: templateRef.current,
          nowMs: Date.now(),
        });

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          if (allowRealtimeRef.current) {
            const color = overlayState === 'red' ? '#ef4444' : overlayState === 'yellow' ? '#f59e0b' : '#22c55e';
            drawConnectors(ctx, results.poseLandmarks, CONNECTIONS, { color, lineWidth: 4 });
            drawLandmarks(ctx, results.poseLandmarks, { color, lineWidth: 2, radius: 3 });
            if (results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER] && results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER]) {
              const midX = (results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].x + results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2;
              const midY = (results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].y + results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2;
              barPathRef.current.push({ x: midX * canvasRef.current.width, y: midY * canvasRef.current.height });
              if (barPathRef.current.length > 30) barPathRef.current.shift();
              ctx.strokeStyle = '#60a5fa';
              ctx.lineWidth = 2;
              ctx.beginPath();
              barPathRef.current.forEach((pt, idx) => {
                if (idx === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
              });
              ctx.stroke();
            }
            if (spatialMode !== 'safety') {
              const anchors = [
                { id: 'left_knee', x: results.poseLandmarks[POSE_LANDMARKS.LEFT_KNEE].x, y: results.poseLandmarks[POSE_LANDMARKS.LEFT_KNEE].y },
                { id: 'right_knee', x: results.poseLandmarks[POSE_LANDMARKS.RIGHT_KNEE].x, y: results.poseLandmarks[POSE_LANDMARKS.RIGHT_KNEE].y },
                { id: 'hip', x: (results.poseLandmarks[POSE_LANDMARKS.LEFT_HIP].x + results.poseLandmarks[POSE_LANDMARKS.RIGHT_HIP].x) / 2, y: (results.poseLandmarks[POSE_LANDMARKS.LEFT_HIP].y + results.poseLandmarks[POSE_LANDMARKS.RIGHT_HIP].y) / 2 },
                { id: 'spine', x: (results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].x + results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2, y: (results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].y + results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2 },
              ];
              const overlay = poseSpatialOverlayService.buildOverlayState(
                anchors.map((a) => ({ ...a, x: a.x * canvasRef.current!.width, y: a.y * canvasRef.current!.height })),
                overlayState,
                riskStatus,
                undefined
              );
              setSpatialOverlayState(overlay);
              overlay.anchors.forEach((anchor) => {
                ctx.fillStyle = overlayState === 'red' ? '#ef4444' : overlayState === 'yellow' ? '#f59e0b' : '#22c55e';
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, 6, 0, Math.PI * 2);
                ctx.fill();
              });
              overlay.riskZones.forEach((zone) => {
                ctx.fillStyle = zone.severity === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)';
                ctx.beginPath();
                zone.points.forEach((p, idx) => {
                  const px = p.x * canvasRef.current!.width;
                  const py = p.y * canvasRef.current!.height;
                  if (idx === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                });
                ctx.closePath();
                ctx.fill();
              });
            }
          }
          ctx.restore();
        }

        if (isProcessingRef.current) return;
        frameIndexRef.current += 1;
        if (frameIndexRef.current % processEveryRef.current !== 0) return;

        isProcessingRef.current = true;
        try {
          const latencyStart = performance.now();
          const avgKnee = (pipeline.angles2d.leftKnee + pipeline.angles2d.rightKnee) / 2;
          const avgHip = (pipeline.angles2d.leftHip + pipeline.angles2d.rightHip) / 2;
          const avgShoulder = (pipeline.angles2d.leftShoulder + pipeline.angles2d.rightShoulder) / 2;
          const confidence = computeConfidence(landmarks);
          const asymmetry = {
            knee: Math.abs(pipeline.angles2d.leftKnee - pipeline.angles2d.rightKnee) / Math.max(1, avgKnee),
            hip: Math.abs(pipeline.angles2d.leftHip - pipeline.angles2d.rightHip) / Math.max(1, avgHip),
            shoulder: Math.abs(pipeline.angles2d.leftShoulder - pipeline.angles2d.rightShoulder) / Math.max(1, avgShoulder),
          };

          const joints = results.poseLandmarks.map((lm: any, idx: number) => ({
            jointName: `lm_${idx}`,
            x: lm.x,
            y: lm.y,
            z: lm.z,
            confidence: lm.visibility,
          }));

          const { guardSafe } = await poseService.processFrame(user.id, sessionId, {
            frameIndex: frameIndexRef.current,
            ts: new Date().toISOString(),
            joints,
            angles: {
              knee: avgKnee,
              hip: avgHip,
              spine: pipeline.angles2d.spine,
              shoulder: avgShoulder,
            },
            deviations: pipeline.deviations.map((d) => ({
              joint: d.joint,
              observed: d.observed,
              expectedMin: d.min,
              expectedMax: d.max,
              severity: d.severity,
            })),
            guardInput: {
              angles: {
                knee: avgKnee,
                hip: avgHip,
                spine: pipeline.angles2d.spine,
                shoulder: avgShoulder,
              },
              asymmetry,
              confidence,
              landmarks,
            },
            qualityScore: pipeline.stableSeverity === 'green' ? 90 : pipeline.stableSeverity === 'yellow' ? 70 : 40,
          });

          const riskLevel = pipeline.riskLevel;
          const guardReason = pipeline.guardReason;
          setRiskStatus(riskLevel);
          setFatigueScore(pipeline.load.fatigueIndex);
          const feedbackResult = poseRealtimeFeedbackService.update({
            ts: Date.now(),
            severity: pipeline.severityRaw,
            riskLevel,
            fatigueIndex: pipeline.load.fatigueIndex,
            guardReason,
            trustScore,
            allowRealtime: allowRealtimeRef.current,
          });
          if (feedbackResult.stableSeverity !== overlayState && Date.now() - lastOverlayChangeRef.current > 400) {
            setOverlayState(feedbackResult.stableSeverity);
            lastOverlayChangeRef.current = Date.now();
          }
          if (session3dIdRef.current) {
            const frameTs = new Date().toISOString();
            poseEdgeBufferService.bufferFrame({
              frameIndex: frameIndexRef.current,
              ts: frameTs,
              joints: landmarks3d.map((lm, idx) => ({
                jointName: `lm_${idx}`,
                x: lm.x,
                y: lm.y,
                z: lm.z,
                confidence: lm.visibility ?? null,
              })),
              angles: {
                knee_3d: (pipeline.angles3d.leftKnee + pipeline.angles3d.rightKnee) / 2,
                hip_3d: (pipeline.angles3d.leftHip + pipeline.angles3d.rightHip) / 2,
                spine_3d: pipeline.angles3d.spine,
                shoulder_3d: (pipeline.angles3d.leftShoulder + pipeline.angles3d.rightShoulder) / 2,
              },
              biomechanics: {
                metrics: pipeline.biomechanics as any,
                riskLevel: pipeline.riskLevel,
                guardFlags: pipeline.guardFlags,
                guardReason: pipeline.guardReason,
              },
              kinematics: {
                metrics: {
                  hip_depth: pipeline.depthMetrics.hipDepth,
                  knee_depth: pipeline.depthMetrics.kneeDepth,
                  shoulder_depth: pipeline.depthMetrics.shoulderDepth,
                  vertical_displacement: pipeline.depthMetrics.verticalDisplacement,
                  rom_percent: pipeline.depthMetrics.romPercent,
                  velocity: pipeline.kinematics.velocity,
                  acceleration: pipeline.kinematics.acceleration,
                  tempo_ratio: pipeline.kinematics.tempoRatio,
                  pause_detected: pipeline.kinematics.pauseDetected ? 1 : 0,
                },
                estimates: {
                  relative_load_proxy: pipeline.load.relativeLoadProxy,
                  fatigue_index: pipeline.load.fatigueIndex,
                  rpe_proxy: pipeline.load.rpeProxy,
                  volume_stress_score: pipeline.load.volumeStressScore,
                  guard_flags: pipeline.load.guardFlags,
                },
              },
            });
          }

          const now = Date.now();
          if (allowRealtimeRef.current && now - lastCueRef.current > CUE_COOLDOWN_MS) {
            const stableSeverity = feedbackResult.stableSeverity;
            const eventType = feedbackResult.event;
            const allowNonSafety = !isOffline;
            if (session3dIdRef.current) {
              if (eventType === 'overload_stop') {
                await poseVoiceQueueService.enqueuePreempt({
                  userId: user.id,
                  session3dId: session3dIdRef.current,
                  type: 'safety_alert',
                  priority: 'high',
                  message: guardReason?.includes('knee_valgus')
                    ? 'Колени наружу. Остановитесь и скорректируйте положение.'
                    : guardReason?.includes('shear')
                      ? 'Снизьте нагрузку и удерживайте нейтральную спину.'
                      : 'Немедленно остановитесь и восстановите безопасную позицию.',
                  spatialPan: getSpatialPan(guardReason),
                });
              } else if (eventType === 'fatigue_warning') {
                await poseVoiceQueueService.enqueue({
                  userId: user.id,
                  session3dId: session3dIdRef.current,
                  type: 'fatigue_warning',
                  priority: 'medium',
                  message: 'Скорость падает. Сделайте паузу и восстановитесь.',
                  spatialPan: getSpatialPan(guardReason),
                });
              } else if (allowNonSafety && eventType === 'technique_error') {
                await poseVoiceQueueService.enqueue({
                  userId: user.id,
                  session3dId: session3dIdRef.current,
                  type: 'form_correction',
                  priority: stableSeverity === 'red' ? 'high' : 'medium',
                  message: stableSeverity === 'red'
                    ? 'Техника нарушена. Остановитесь и скорректируйте позицию.'
                    : 'Скорректируйте технику, удерживайте контроль.',
                  spatialPan: getSpatialPan(guardReason),
                });
              } else if (allowNonSafety && stableSeverity === 'green' && (trustScore ?? 0) >= 60) {
                await poseVoiceQueueService.enqueue({
                  userId: user.id,
                  session3dId: session3dIdRef.current,
                  type: 'motivation',
                  priority: 'low',
                  message: 'Отличная техника. Держите темп.',
                });
              }
            }
            await aiPoseCoachService.generateCue(user.id, sessionId, {
              allowRealtime: allowRealtimeRef.current,
              guardSafe,
              trustThreshold: 40,
              riskLevel,
              guardReason,
            });
            lastCueRef.current = now;
            setLastCue(stableSeverity === 'green' ? 'Отличная техника' : 'Скорректируйте технику');
          }

          const latencyEnd = performance.now();
          const sample = latencyEnd - latencyStart;
          latencySamplesRef.current.push(sample);
          if (latencySamplesRef.current.length > 200) {
            latencySamplesRef.current.shift();
          }
          const sorted = [...latencySamplesRef.current].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? sample;
          const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sample;
          setLatencyStats({ p50: Math.round(p50), p95: Math.round(p95) });
        } catch (err) {
          console.error('[PoseCoach] Frame processing error', err);
        } finally {
          isProcessingRef.current = false;
        }
      });

      poseRef.current = pose;

      if (videoRef.current) {
        cameraRef.current = new Camera(videoRef.current, {
          onFrame: async () => {
            if (poseRef.current && videoRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        await cameraRef.current.start();
      }
    };

    init();

    return () => {
      isMounted = false;
      if (session3dIdRef.current && user?.id) {
        poseEdgeBufferService.flush(user.id, session3dIdRef.current).catch(() => undefined);
      }
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }
      if (sessionIdRef.current && user?.id) {
        poseService.closeSession(user.id, sessionIdRef.current).catch(() => undefined);
      }
      if (session3dIdRef.current && user?.id) {
        pose3dService.closeSession(user.id, session3dIdRef.current).catch(() => undefined);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      if (!navigator.onLine || !session3dIdRef.current) return;
      poseEdgeBufferService.flush(user.id, session3dIdRef.current).catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pose Coach</h1>
        <div className="text-xs text-gray-300">{status}</div>
      </header>

      <div className="px-4 pb-2">
        <label className="text-xs text-gray-400">Шаблон упражнения</label>
        <select
          value={currentExercise}
          onChange={(e) => setCurrentExercise(e.target.value as ExerciseTemplateKey)}
          className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="squat">Присед</option>
          <option value="deadlift">Становая тяга</option>
          <option value="bench">Жим лёжа</option>
        </select>
      </div>

      <div className="relative flex-1">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {!allowRealtime && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-center text-sm text-gray-200">
              Free режим: доступен только пост‑анализ
            </div>
          </div>
        )}
      </div>

      <footer className="p-4 text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span>Статус техники: {overlayState}</span>
          <span className="text-gray-300">{lastCue}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Risk: {riskStatus}</span>
          <span>Trust: {trustScore ?? '—'}</span>
          <span>Fatigue: {fatigueScore !== null ? fatigueScore.toFixed(2) : '—'}</span>
          <span>Entitlement: {entitlementLabel}</span>
        </div>
        {latencyStats && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Latency p50: {latencyStats.p50}ms</span>
            <span>p95: {latencyStats.p95}ms</span>
            <span>Mode: {performanceMode}</span>
          </div>
        )}
        {entitlementLabel === 'vision' && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Spatial: {spatialMode}</span>
            <button onClick={() => setIsPaused((v) => !v)} className="px-2 py-1 rounded bg-gray-800">
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => setSpatialMode('overlay')} className="px-2 py-1 rounded bg-gray-800">
              Replay
            </button>
            <button onClick={() => setPerformanceMode('balanced')} className="px-2 py-1 rounded bg-gray-800">
              Slow‑mo
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};

export default PoseCoach;
