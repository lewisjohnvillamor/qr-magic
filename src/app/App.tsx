import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExperienceStore } from './experience-store';
import { useReveal } from './use-reveal';
import { ControlPanel } from '../components/controls/ControlPanel';
import { FallbackQr } from '../components/fallback/FallbackQr';
import { LiveRegion } from '../components/LiveRegion';
import { getTheme, resolveQrColors } from '../themes/themes';
import { QUALITY_PROFILES, detectWebglSupport } from '../lib/quality';
import { prefersReducedMotion, subscribeToReducedMotion } from '../animation/motion-preferences';
import { useElementHeight } from '../lib/use-element-height';
import { playCue, disposeAudio } from '../lib/audio';
import { SHARE_PARAM } from '../sharing/share-codec';

const VoxelScene = lazy(() =>
  import('../components/scene/VoxelScene').then((module) => ({ default: module.VoxelScene })),
);

export function App() {
  const state = useExperienceStore();
  const theme = getTheme(state.theme);
  const qrColors = useMemo(
    () =>
      resolveQrColors(theme, {
        foreground: state.brandForeground,
        background: state.brandBackground,
      }),
    [theme, state.brandForeground, state.brandBackground],
  );
  const quality = QUALITY_PROFILES[state.quality];

  const [webglSupported] = useState(detectWebglSupport);
  const [documentVisible, setDocumentVisible] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  );
  const panelHeight = useElementHeight('.panel');
  // Read by audio callbacks that must not be recreated on every mute toggle.
  const mutedRef = useRef(state.muted);
  useEffect(() => {
    mutedRef.current = state.muted;
  }, [state.muted]);

  // ---- motion preference ----
  useEffect(() => {
    state.setReducedMotion(prefersReducedMotion());
    return subscribeToReducedMotion(state.setReducedMotion);
    // `setReducedMotion` is a stable zustand action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- pause rendering when hidden (spec §15) ----
  useEffect(() => {
    const onVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => disposeAudio, []);

  // ---- theme as CSS custom properties ----
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--backdrop-top', theme.backdrop[0]);
    root.style.setProperty('--backdrop-bottom', theme.backdrop[1]);
    root.style.setProperty('--ink', theme.ink);
    root.style.setProperty('--accent', theme.accent);
    const dark = theme.id === 'cyber' || theme.id === 'sunset';
    root.style.setProperty('--surface', dark ? 'rgb(18 14 28 / 0.66)' : 'rgb(255 255 255 / 0.72)');
    root.style.setProperty(
      '--surface-strong',
      dark ? 'rgb(18 14 28 / 0.9)' : 'rgb(255 255 255 / 0.92)',
    );
    root.style.setProperty('--hairline', dark ? 'rgb(255 255 255 / 0.16)' : 'rgb(0 0 0 / 0.1)');
  }, [theme]);

  const onRevealComplete = useCallback(() => {
    useExperienceStore.setState({
      phase: 'scan-ready',
      announcement: 'Scan ready. The QR code is locked and can be scanned now.',
    });
    playCue('lock', mutedRef.current);
  }, []);

  const onReturnComplete = useCallback(() => {
    useExperienceStore.setState({
      phase: 'sculpture',
      announcement: 'Back to the sculpture.',
    });
  }, []);

  const reducedMotion = state.reducedMotion;
  const controller = useReveal({ reducedMotion, onRevealComplete, onReturnComplete });

  const handleReveal = useCallback(() => {
    useExperienceStore.setState({ phase: 'revealing', announcement: 'Revealing the QR code.' });
    playCue('reveal', mutedRef.current);
    controller.reveal();
  }, [controller]);

  const handleReturn = useCallback(() => {
    useExperienceStore.setState({
      phase: 'returning',
      announcement: 'Returning to the sculpture.',
    });
    controller.returnToSculpture();
  }, [controller]);

  // Changing what the code encodes invalidates the current reveal, so the
  // timeline is reset rather than left mid-flight against a stale layout.
  const layoutKey = `${state.matrix.value}:${state.sculpture}:${state.quality}`;
  const previousKey = useRef(layoutKey);
  useEffect(() => {
    if (previousKey.current === layoutKey) return;
    previousKey.current = layoutKey;
    controller.resetImmediately();
    useExperienceStore.setState({ phase: 'sculpture' });
  }, [layoutKey, controller]);

  const shareTargetUrl = useMemo(
    () => state.shareUrl(window.location.href),
    // Recomputed whenever any part of the shared payload changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.url, state.sculpture, state.theme, state.brandForeground, state.brandBackground],
  );

  // Keep the address bar in sync so a reload or a manual copy restores the same
  // experience, without ever adding a history entry per keystroke.
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = new URL(shareTargetUrl);
    if (url.searchParams.get(SHARE_PARAM) === next.searchParams.get(SHARE_PARAM)) return;
    window.history.replaceState(null, '', next.toString());
  }, [shareTargetUrl]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'VoxelQR',
      text: 'A link that arrives as a 3D sculpture.',
      url: shareTargetUrl,
    };
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData);
        useExperienceStore.setState({ announcement: 'Share sheet opened.' });
        return;
      }
      await navigator.clipboard.writeText(shareTargetUrl);
      useExperienceStore.setState({ announcement: 'Share link copied to the clipboard.' });
    } catch {
      useExperienceStore.setState({
        announcement: 'Sharing was cancelled. The link is in the address bar.',
      });
    }
  }, [shareTargetUrl]);

  return (
    <div className="app">
      {/* The interface gets out of the way once the code is scannable: anything
          overlapping the code is one more thing for a camera to trip over. */}
      <header className="masthead" data-dimmed={state.phase === 'scan-ready' ? 'true' : 'false'}>
        <h1 className="wordmark">
          VoxelQR<span> — links, sculpted</span>
        </h1>
        <p className="tagline">A link that arrives as a 3D sculpture.</p>
      </header>

      {webglSupported ? (
        <Suspense fallback={null}>
          <VoxelScene
            matrix={state.matrix}
            sculpture={state.sculpture}
            theme={theme}
            quality={quality}
            qrForeground={qrColors.foreground}
            qrBackground={qrColors.background}
            values={controller.values}
            bottomInset={panelHeight}
            active={documentVisible}
          />
        </Suspense>
      ) : (
        <FallbackQr
          matrix={state.matrix}
          foreground={qrColors.foreground}
          background={qrColors.background}
          reason="This device cannot run the 3D scene, so here is the code on its own. Everything else still works."
        />
      )}

      <ControlPanel
        draftUrl={state.draftUrl}
        urlError={state.urlError}
        urlIsDense={state.urlIsDense}
        sculpture={state.sculpture}
        theme={state.theme}
        brandForeground={state.brandForeground}
        brandBackground={state.brandBackground}
        phase={state.phase}
        muted={state.muted}
        contrastAdjusted={qrColors.adjusted}
        onDraftUrlChange={state.setDraftUrl}
        onSubmitUrl={() => state.commitUrl()}
        onSculptureChange={state.setSculpture}
        onThemeChange={state.setTheme}
        onBrandColorsChange={state.setBrandColors}
        onReveal={handleReveal}
        onReturn={handleReturn}
        onShare={() => void handleShare()}
        onToggleMute={state.toggleMuted}
      />

      <LiveRegion message={state.announcement} />
      <div className="visually-hidden" data-testid="phase">
        {state.phase}
      </div>
    </div>
  );
}
