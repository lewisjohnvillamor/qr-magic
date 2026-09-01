import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExperienceStore } from './experience-store';
import { useReveal } from './use-reveal';
import { ControlPanel } from '../components/controls/ControlPanel';
import { ViewerPanel } from '../components/controls/ViewerPanel';
import { FallbackQr } from '../components/fallback/FallbackQr';
import { LiveRegion } from '../components/LiveRegion';
import { IconButton } from '../components/controls/icons';
import { getTheme, resolveQrColors } from '../themes/themes';
import { QUALITY_PROFILES, detectWebglSupport } from '../lib/quality';
import { prefersReducedMotion, subscribeToReducedMotion } from '../animation/motion-preferences';
import { useElementHeight } from '../lib/use-element-height';
import { playCue, disposeAudio } from '../lib/audio';
import { MUSIC_CREDIT, playAmbient, stopAmbient, disposeAmbient } from '../lib/ambient';
import { SHARE_PARAM, isReadOnlySearch } from '../sharing/share-codec';

const VoxelScene = lazy(() =>
  import('../components/scene/VoxelScene').then((module) => ({ default: module.VoxelScene })),
);

/** True when the app is running inside someone else's page as a widget. */
function readEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

/**
 * True when this page was opened from a link someone shared.
 *
 * Read once at load, before the address-bar sync starts writing payloads of
 * its own, so a recipient stays in view mode and an author who reloads their
 * own page does not fall into it.
 */
function readViewerMode(): boolean {
  if (typeof window === 'undefined') return false;
  return isReadOnlySearch(window.location.search);
}

/**
 * Height the scan-ready bar occupies, in CSS pixels. The scan camera frames
 * against this constant so the locked code never shifts when the editing panel
 * collapses behind it.
 */
const SCAN_INSET = 96;

export function App() {
  const state = useExperienceStore();
  const [embedMode] = useState(readEmbedMode);
  const [viewerMode] = useState(readViewerMode);
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

  useEffect(
    () => () => {
      disposeAudio();
      disposeAmbient();
    },
    [],
  );

  // The ambient bed follows the mute toggle and crossfades with the theme.
  useEffect(() => {
    if (state.muted) {
      stopAmbient();
      return;
    }
    playAmbient(state.theme);
  }, [state.muted, state.theme]);

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
    // The reveal commits whatever is in the field first, so typing a link and
    // pressing the primary button is the whole flow.
    const result = useExperienceStore.getState().commitUrl();
    if (!result.ok) return;
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

  /** The link handed to other people: read-only, so they get no controls. */
  const shareTargetUrl = useMemo(
    () => state.shareUrl(window.location.href, { readOnly: true }),
    // Recomputed whenever any part of the shared payload changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.url, state.sculpture, state.theme, state.brandForeground, state.brandBackground],
  );

  /** The author's own address: the same payload, but still editable. */
  const authoringUrl = useMemo(
    () => state.shareUrl(window.location.href),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.url, state.sculpture, state.theme, state.brandForeground, state.brandBackground],
  );

  // Keep the address bar in sync so a reload or a manual copy restores the same
  // experience, without ever adding a history entry per keystroke. A viewer's
  // address is left exactly as it arrived — rewriting it would strip the
  // read-only flag and hand them the editor on refresh.
  useEffect(() => {
    if (viewerMode) return;
    const url = new URL(window.location.href);
    const next = new URL(authoringUrl);
    if (url.searchParams.get(SHARE_PARAM) === next.searchParams.get(SHARE_PARAM)) return;
    window.history.replaceState(null, '', next.toString());
  }, [authoringUrl, viewerMode]);

  /**
   * Export the current view as a PNG — the email story.
   *
   * Email clients strip scripts and iframes, so the live widget cannot run in
   * an inbox. What works everywhere is an image: capture the sculpture (or the
   * scan-ready code, which stays scannable straight from the email) and link
   * the image to the shared experience.
   */
  const handleSavePng = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas');
    if (!canvas) {
      useExperienceStore.setState({ announcement: 'Nothing to capture on this device.' });
      return;
    }
    const current = useExperienceStore.getState();
    const name =
      current.phase === 'scan-ready'
        ? 'voxelqr-code.png'
        : `voxelqr-${current.sculpture}-${current.theme}.png`;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = name;
    link.click();
    useExperienceStore.setState({
      announcement:
        current.phase === 'scan-ready'
          ? 'Image saved. This picture is itself a scannable code — it works in an email.'
          : 'Image saved. Reveal the QR first if you want a scannable picture.',
    });
  }, []);

  const handleEmbed = useCallback(async () => {
    const url = new URL(shareTargetUrl);
    url.searchParams.set('embed', '1');
    const snippet = `<iframe src="${url.toString()}" width="420" height="420" style="border:0;border-radius:16px;overflow:hidden" loading="lazy" title="VoxelQR — a link as a 3D sculpture that becomes a QR code"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      useExperienceStore.setState({
        announcement: 'Embed code copied. Paste it into any page that allows iframes.',
      });
    } catch {
      useExperienceStore.setState({
        announcement: 'Copying failed — the embed URL is in the address bar with &embed=1.',
      });
    }
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
      useExperienceStore.setState({
        announcement:
          'Share link copied. It opens the full 3D sculpture, and carries your destination encoded — not encrypted.',
      });
    } catch {
      useExperienceStore.setState({
        announcement: 'Sharing was cancelled. The link is in the address bar.',
      });
    }
  }, [shareTargetUrl]);

  const scanReady = state.phase === 'scan-ready';
  const busy = state.phase === 'revealing' || state.phase === 'returning';

  const revealControl = webglSupported ? (
    <button
      type="button"
      className="scene-action"
      onClick={scanReady ? handleReturn : handleReveal}
      disabled={busy || Boolean(state.urlError)}
      aria-label={scanReady ? 'Return to sculpture' : 'Reveal QR'}
      data-testid="reveal-button"
    >
      {/* The hint is the only visible part; the button itself is the sculpture's
          own space, so the gesture is "press the thing" rather than "find the
          control". It is still a real focusable button for keyboards and
          screen readers (spec §16). */}
      <span className="scene-action-hint" data-hidden={scanReady || busy ? 'true' : 'false'}>
        Press to reveal the QR
      </span>
    </button>
  ) : null;

  if (viewerMode) {
    return (
      <div className="app app--viewer">
        {/* No masthead actions beyond sound: a recipient is here to look at
            someone else's work, not to configure it. */}
        <header className="masthead" data-dimmed={scanReady ? 'true' : 'false'}>
          <h1 className="wordmark">
            VoxelQR<span> — links, sculpted</span>
          </h1>
          <span className="spacer" />
          <IconButton
            icon={state.muted ? 'sound-off' : 'sound-on'}
            label={state.muted ? 'Sound off' : 'Sound on'}
            title={MUSIC_CREDIT}
            onClick={state.toggleMuted}
            pressed={!state.muted}
            className="masthead-action"
          />
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
              scanInset={SCAN_INSET}
              active={documentVisible}
            />
          </Suspense>
        ) : (
          <FallbackQr
            matrix={state.matrix}
            foreground={qrColors.foreground}
            background={qrColors.background}
            reason="This device cannot run the 3D scene, so here is the code on its own."
          />
        )}

        {scanReady ? null : revealControl}

        <ViewerPanel
          destination={state.url}
          phase={state.phase}
          onReturn={handleReturn}
          onShare={() => void handleShare()}
          onEmbed={() => void handleEmbed()}
          onSavePng={handleSavePng}
        />

        <LiveRegion message={state.announcement} />
        <div className="visually-hidden" data-testid="phase">
          {state.phase}
        </div>
      </div>
    );
  }

  if (embedMode) {
    return (
      <div className="app app--embed">
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
              bottomInset={0}
              scanInset={0}
              active={documentVisible}
            />
          </Suspense>
        ) : (
          <FallbackQr
            matrix={state.matrix}
            foreground={qrColors.foreground}
            background={qrColors.background}
            reason="This device cannot run the 3D scene, so here is the code on its own."
          />
        )}

        {revealControl}

        <div className="embed-bar">
          <a
            className="embed-attribution"
            href={shareTargetUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            VoxelQR ↗
          </a>
          <span className="spacer" />
          <IconButton
            icon={state.muted ? 'sound-off' : 'sound-on'}
            label={state.muted ? 'Sound off' : 'Sound on'}
            title={MUSIC_CREDIT}
            onClick={state.toggleMuted}
            pressed={!state.muted}
          />
        </div>

        <LiveRegion message={state.announcement} />
        <div className="visually-hidden" data-testid="phase">
          {state.phase}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* The interface gets out of the way once the code is scannable: anything
          overlapping the code is one more thing for a camera to trip over. */}
      <header className="masthead" data-dimmed={state.phase === 'scan-ready' ? 'true' : 'false'}>
        <h1 className="wordmark">
          VoxelQR<span> — links, sculpted</span>
        </h1>
        <p className="tagline">A link that arrives as a 3D sculpture.</p>
        <span className="spacer" />
        <IconButton
          icon={state.muted ? 'sound-off' : 'sound-on'}
          label={state.muted ? 'Sound off' : 'Sound on'}
          title={MUSIC_CREDIT}
          onClick={state.toggleMuted}
          pressed={!state.muted}
          className="masthead-action"
        />
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
            scanInset={SCAN_INSET}
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

      {scanReady ? null : revealControl}

      <ControlPanel
        draftUrl={state.draftUrl}
        urlError={state.urlError}
        urlIsDense={state.urlIsDense}
        sculpture={state.sculpture}
        theme={state.theme}
        brandForeground={state.brandForeground}
        brandBackground={state.brandBackground}
        phase={state.phase}
        contrastAdjusted={qrColors.adjusted}
        onDraftUrlChange={state.setDraftUrl}
        onSubmitUrl={() => state.commitUrl()}
        onSculptureChange={state.setSculpture}
        onThemeChange={state.setTheme}
        onBrandColorsChange={state.setBrandColors}
        onReturn={handleReturn}
        onShare={() => void handleShare()}
        onEmbed={() => void handleEmbed()}
        onSavePng={handleSavePng}
      />

      <LiveRegion message={state.announcement} />
      <div className="visually-hidden" data-testid="phase">
        {state.phase}
      </div>
    </div>
  );
}
