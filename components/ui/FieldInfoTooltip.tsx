"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface FieldInfoTooltipProps {
  label: string;
  description: string;
}

const TOOLTIP_WIDTH = 256;
const TOOLTIP_GAP = 8;
const VIEWPORT_PADDING = 8;

export function FieldInfoTooltip({ label, description }: FieldInfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "top" as "top" | "bottom" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement = spaceAbove >= 72 || spaceAbove >= spaceBelow ? "top" : "bottom";

    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING));

    const top =
      placement === "top" ? rect.top - TOOLTIP_GAP : rect.bottom + TOOLTIP_GAP;

    setCoords({ top, left, placement });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    updatePosition();

    function handleReposition() {
      updatePosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isVisible, updatePosition]);

  const tooltip =
    isVisible && typeof document !== "undefined"
      ? createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: TOOLTIP_WIDTH,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined
            }}
            className="pointer-events-none z-[200] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600 shadow-lg"
          >
            {description}
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <span className="inline-flex shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          aria-describedby={isVisible ? tooltipId : undefined}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          className="rounded-full text-zinc-400 transition hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </span>
      {tooltip}
    </>
  );
}
