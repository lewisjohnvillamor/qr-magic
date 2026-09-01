import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RevealValues } from '../../animation/create-reveal-timeline';

export interface SculptureExtent {
  /** Largest distance from the Y axis: the sculpture rotates, so this is what
   * has to fit horizontally at any moment. */
  radiusXZ: number;
  /** Largest distance from the origin along Y. */
  halfHeight: number;
}

export interface CameraRigProps {
  /** Full presentation width of the QR area, in world units. */
  qrWorldSize: number;
  extent: SculptureExtent;
  /** Pixels at the bottom of the viewport covered by the control panel. */
  bottomInset: number;
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
  /** Distance along +Z at which the box fits the usable region. */
  distance: number;
  /** Vertical framing offset that centres the box in the usable region. */
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
  // Moving the camera down lifts the subject into the usable strip.
  const offsetY = -(inset / 2) * unitsPerPixel;

  return { distance, offsetY };
}

/**
 * Blends between the artistic camera and the exact frontal QR camera.
 *
 * At `camera = 1` the camera looks straight down −Z with no roll or tilt, so the
 * QR plane is perfectly frontal and no perspective distortion is introduced.
 */
export function CameraRig({ qrWorldSize, extent, bottomInset, values, pointer }: CameraRigProps) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const sculpturePos = useRef(new THREE.Vector3());
  const qrPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.near = 0.5;
    perspective.far = 600;
    perspective.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const reveal = values.current;
    if (!reveal) return;
    const perspective = camera as THREE.PerspectiveCamera;
    const t = reveal.camera;

    // A narrower field of view in the QR state reduces edge distortion further.
    const fov = 42 - 16 * t;
    if (Math.abs(perspective.fov - fov) > 1e-4) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }

    // The sculpture spins, so its horizontal footprint is the XZ radius, and
    // the box is padded so cubes never touch the frame edge.
    const sculptureFit = fitFrontalBox({
      width: extent.radiusXZ * 2.4,
      height: extent.halfHeight * 2.5,
      fovDegrees: fov,
      viewportWidth: size.width,
      viewportHeight: size.height,
      bottomInset,
    });
    // Fitting a box assumes it is flat. A sculpture has depth, and its near face
    // is magnified by perspective, so the camera is pushed back by roughly the
    // object's own half-depth before framing.
    const depthPad = extent.radiusXZ * 0.85;
    const sculptureDistance = sculptureFit.distance + depthPad;
    // The framing point, not the object: shifting it moves the subject into the
    // strip of viewport the control panel leaves free.
    const sculptureTargetY =
      sculptureFit.offsetY * (sculptureDistance / Math.max(sculptureFit.distance, 1e-3));

    sculpturePos.current.set(
      // A three-quarter angle: enough to show two faces of a boxy sculpture.
      sculptureDistance * 0.32,
      // Wide, flat sculptures read better from slightly above.
      sculptureTargetY + extent.halfHeight * 0.42 + extent.radiusXZ * 0.34,
      sculptureDistance,
    );

    // 1.06 leaves a margin so the quiet zone is never clipped by rounding.
    const qrFit = fitFrontalBox({
      width: qrWorldSize * 1.06,
      height: qrWorldSize * 1.06,
      fovDegrees: fov,
      viewportWidth: size.width,
      viewportHeight: size.height,
      bottomInset,
    });
    qrPos.current.set(0, qrFit.offsetY, qrFit.distance);

    perspective.position.lerpVectors(sculpturePos.current, qrPos.current, t);

    // Pointer parallax fades out with the reveal so the lock state is still.
    const parallax = (1 - t) * reveal.idle;
    perspective.position.x += (pointer.current?.x ?? 0) * parallax * extent.radiusXZ * 0.12;
    perspective.position.y += (pointer.current?.y ?? 0) * parallax * extent.radiusXZ * 0.08;

    perspective.up.set(0, 1, 0);
    // At t = 1 the target sits at the camera's own height, so the view axis is
    // exactly -Z and the QR plane is exactly frontal.
    target.current.set(0, sculptureTargetY * (1 - t) + qrFit.offsetY * t, 0);
    perspective.lookAt(target.current);
  });

  return null;
}
