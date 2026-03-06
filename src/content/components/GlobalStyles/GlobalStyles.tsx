import { Global, css, keyframes } from '@emotion/react';

const pulse = keyframes`
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.75); }
  40% { opacity: 1; transform: scale(1); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const panelIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const GlobalStyles = () => {
  return (
    <Global
      styles={css`
        * {
          box-sizing: border-box;
          font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
            'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
            'Noto Color Emoji';
        }

        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 4px;
        }

        .eb-md {
          font-size: 13px;
          line-height: 1.6;
          color: #b5bac1 !important;
        }
        .eb-md h1,
        .eb-md h2,
        .eb-md h3 {
          margin: 8px 0 4px;
          font-weight: 600;
          color: #f2f3f5 !important;
        }
        .eb-md h2 {
          font-size: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding-bottom: 4px;
        }
        .eb-md h3 {
          font-size: 13px;
        }
        .eb-md p {
          margin: 4px 0;
          color: #b5bac1 !important;
        }
        .eb-md ul,
        .eb-md ol {
          margin: 4px 0 4px 16px;
          padding: 0;
          color: #b5bac1 !important;
        }
        .eb-md li {
          margin: 3px 0;
          color: #b5bac1 !important;
        }
        .eb-md li::marker {
          color: #5865f2 !important;
        }
        .eb-md a {
          color: #5865f2 !important;
          text-decoration: none;
        }
        .eb-md a:hover {
          text-decoration: underline;
        }
        .eb-md strong {
          color: #f2f3f5 !important;
          font-weight: 600;
        }
        .eb-md code {
          background: rgba(88, 101, 242, 0.12) !important;
          color: #b9beff !important;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 11.5px;
        }
        .eb-md pre {
          background: #111214;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          overflow-x: auto;
          margin: 6px 0;
        }
        .eb-md pre code {
          background: none;
          padding: 0;
          color: #cdd2fa;
        }
        .eb-md blockquote {
          border-left: 3px solid #5865f2;
          margin: 6px 0;
          padding: 4px 10px;
          color: #b5bac1;
          background: rgba(88, 101, 242, 0.15);
          border-radius: 0 6px 6px 0;
        }
        .eb-md table {
          border-collapse: collapse;
          width: 100%;
          margin: 6px 0;
          font-size: 12px;
        }
        .eb-md th,
        .eb-md td {
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 4px 8px;
          text-align: left;
        }
        .eb-md th {
          background: rgba(88, 101, 242, 0.08);
          color: #f2f3f5;
          font-weight: 600;
        }

        .eb-bubble-anim {
          animation: ${slideUp} 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .eb-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #5865f2;
          margin: 0 2px;
          animation: ${pulse} 1.3s ease infinite;
        }
        .eb-dot:nth-child(2) {
          animation-delay: 0.18s;
        }
        .eb-dot:nth-child(3) {
          animation-delay: 0.36s;
        }

        /* Re-adding the panel entry animation just in case */
        @keyframes eb-panel-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}
    />
  );
};

export default GlobalStyles;
