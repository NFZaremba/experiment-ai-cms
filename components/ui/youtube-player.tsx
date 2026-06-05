"use client";

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

/** States exposed by the YouTube IFrame API (YT.PlayerState). */
const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YouTubePlayerProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "onTimeUpdate"
> {
  /** YouTube video ID (the part after `v=`). */
  videoId: string;
  /** Fires at ~60 fps while the video is playing. */
  onTimeUpdate?: (currentTime: number) => void;
  /** Fires when the player state changes (play, pause, end, etc.). */
  onStateChange?: (state: number) => void;
  /** Fires once when the player is ready. Receives the video duration in seconds. */
  onPlayerReady?: (duration: number) => void;
  /** Thumbnail quality — defaults to `maxresdefault`. */
  posterQuality?: "default" | "hqdefault" | "sddefault" | "maxresdefault";
  /** Whether to autoplay when the player loads. Defaults to `true`. */
  autoplay?: boolean;
  ref?: React.Ref<YouTubePlayerHandle>;
}

export interface YouTubePlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  /** Trigger the player to load (bootstrap) if still in idle state. */
  load: () => void;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    // If already loaded (e.g. from a previous session), resolve immediately.
    if (typeof window !== "undefined" && window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => reject(new Error("YouTube API timeout")), 8000);

    const prev = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      prev?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("YouTube API blocked"));
    };
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

type PlayerPhase = "idle" | "loading" | "ready" | "error";

function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  onPlayerReady,
  posterQuality = "maxresdefault",
  autoplay = true,
  className,
  ref,
  ...props
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const rafRef = useRef<number>(0);
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const phaseRef = useRef<PlayerPhase>("idle");
  const [showFacade, setShowFacade] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep callbacks in refs so the RAF loop always sees the latest.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onPlayerReadyRef = useRef(onPlayerReady);
  onPlayerReadyRef.current = onPlayerReady;

  /* ---- RAF loop: poll currentTime while playing ---- */
  const startPolling = useCallback(() => {
    const tick = () => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === "function") {
        onTimeUpdateRef.current?.(player.getCurrentTime());
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPolling = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  /* ---- Bootstrap the player ---- */
  const bootstrap = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    phaseRef.current = "loading";
    setPhase("loading");

    try {
      await loadYouTubeAPI();
    } catch {
      phaseRef.current = "idle";
      setPhase("error");
      apiLoadPromise = null;
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    // Create a target div for the iframe inside the container.
    const target = document.createElement("div");
    target.id = `yt-player-${videoId}`;
    el.appendChild(target);

    playerRef.current = new window.YT.Player(target.id, {
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        controls: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          // Style the iframe to cover the container (no black bars).
          const iframe = event.target as unknown as { getIframe?: () => HTMLIFrameElement };
          if (iframe.getIframe) {
            const el = iframe.getIframe();
            Object.assign(el.style, {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              transform: "translate(-50%, -50%)",
              objectFit: "cover",
              pointerEvents: "none",
            });
          }
          phaseRef.current = "ready";
          setPhase("ready");
          const duration = playerRef.current?.getDuration() ?? 0;
          onPlayerReadyRef.current?.(duration);
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          onStateChangeRef.current?.(event.data);
          setIsPlaying(event.data === YT_STATE.PLAYING);
          if (event.data === YT_STATE.PLAYING) {
            setShowFacade(false);
            startPolling();
          } else {
            stopPolling();
            // Fire one last update so progress lands on the final value.
            if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
              onTimeUpdateRef.current?.(playerRef.current.getCurrentTime());
            }
            // Hide YouTube's end-screen by re-showing our facade
            if (event.data === YT_STATE.ENDED) {
              setShowFacade(true);
              playerRef.current?.seekTo(0, true);
              playerRef.current?.pauseVideo();
            }
          }
        },
      },
    });
  }, [videoId, autoplay, startPolling, stopPolling]);

  /* ---- Imperative handle ---- */
  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
      },
      getCurrentTime: () => {
        return playerRef.current?.getCurrentTime() ?? 0;
      },
      getDuration: () => {
        return playerRef.current?.getDuration() ?? 0;
      },
      playVideo: () => {
        playerRef.current?.playVideo();
      },
      pauseVideo: () => {
        playerRef.current?.pauseVideo();
      },
      load: () => {
        bootstrap();
      },
    }),
    [bootstrap]
  );

  /* ---- Cleanup ---- */
  useEffect(() => {
    return () => {
      stopPolling();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Render ---- */
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${posterQuality}.jpg`;

  return (
    <div
      ref={containerRef}
      className={cn("relative aspect-video bg-gray-800 overflow-hidden", className)}
      {...props}
    >
      {/* Facade: thumbnail + play/error/loading — stays visible until video plays */}
      {showFacade && (
        <div className="absolute inset-0 z-10 w-full h-full">
          {/* Thumbnail stays visible in all facade states */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />

          {phase === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
              <p className="text-sm text-white/90">Video unavailable</p>
              <button
                type="button"
                onClick={bootstrap}
                className="px-4 py-2 text-sm text-white bg-white/20 hover:bg-white/30 rounded-md transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (phase === "ready") {
                  playerRef.current?.playVideo();
                } else {
                  bootstrap();
                }
              }}
              className="absolute inset-0 w-full h-full cursor-pointer group"
              aria-label="Play video"
            >
              {/* Play button (hide while loading) */}
              {phase !== "loading" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/40 group-hover:bg-black/60 transition-colors flex items-center justify-center backdrop-blur-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="96"
                      height="96"
                      viewBox="0 0 96 96"
                      fill="none"
                    >
                      <path
                        d="M48 0C74.5097 0 96 21.4903 96 48C96 74.5097 74.5097 96 48 96C21.4903 96 0 74.5097 0 48C0 21.4903 21.4903 0 48 0ZM38.4678 28.8047C37.6161 28.7928 36.7763 29.0081 36.0352 29.4277C35.294 29.8474 34.6779 30.4569 34.25 31.1934C33.8221 31.9299 33.598 32.7673 33.6006 33.6191V62.3857C33.5972 63.2378 33.8207 64.0754 34.248 64.8125C34.6755 65.5496 35.2919 66.1598 36.0332 66.5801C36.7746 67.0004 37.6147 67.2159 38.4668 67.2041C39.3188 67.1923 40.1524 66.9542 40.8818 66.5137L64.8682 52.1279C65.5821 51.7024 66.1734 51.0987 66.584 50.376C66.9946 49.6532 67.2099 48.8361 67.21 48.0049C67.21 47.1737 66.9946 46.3565 66.584 45.6338C66.1734 44.9111 65.5821 44.3074 64.8682 43.8818L40.8818 29.4961C40.1527 29.0558 39.3194 28.8167 38.4678 28.8047Z"
                        fill="white"
                        fillOpacity="0.08"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Loading spinner overlay */}
              {phase === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          )}
        </div>
      )}

      {/* Click-to-toggle overlay — visible after facade hides (iframe is pointer-events:none) */}
      {!showFacade && (
        <button
          type="button"
          className="absolute inset-0 z-10 w-full h-full cursor-pointer"
          aria-label={isPlaying ? "Pause video" : "Play video"}
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (isPlaying) {
              player.pauseVideo();
            } else {
              player.playVideo();
            }
          }}
        />
      )}

      {/* The YT.Player iframe gets injected into this container via appendChild */}
    </div>
  );
}

export { YouTubePlayer, YT_STATE };
