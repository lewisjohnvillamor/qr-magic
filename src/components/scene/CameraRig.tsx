import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../../animation/create-reveal-timeline';

export interface CameraRigProps {
  /** Full presentation width of the QR base, in world units. */
  qrWorldSize: number;
  /** Highest point of the sculpture standing on the base. */
  sculptureTop: number;
  /** Pixels at the bottom of the viewport covered by the control panel. */
  bottomInset: number;
  /**
   * Inset used for the scan pose. Deliberately a constant rather than the live
   * panel height: the panel collapses to its compact bar as the code locks, and
   * framing the scan view from a height that changes at that moment would move
   * the code just as it was announced stable — a scanner would see it jump.
   */
  scanInset: number;
  values: RefObject<RevealValues | null>;
  pointer: RefObject<{ x: number; y: number }>;
}

export interface FitOptions {
  /** World-space width of the box to frame. */
  width: number;
  /** World-space height of the box to frame. */
  height: number;
  fovDegrees: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Pixels at the bottom of the viewport that are covered by interface. */
  bottomInset: number;
}

export interface CameraFit {
  /** Distance at which the box fits the usable region. */
  distance: number;
  /** Offset along the camera's screen-up axis that centres the box in the
   * usable region. Negative moves the framing point down-screen, lifting the
   * subject into the strip the interface leaves free. */
  offsetY: number;
}

/**
 * Frame a frontal box inside the part of the viewport the interface does not
 * cover.
 *
 * The control panel sits over the bottom of the scene, so fitting the code to
 * the full viewport would leave its lower rows hidden — and a QR code with
 * hidden rows is not a QR code.
 */
export function fitFrontalBox(options: FitOptions): CameraFit {
  const { width, height, fovDegrees, viewportWidth, viewportHeight, bottomInset } = options;
  const halfFov = Math.tan((fovDegrees * Math.PI) / 360);
  // Never surrender more than 60% of the viewport to the interface: on a short
  // screen a tall panel would otherwise shrink the code to nothing.
  const inset = Math.min(Math.max(0, bottomInset), viewportHeight * 0.6);
  const usableHeight = Math.max(1, viewportHeight - inset);
  // A canvas can briefly report a zero dimension while laying out; clamping
  // keeps the aspect finite so the camera never jumps to infinity.
  const aspect = Math.max(1, viewportWidth) / Math.max(1, viewportHeight);

  // Vertical: the usable strip covers `usableHeight / viewportHeight` of the
  // camera's vertical extent.
  const byHeight = height / 2 / (halfFov * (usableHeight / viewportHeight));
  // Horizontal: the full width is available.
  const byWidth = width / 2 / (halfFov * aspect);
  const distance = Math.max(byHeight, byWidth);

  // World units per screen pixel at the focal plane.
  const worldHeight = 2 * distance * halfFov;
  const unitsPerPixel = worldHeight / Math.max(1, viewportHeight);
  const offsetY = -(inset / 2) * unitsPerPixel;

  return { distance, offsetY };
}

/** Idle viewpoint: a three-quarter view, high enough to read the base. */
const IDLE_AZIMUTH = 0.6;
const IDLE_ELEVATION = 0.62;

/**
 * Blends between the three-quarter sculpture view and the exact top-down scan
 * view.
 *
 * At `camera = 1` the camera hangs directly above the origin looking straight
 * down, with its up axis on −Z: the base plane fills the frame frontally, so
 * no perspective distortion is introduced and the code cannot be mirrored.
 */
export function CameraRig({
  qrWorldSize,
  sculptureTop,
  bottomInset,
  scanInset,
  values,
  pointer,
}: CameraRigProps) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const sculpturePos = useRef(new THREE.Vector3());
  const sculptureTarget = useRef(new THREE.Vector3());
  const qrPos = useRef(new THREE.Vector3());
  const qrTarget = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3());

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.near = 0.5;
    perspective.far = 800;
    perspective.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const reveal = values.current;
    if (!reveal) return;
    const perspective = camera as THREE.PerspectiveCamera;
    const t = reveal.camera;

    // A narrower field of view in the scan state reduces edge distortion.
    const fov = 40 - 15 * t;
    if (Math.abs(perspective.fov - fov) > 1e-4) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }

    // ---- three-quarter idle pose ----
    // The plinth turns, so its worst-case on-screen width is its diagonal; the
    // apparent height combines the foreshortened base and the sculpture.
    const el = IDLE_ELEVATION;
    const sculptureFit = fitFrontalBox({
      width: qrWorldSize * 1.5,
      height: (qrWorldSize * Math.sin(el) + sculptureTop * Math.cos(el)) * 1.2,
      fovDegrees: fov,
      viewportWidth: size.width,
      viewportHeight: size.height,
      bottomInset,
    });
    const focusY = sculptureTop * 0.32;
    sculptureTarget.current.set(0, focusY + sculptureFit.offsetY, 0);
    sculpturePos.current
      .set(
        Math.sin(IDLE_AZIMUTH) * Math.cos(el),
        Math.sin(el),
        Math.cos(IDLE_AZIMUTH) * Math.cos(el),
      )
      .multiplyScalar(sculptureFit.distance)
      .add(sculptureTarget.current);

    // ---- top-down scan pose ----
    // 1.06 leaves a margin so the quiet zone is never clipped by rounding.
    const qrFit = fitFrontalBox({
      width: qrWorldSize * 1.06,
      height: qrWorldSize * 1.06,
      fovDegrees: fov,
      viewportWidth: size.width,
      viewportHeight: size.height,
      bottomInset: scanInset,
    });
    // Screen-up is world −Z from above, so the framing offset lands on +Z.
    qrTarget.current.set(0, 0, -qrFit.offsetY);
    qrPos.current.set(0, qrFit.distance, -qrFit.offsetY);

    // ---- blend ----
    perspective.position.lerpVectors(sculpturePos.current, qrPos.current, t);
    target.current.lerpVectors(sculptureTarget.current, qrTarget.current, t);

    // Pointer parallax fades out with the reveal so the lock state is still.
    const parallax = (1 - t) * reveal.idle;
    perspective.position.x += (pointer.current?.x ?? 0) * parallax * qrWorldSize * 0.02;
    perspective.position.y += (pointer.current?.y ?? 0) * parallax * qrWorldSize * 0.012;

    // The up axis rolls from world-up to −Z so the top-down frame is upright
    // and, critically, not mirrored.
    up.current.set(0, 1 - t, -t).normalize();
    perspective.up.copy(up.current);
    perspective.lookAt(target.current);
  });

  return null;
}
