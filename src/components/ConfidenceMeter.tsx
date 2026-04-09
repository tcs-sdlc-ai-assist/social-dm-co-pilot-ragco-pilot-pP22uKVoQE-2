"use client";

import { useState } from "react";
import { ConfidenceLevel } from "@/types";
import { CONFIDENCE_THRESHOLDS } from "@/constants";

interface ConfidenceMeterProps {
  score: number;
  showLabel?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

function getConfidenceLevel(score: number): ConfidenceLevel {
  const percentage = score <= 1 ? score * 100 : score;
  if (percentage >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.HIGH]) {
    return ConfidenceLevel.HIGH;
  }
  if (percentage >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.MEDIUM]) {
    return ConfidenceLevel.MEDIUM;
  }
  return ConfidenceLevel.LOW;
}

function getBarColorClasses(level: ConfidenceLevel): string {
  switch (level) {
    case ConfidenceLevel.HIGH:
      return "bg-green-500";
    case ConfidenceLevel.MEDIUM:
      return "bg-yellow-500";
    case ConfidenceLevel.LOW:
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function getLabelColorClasses(level: ConfidenceLevel): string {
  switch (level) {
    case ConfidenceLevel.HIGH:
      return "text-green-700 dark:text-green-400";
    case ConfidenceLevel.MEDIUM:
      return "text-yellow-700 dark:text-yellow-400";
    case ConfidenceLevel.LOW:
      return "text-red-700 dark:text-red-400";
    default:
      return "text-gray-700 dark:text-gray-400";
  }
}

function getTrackColorClasses(level: ConfidenceLevel): string {
  switch (level) {
    case ConfidenceLevel.HIGH:
      return "bg-green-100 dark:bg-green-900";
    case ConfidenceLevel.MEDIUM:
      return "bg-yellow-100 dark:bg-yellow-900";
    case ConfidenceLevel.LOW:
      return "bg-red-100 dark:bg-red-900";
    default:
      return "bg-gray-100 dark:bg-gray-800";
  }
}

function getLevelLabel(level: ConfidenceLevel): string {
  switch (level) {
    case ConfidenceLevel.HIGH:
      return "High";
    case ConfidenceLevel.MEDIUM:
      return "Medium";
    case ConfidenceLevel.LOW:
      return "Low";
    default:
      return "Unknown";
  }
}

function getTooltipText(level: ConfidenceLevel, percentage: number): string {
  switch (level) {
    case ConfidenceLevel.HIGH:
      return `High confidence (${percentage}%): The AI-generated draft closely matches knowledge base context and can likely be sent with minimal edits.`;
    case ConfidenceLevel.MEDIUM:
      return `Medium confidence (${percentage}%): The draft may need some review and editing before sending. Some context gaps were detected.`;
    case ConfidenceLevel.LOW:
      return `Low confidence (${percentage}%): This draft requires human review before sending. The AI had limited context or low certainty in its response.`;
    default:
      return `Confidence: ${percentage}%`;
  }
}

const barHeightClasses: Record<NonNullable<ConfidenceMeterProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const textSizeClasses: Record<NonNullable<ConfidenceMeterProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ConfidenceMeter({
  score,
  showLabel = true,
  showTooltip = true,
  size = "md",
}: ConfidenceMeterProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const percentage = Math.round(score <= 1 ? score * 100 : score);
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const level = getConfidenceLevel(clampedPercentage);

  const barColor = getBarColorClasses(level);
  const labelColor = getLabelColorClasses(level);
  const trackColor = getTrackColorClasses(level);
  const levelLabel = getLevelLabel(level);
  const tooltipText = getTooltipText(level, clampedPercentage);
  const barHeight = barHeightClasses[size];
  const textSize = textSizeClasses[size];

  const isLowConfidence = level === ConfidenceLevel.LOW;

  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isLowConfidence && (
              <WarningIcon className="h-4 w-4 flex-shrink-0 text-red-500" />
            )}
            <span className={`font-medium ${textSize} ${labelColor}`}>
              {levelLabel} Confidence
            </span>
          </div>
          <span className={`font-semibold ${textSize} ${labelColor}`}>
            {clampedPercentage}%
          </span>
        </div>
      )}

      <div
        className="relative"
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
        onFocus={() => setIsTooltipVisible(true)}
        onBlur={() => setIsTooltipVisible(false)}
      >
        <div
          className={`w-full overflow-hidden rounded-full ${trackColor} ${barHeight}`}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence score: ${clampedPercentage}% (${levelLabel})`}
          tabIndex={showTooltip ? 0 : undefined}
        >
          <div
            className={`${barHeight} rounded-full transition-all duration-300 ease-in-out ${barColor}`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>

        {showTooltip && isTooltipVisible && (
          <div
            className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 animate-fade-in"
            role="tooltip"
          >
            {tooltipText}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-gray-800" />
          </div>
        )}
      </div>

      {isLowConfidence && (
        <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <WarningIcon className="h-3.5 w-3.5 flex-shrink-0" />
          Requires human review before sending
        </p>
      )}
    </div>
  );
}