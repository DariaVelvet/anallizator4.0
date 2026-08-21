interface Props {
  size?: number;
  style?: React.CSSProperties;
}

/** Reddit's signature upvote-arrow glyph, in Reddit's own red-orange (#FF4500). */
export default function UpvoteIcon({ size = 12, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0, ...style }}
    >
      <path
        d="M10 2.5c-.34 0-.67.14-.9.4L3.3 9.9c-.5.55-.1 1.42.65 1.42h3.3v5.1c0 .6.48 1.08 1.08 1.08h3.34c.6 0 1.08-.48 1.08-1.08v-5.1h3.3c.75 0 1.15-.87.65-1.42L10.9 2.9a1.2 1.2 0 0 0-.9-.4Z"
        fill="#FF4500"
      />
    </svg>
  );
}
