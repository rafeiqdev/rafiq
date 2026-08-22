import React from "react";
import { cn } from "@/lib/utils";
import { RAFIQ_LOGO_PATH, RAFIQ_LOGO_VIEWBOX } from "./rafiq-logo-path";

export interface RafiqBrandLogoProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "custom";
  variant?: "light" | "dark" | "current" | "primary";
}

/**
 * Official Vector Rafiq Brand Logo
 * 1:1 match of user's official SVG vector file.
 * 100% vector sharpness, zero blur, and transparent background.
 */
export const RafiqBrandLogo: React.FC<RafiqBrandLogoProps> = ({
  size = "md",
  variant = "dark",
  className,
  ...props
}) => {
  const sizeClasses = {
    xs: "h-5 w-auto",
    sm: "h-7 w-auto",
    md: "h-9 sm:h-10 w-auto",
    lg: "h-11 sm:h-12 md:h-14 w-auto",
    xl: "h-14 sm:h-16 md:h-20 w-auto",
    "2xl": "h-20 sm:h-24 md:h-28 w-auto",
    custom: "",
  }[size];

  const colorClass = {
    light: "text-white fill-white",
    dark: "text-[#09245E] fill-[#09245E]",
    primary: "text-[#1A3A6B] fill-[#1A3A6B]",
    current: "text-current fill-current",
  }[variant];

  return (
    <svg
      viewBox={RAFIQ_LOGO_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "inline-block object-contain select-none pointer-events-none shrink-0",
        sizeClasses,
        colorClass,
        className
      )}
      style={{
        shapeRendering: "geometricPrecision",
      }}
      aria-label="Rafiq Logo"
      role="img"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={RAFIQ_LOGO_PATH}
        className="fill-current"
      />
    </svg>
  );
};

export default RafiqBrandLogo;
